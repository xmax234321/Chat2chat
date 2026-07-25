import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { encodeWire, type BlobAckPayload } from '@chat2chat/protocol';
import { config } from './config.js';

const BLOB_TTL_MS = config.blobTtlMs;
const MAX_BLOB_SIZE = config.maxBlobSize;

interface StoredBlob {
  recipientId: string;
  data: Buffer;
  expiresAt: number;
}

/** Ephemeral blob store — separate from text message queue */
export const blobStore = new Map<string, StoredBlob>();

export function deleteBlob(blobId: string): boolean {
  return blobStore.delete(blobId);
}

export function flushExpiredBlobs(): void {
  const now = Date.now();
  for (const [id, blob] of blobStore) {
    if (blob.expiresAt <= now) blobStore.delete(id);
  }
}

export function handleBlobAck(registeredUserId: string | null, payload: BlobAckPayload): void {
  if (!registeredUserId) return;
  const entry = blobStore.get(payload.blobId);
  if (entry && entry.recipientId === registeredUserId) {
    blobStore.delete(payload.blobId);
  }
}

async function registerBlobHandlers(
  app: FastifyInstance,
  prefix: string,
): Promise<void> {
  app.put<{
    Params: { blobId: string };
    Headers: { 'x-recipient-id'?: string };
  }>(`${prefix}/:blobId`, async (req, reply) => {
    const { blobId } = req.params;
    const recipientId = req.headers['x-recipient-id'];
    if (!recipientId) {
      return reply.code(400).send({ error: 'X-Recipient-Id header required' });
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

    blobStore.set(blobId, {
      recipientId,
      data,
      expiresAt: Date.now() + BLOB_TTL_MS,
    });

    return reply.code(201).send({ ok: true, blobId, size: data.length });
  });

  app.get<{
    Params: { blobId: string };
    Headers: { 'x-user-id'?: string };
  }>(`${prefix}/:blobId`, async (req, reply) => {
    const { blobId } = req.params;
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return reply.code(400).send({ error: 'X-User-Id header required' });
    }

    const entry = blobStore.get(blobId);
    if (!entry) {
      return reply.code(404).send({ error: 'Blob not found or expired' });
    }
    if (entry.recipientId !== userId) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    return reply
      .header('Content-Type', 'application/octet-stream')
      .header('Content-Length', entry.data.length)
      .send(entry.data);
  });

  app.get(prefix, async () => ({
    queuedBlobs: blobStore.size,
    maxSize: MAX_BLOB_SIZE,
    ttlMs: BLOB_TTL_MS,
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
