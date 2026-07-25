import type { FastifyInstance } from 'fastify';
import { config } from './config.js';
import { blobStore } from './blob.js';
import { relayStats } from './store.js';
import { getUserVault, putUserVault } from './vault.js';

const API_VERSION = '1.0.0';

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
      queued: blobStore.size,
      maxSizeBytes: config.maxBlobSize,
      ttlMs: config.blobTtlMs,
    },
    messages: {
      ttlMs: config.messageTtlMs,
    },
  }));

  app.get(`${prefix}/docs`, async () => apiSpec);

  app.get(`${prefix}/vault/:userId`, async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const auth = (req.query as { auth?: string }).auth ?? '';
    if (!userId?.startsWith('c2c_') || !auth) {
      return reply.code(400).send({ error: 'Invalid vault request' });
    }
    const entry = getUserVault(userId, auth);
    if (!entry) return reply.code(404).send({ error: 'Vault not found' });
    return {
      ciphertext: entry.ciphertext,
      version: entry.version,
      updatedAt: entry.updatedAt,
    };
  });

  app.put(`${prefix}/vault/:userId`, async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const body = req.body as { auth?: string; ciphertext?: string; version?: number };
    if (!userId?.startsWith('c2c_') || !body.auth || !body.ciphertext || typeof body.version !== 'number') {
      return reply.code(400).send({ error: 'Invalid vault payload' });
    }
    try {
      const entry = putUserVault(userId, body.auth, body.ciphertext, body.version);
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
