function envBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

function parseCorsOrigin(value: string | undefined): boolean | string | string[] {
  // No env override: fall back to an explicit whitelist rather than
  // reflecting any Origin. Pass CORS_ORIGIN=* to explicitly opt into "any".
  if (value === undefined || value === '') {
    return ['https://chat2chat.org', 'https://app.chat2chat.org', 'capacitor://localhost'];
  }
  if (value === '*') return true;
  if (value === '0' || value.toLowerCase() === 'false') return false;
  if (value.includes(',')) {
    return value.split(',').map((part) => part.trim()).filter(Boolean);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3847),
  host: process.env.HOST ?? '0.0.0.0',
  messageTtlMs: Number(process.env.MESSAGE_TTL_MS ?? 86_400_000),
  blobTtlMs: Number(process.env.BLOB_TTL_MS ?? 86_400_000),
  /**
   * Max encrypted blob upload size. Fastify buffers the whole request body
   * in RAM before the handler runs (bodyLimit === maxBlobSize below), so on
   * a small VPS this must stay well under total available memory even
   * before the memory/disk tiering kicks in. Default lowered from the
   * previous 512 MiB to 100 MiB — raise via env only if the box has RAM
   * to spare.
   */
  maxBlobSize: Number(process.env.MAX_BLOB_SIZE ?? 100 * 1024 * 1024),
  /** How long a freshly uploaded blob stays in RAM before being spilled to disk. */
  blobMemoryTtlMs: Number(process.env.BLOB_MEMORY_TTL_MS ?? 12 * 60 * 1000),
  /**
   * Total RAM budget for in-flight blob bytes. Once exceeded, the oldest
   * in-memory blobs are pushed to disk immediately (LRU-style), regardless
   * of blobMemoryTtlMs. Default 256 MiB — sized for a ~2 GiB box, leaving
   * headroom for Node itself, OS, and other processes.
   */
  blobMemoryBudgetBytes: Number(process.env.BLOB_MEMORY_BUDGET_MB ?? 256) * 1024 * 1024,
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
  rateLimit: {
    max: Number(process.env.RATE_LIMIT_MAX ?? 100),
    timeWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  },
  apiPrefix: '/api/v1',
  dataDir: process.env.DATA_DIR ?? './data',
  /** Overflow directory for blobs demoted from RAM (or too large to fit the memory budget). */
  blobsDir: process.env.BLOBS_DIR ?? './data/blobs',
  siteUrl: process.env.SITE_URL ?? 'https://chat2chat.org',
  apiPublicUrl: process.env.API_PUBLIC_URL ?? 'https://api.chat2chat.org',
  /** Reject relay clients below this version (security baseline). */
  minClientVersion: process.env.MIN_CLIENT_VERSION ?? '1.5.3',
  minClientBuild: process.env.MIN_CLIENT_BUILD ?? '57',
  enforceMinClientVersion: envBool(process.env.ENFORCE_MIN_CLIENT_VERSION, true),
  devBuildsDir: process.env.DEV_BUILDS_DIR ?? './dev-ipas',
  devDownloadTokenTtlMs: Number(process.env.DEV_DOWNLOAD_TOKEN_TTL_MS ?? 3_600_000),
  smtp: {
    host: process.env.SMTP_HOST ?? 'smtp.mail.ru',
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: envBool(process.env.SMTP_SECURE, true),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'no-reply@chat2chat.org',
    get enabled(): boolean {
      return Boolean(config.smtp.user && config.smtp.pass);
    },
  },
} as const;
