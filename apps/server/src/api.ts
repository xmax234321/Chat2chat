import type { FastifyInstance } from 'fastify';
import { base64UrlDecode, utf8ToBytes, verify } from '@chat2chat/crypto/server';
import { config } from './config.js';
import { blobStore, blobStoreStats } from './blob.js';
import { relayStats } from './store.js';
import { getUserVault, putUserVault } from './vault.js';

const API_VERSION = '1.0.0';
/** Requests with a timestamp older/newer than this are rejected (replay protection). */
const VAULT_SIGNATURE_WINDOW_MS = 5 * 60_000;

export const apiSpec = {
  name: 'Chat2Chat Relay API',
  version: API_VERSION,
  description: 'Zero-storage relay — routes encrypted envelopes and ephemeral blobs only.',
  endpoints: {
    info: `GET ${config.apiPrefix}`,
    health: `GET ${config.apiPrefix}/health`,
    stats: `GET ${config.apiPrefix}/stats`,
    blobUpload: `PUT ${config.apiPrefix}/blob/:blobId`,
    blobDownload: `GET ${config.apiPrefix}/blob/:blobId`,
    blobInfo: `GET ${config.apiPrefix}/blob`,
    userVaultGet: `GET ${config.apiPrefix}/vault/:userId`,
    userVaultPut: `PUT ${config.apiPrefix}/vault/:userId`,
    websocket: 'GET /ws',
  },
} as const;

function verifySignedRequest(
  userId: string,
  message: string,
  timestamp: number,
  signatureB64: string,
): boolean {
  if (!userId?.startsWith('c2c_')) return false;
  if (Math.abs(Date.now() - timestamp) > VAULT_SIGNATURE_WINDOW_MS) return false;
  try {
    const signature = base64UrlDecode(signatureB64);
    return verify(userId, utf8ToBytes(message), signature);
  } catch {
    return false;
  }
}

export async function registerApiRoutes(app: FastifyInstance): Promise<void> {
  const prefix = config.apiPrefix;

  app.get(prefix, async () => ({
    ...apiSpec,
    serverTime: Date.now(),
    wsUrl: '/ws',
  }));

  app.get(`${prefix}/health`, async () => ({
    status: 'ok',
    serverTime: Date.now(),
    minClientVersion: config.enforceMinClientVersion
      ? { version: config.minClientVersion, build: config.minClientBuild }
      : null,
    ...relayStats(),
    queuedBlobs: blobStore.size,
  }));

  app.get(`${prefix}/stats`, async () => ({
    serverTime: Date.now(),
    relay: relayStats(),
    blobs: {
      ...blobStoreStats(),
      maxSizeBytes: config.maxBlobSize,
      ttlMs: config.blobTtlMs,
    },
    messages: {
      ttlMs: config.messageTtlMs,
    },
  }));

  app.get(`${prefix}/docs`, async () => apiSpec);

  // GET /vault/:userId?timestamp=...&signature=...
  // Client signs the string `vault-get:${userId}:${timestamp}`.
  app.get(`${prefix}/vault/:userId`, async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const query = req.query as { timestamp?: string; signature?: string };
    const timestamp = Number(query.timestamp);
    const signature = query.signature ?? '';

    if (!userId?.startsWith('c2c_') || !signature || !Number.isFinite(timestamp)) {
      return reply.code(400).send({ error: 'Invalid vault request' });
    }

    const message = `vault-get:${userId}:${timestamp}`;
    if (!verifySignedRequest(userId, message, timestamp, signature)) {
      return reply.code(401).send({ error: 'Signature verification failed' });
    }

    const entry = getUserVault(userId);
    if (!entry) return reply.code(404).send({ error: 'Vault not found' });
    return {
      ciphertext: entry.ciphertext,
      version: entry.version,
      updatedAt: entry.updatedAt,
    };
  });

  // PUT /vault/:userId  body: { ciphertext, version, timestamp, signature }
  // Client signs the string `vault-put:${userId}:${version}:${timestamp}:${ciphertext}`.
  app.put(`${prefix}/vault/:userId`, async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const body = req.body as {
      ciphertext?: string;
      version?: number;
      timestamp?: number;
      signature?: string;
    };

    if (
      !userId?.startsWith('c2c_') ||
      !body.ciphertext ||
      typeof body.version !== 'number' ||
      typeof body.timestamp !== 'number' ||
      !body.signature
    ) {
      return reply.code(400).send({ error: 'Invalid vault payload' });
    }

    const message = `vault-put:${userId}:${body.version}:${body.timestamp}:${body.ciphertext}`;
    if (!verifySignedRequest(userId, message, body.timestamp, body.signature)) {
      return reply.code(401).send({ error: 'Signature verification failed' });
    }

    try {
      const entry = putUserVault(userId, body.ciphertext, body.version);
      return { ok: true, version: entry.version, updatedAt: entry.updatedAt };
    } catch (e) {
      return reply.code(409).send({
        error: e instanceof Error ? e.message : 'Vault conflict',
      });
    }
  });

  // Legacy aliases
  app.get('/health', async () => ({
    status: 'ok',
    serverTime: Date.now(),
    ...relayStats(),
    queuedBlobs: blobStore.size,
    api: config.apiPrefix,
  }));

  app.get('/', async () => ({
    service: 'chat2chat-relay',
    api: config.apiPrefix,
    health: `${config.apiPrefix}/health`,
    websocket: '/ws',
  }));
}
