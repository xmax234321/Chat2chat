import { existsSync, createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { encodeWire, type BlobAckPayload } from '@chat2chat/protocol';
import { base64UrlDecode, utf8ToBytes, verify } from '@chat2chat/crypto/server';
import { config } from './config.js';

const BLOB_TTL_MS = config.blobTtlMs;
const MAX_BLOB_SIZE = config.maxBlobSize;
const MEMORY_TTL_MS = config.blobMemoryTtlMs;
const MEMORY_BUDGET_BYTES = config.blobMemoryBudgetBytes;

type BlobLocation = 'memory' | 'disk';

interface BlobEntry {
  recipientId: string;
  size: number;
  expiresAt: number;
  createdAt: number;
  location: BlobLocation;
  /** Present only while location === 'memory'. */
  data?: Buffer;
}

/**
 * Blob index — always in RAM (it's tiny: just metadata once a blob is on
 * disk). The `data` field is what actually costs memory, and only lives
 * here for blobs younger than blobMemoryTtlMs and under the memory budget.
 */
export const blobStore = new Map<string, BlobEntry>();
let memoryBytesUsed = 0;

function blobDataPath(blobId: string): string {
  return path.join(config.blobsDir, `${blobId}.bin`);
}

function blobMetaPath(blobId: string): string {
  return path.join(config.blobsDir, `${blobId}.json`);
}

async function removeDiskFiles(blobId: string): Promise<void> {
  await unlink(blobDataPath(blobId)).catch(() => {});
  await unlink(blobMetaPath(blobId)).catch(() => {});
}

async function writeToDisk(blobId: string, entry: BlobEntry, data: Buffer): Promise<void> {
  await mkdir(config.blobsDir, { recursive: true });
  await writeFile(blobDataPath(blobId), data);
  await writeFile(
    blobMetaPath(blobId),
    JSON.stringify({
      recipientId: entry.recipientId,
      size: entry.size,
      expiresAt: entry.expiresAt,
      createdAt: entry.createdAt,
    }),
  );
}

/** Rebuild the in-memory index from disk on boot (data itself stays on disk). */
export async function initBlobStore(): Promise<void> {
  await mkdir(config.blobsDir, { recursive: true });
  const files = await readdir(config.blobsDir).catch(() => [] as string[]);
  const now = Date.now();

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const blobId = file.slice(0, -'.json'.length);
    try {
      const raw = await readFile(path.join(config.blobsDir, file), 'utf8');
      const meta = JSON.parse(raw) as { recipientId: string; size: number; expiresAt: number; createdAt: number };
      if (meta.expiresAt <= now) {
        await removeDiskFiles(blobId);
        continue;
      }
      blobStore.set(blobId, {
        recipientId: meta.recipientId,
        size: meta.size,
        expiresAt: meta.expiresAt,
        createdAt: meta.createdAt,
        location: 'disk',
      });
    } catch {
      // corrupted/partial pair left over from a crash — drop it
      await removeDiskFiles(blobId);
    }
  }
}

/** Push the oldest in-memory blobs to disk until there's room for `neededBytes`. */
async function evictOldestToDisk(neededBytes: number): Promise<void> {
  const memEntries = [...blobStore.entries()]
    .filter(([, e]) => e.location === 'memory')
    .sort((a, b) => a[1].createdAt - b[1].createdAt);

  for (const [blobId, entry] of memEntries) {
    if (memoryBytesUsed + neededBytes <= MEMORY_BUDGET_BYTES) break;
    if (!entry.data) continue;
    await writeToDisk(blobId, entry, entry.data);
    memoryBytesUsed -= entry.data.length;
    entry.location = 'disk';
    entry.data = undefined;
  }
}

