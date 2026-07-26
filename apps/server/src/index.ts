import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { config } from './config.js';
import { registerApiRoutes } from './api.js';
import { registerBlobRoutes, flushExpiredBlobs, demoteAgedBlobsToDisk, initBlobStore } from './blob.js';
import { registerDevDownloadRoutes } from './dev-download.js';
import { flushExpiredMessages } from './store.js';
import { loadVaultStore } from './vault.js';
import { registerWebSocketRoutes } from './ws.js';

const app = Fastify({
  logger: true,
  // Fastify default is 1 MiB — must match blob upload limit.
  bodyLimit: config.maxBlobSize,
});

await app.register(cors, {
  origin: config.corsOrigin,
  methods: ['GET', 'PUT', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'X-Recipient-Id',
    'X-Sender-Id',
    'X-User-Id',
    'X-Timestamp',
    'X-Signature',
  ],
});

// Global baseline; tighten further per-route below for the endpoints most
// worth protecting from brute force / spam (vault + blob).
await app.register(rateLimit, {
  max: config.rateLimit.max,
  timeWindow: config.rateLimit.timeWindowMs,
});

await app.register(websocket);
await registerApiRoutes(app);
await registerDevDownloadRoutes(app);
await registerBlobRoutes(app);
await registerWebSocketRoutes(app);

setInterval(flushExpiredMessages, 60_000);
setInterval(flushExpiredBlobs, 60_000);
setInterval(demoteAgedBlobsToDisk, 60_000);

await loadVaultStore();
await initBlobStore();

try {
  await app.listen({ port: config.port, host: config.host });
  const base = `http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`;
  console.log(`Chat2Chat relay listening on ${base}`);
  console.log(`  API:        ${base}${config.apiPrefix}`);
  console.log(`  Health:     ${base}${config.apiPrefix}/health`);
  console.log(`  WebSocket:  ws://localhost:${config.port}/ws`);
  console.log(`  Blob:       ${base}/blob/:blobId`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
