function envBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

function parseCorsOrigin(value: string | undefined): boolean | string | string[] {
  if (value === undefined || value === '') return true;
  if (envBool(value, false)) return true;
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
  /** Max encrypted blob upload size (default 512 MiB). */
  maxBlobSize: Number(process.env.MAX_BLOB_SIZE ?? 512 * 1024 * 1024),
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
  apiPrefix: '/api/v1',
  dataDir: process.env.DATA_DIR ?? './data',
  siteUrl: process.env.SITE_URL ?? 'https://chat2chat.org',
  apiPublicUrl: process.env.API_PUBLIC_URL ?? 'https://api.chat2chat.org',
  /** Reject relay clients below this version (security baseline). */
  minClientVersion: process.env.MIN_CLIENT_VERSION ?? '1.5',
  minClientBuild: process.env.MIN_CLIENT_BUILD ?? '52',
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