export async function storeBlob(blobId: string, recipientId: string, data: Buffer): Promise<void> {
  const now = Date.now();
  const entry: BlobEntry = {
    recipientId,
    size: data.length,
    expiresAt: now + BLOB_TTL_MS,
    createdAt: now,
    location: 'memory',
  };

  // A single blob bigger than the whole memory budget goes straight to disk.
  if (data.length > MEMORY_BUDGET_BYTES) {
    await writeToDisk(blobId, entry, data);
    entry.location = 'disk';
    blobStore.set(blobId, entry);
    return;
  }

  if (memoryBytesUsed + data.length > MEMORY_BUDGET_BYTES) {
    await evictOldestToDisk(data.length);
  }

  if (memoryBytesUsed + data.length > MEMORY_BUDGET_BYTES) {
    // Still over budget (burst of large concurrent uploads) — disk it is.
    await writeToDisk(blobId, entry, data);
    entry.location = 'disk';
  } else {
    entry.data = data;
    memoryBytesUsed += data.length;
  }

  blobStore.set(blobId, entry);
}

export async function readBlob(
  blobId: string,
): Promise<{ stream: NodeJS.ReadableStream; size: number } | null> {
  const entry = blobStore.get(blobId);
  if (!entry) return null;

  if (entry.location === 'memory' && entry.data) {
    return { stream: Readable.from(entry.data), size: entry.data.length };
  }

  const filePath = blobDataPath(blobId);
  if (!existsSync(filePath)) return null;
  return { stream: createReadStream(filePath), size: entry.size };
}

export async function deleteBlob(blobId: string): Promise<boolean> {
  const entry = blobStore.get(blobId);
  if (!entry) return false;
  if (entry.location === 'memory' && entry.data) {
    memoryBytesUsed -= entry.data.length;
  }
  blobStore.delete(blobId);
  await removeDiskFiles(blobId); // no-op if it never touched disk
  return true;
}

export async function flushExpiredBlobs(): Promise<void> {
  const now = Date.now();
  for (const [blobId, entry] of blobStore) {
    if (entry.expiresAt <= now) {
      await deleteBlob(blobId);
    }
  }
}

/** Spill blobs that have sat in RAM longer than blobMemoryTtlMs onto disk. */
export async function demoteAgedBlobsToDisk(): Promise<void> {
  const now = Date.now();
  for (const [blobId, entry] of blobStore) {
    if (entry.location === 'memory' && entry.data && now - entry.createdAt >= MEMORY_TTL_MS) {
      await writeToDisk(blobId, entry, entry.data);
      memoryBytesUsed -= entry.data.length;
      entry.location = 'disk';
      entry.data = undefined;
    }
  }
}

export function blobStoreStats() {
  let memoryCount = 0;
  let diskCount = 0;
  for (const e of blobStore.values()) {
    if (e.location === 'memory') memoryCount++;
    else diskCount++;
  }
  return {
    total: blobStore.size,
    memoryCount,
    diskCount,
    memoryBytesUsed,
    memoryBudgetBytes: MEMORY_BUDGET_BYTES,
  };
}

export function handleBlobAck(registeredUserId: string | null, payload: BlobAckPayload): void {
  if (!registeredUserId) return;
  const entry = blobStore.get(payload.blobId);
  if (entry && entry.recipientId === registeredUserId) {
    void deleteBlob(payload.blobId);
  }
}

/** Requests with a timestamp older/newer than this are rejected (replay protection). */
const SIGNATURE_WINDOW_MS = 5 * 60_000;

function verifySignedHeader(
  claimedUserId: string,
  message: string,
  timestamp: number,
  signatureB64: string,
): boolean {
  if (!claimedUserId?.startsWith('c2c_')) return false;
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > SIGNATURE_WINDOW_MS) return false;
  try {
    const signature = base64UrlDecode(signatureB64);
    return verify(claimedUserId, utf8ToBytes(message), signature);
  } catch {
    return false;
  }
}

async function registerBlobHandlers(
  app: FastifyInstance,
  prefix: string,
): Promise<void> {
  app.put<{
    Params: { blobId: string };
    Headers: {
      'x-recipient-id'?: string;
      'x-sender-id'?: string;
      'x-timestamp'?: string;
      'x-signature'?: string;
    };
  }>(`${prefix}/:blobId`, async (req, reply) => {
    const { blobId } = req.params;
    const recipientId = req.headers['x-recipient-id'];
    const senderId = req.headers['x-sender-id'];
    const timestamp = Number(req.headers['x-timestamp']);
    const signature = req.headers['x-signature'];

    if (!recipientId || !senderId || !signature) {
      return reply.code(400).send({
        error: 'X-Recipient-Id, X-Sender-Id and X-Signature headers required',
      });
    }

    // Proves the uploader really controls senderId — recipientId itself needs
    // no proof (anyone may address a blob to anyone, same as sending a message).
    const message = `blob-put:${blobId}:${recipientId}:${timestamp}`;
    if (!verifySignedHeader(senderId, message, timestamp, signature)) {
      return reply.code(401).send({ error: 'Signature verification failed' });
    }

    const data = req.body as Buffer;
    if (!data || data.length === 0) {
      return reply.code(400).send({ error: 'Empty body' });
    }
    if (data.length > MAX_BLOB_SIZE) {
      return reply.code(413).send({
        error: 'Blob too large',
        maxSizeBytes: MAX_BLOB_SIZE,
        receivedBytes: data.length,
      });
    }

    await storeBlob(blobId, recipientId, data);

    return reply.code(201).send({ ok: true, blobId, size: data.length });
  });

  app.get<{
    Params: { blobId: string };
    Headers: { 'x-user-id'?: string; 'x-timestamp'?: string; 'x-signature'?: string };
  }>(`${prefix}/:blobId`, async (req, reply) => {
    const { blobId } = req.params;
    const userId = req.headers['x-user-id'];
    const timestamp = Number(req.headers['x-timestamp']);
    const signature = req.headers['x-signature'];

    if (!userId || !signature) {
      return reply.code(400).send({ error: 'X-User-Id and X-Signature headers required' });
    }

    const message = `blob-get:${blobId}:${timestamp}`;
    if (!verifySignedHeader(userId, message, timestamp, signature)) {
      return reply.code(401).send({ error: 'Signature verification failed' });
    }

    const entry = blobStore.get(blobId);
    if (!entry || entry.recipientId !== userId) {
      // 404 either way — don't leak whether a blob exists for someone else.
      return reply.code(404).send({ error: 'Blob not found or expired' });
    }

    const result = await readBlob(blobId);
    if (!result) {
      return reply.code(404).send({ error: 'Blob not found or expired' });
    }

    return reply
      .header('Content-Type', 'application/octet-stream')
      .header('Content-Length', result.size)
      .send(result.stream);
  });

  app.get(prefix, async () => ({
    ...blobStoreStats(),
    maxSize: MAX_BLOB_SIZE,
    ttlMs: BLOB_TTL_MS,
    memoryTtlMs: MEMORY_TTL_MS,
  }));
}

let octetParserRegistered = false;

export async function registerBlobRoutes(app: FastifyInstance): Promise<void> {
  if (!octetParserRegistered) {
    app.addContentTypeParser(
      'application/octet-stream',
      { parseAs: 'buffer' },
      (_req, body, done) => {
        done(null, body);
      },
    );
    octetParserRegistered = true;
  }
  await registerBlobHandlers(app, '/blob');
  await registerBlobHandlers(app, `${config.apiPrefix}/blob`);
}

export function notifyBlobReady(
  connections: Map<string, Set<WebSocket>>,
  recipientId: string,
  blobId: string,
): void {
  const sockets = connections.get(recipientId);
  if (!sockets) return;
  const wire = encodeWire({
    v: 1,
    type: 'blob_ready',
    payload: { blobId, recipientId },
  });
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) socket.send(wire);
  }
}
