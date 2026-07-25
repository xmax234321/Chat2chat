import { createHash, randomBytes } from 'node:crypto';
import {
  appendFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { config } from './config.js';
import { sendDevDownloadEmail, smtpConfigured } from './email.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_MS = 60_000;

interface DevToken {
  token: string;
  email: string;
  versionId: string;
  ipaFile: string;
  label: string;
  createdAt: number;
  expiresAt: number;
  usedAt?: number;
}

interface DevBuild {
  versionId: string;
  ipaFile: string;
  label: string;
}

const rateLimit = new Map<string, number>();

function tokensPath(): string {
  return join(config.dataDir, 'dev-download-tokens.json');
}

function auditPath(): string {
  return join(config.dataDir, 'dev-download-audit.jsonl');
}

function ensureDataDir(): void {
  mkdirSync(config.dataDir, { recursive: true });
}

function loadTokens(): DevToken[] {
  ensureDataDir();
  const path = tokensPath();
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as DevToken[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTokens(tokens: DevToken[]): void {
  ensureDataDir();
  writeFileSync(tokensPath(), `${JSON.stringify(tokens, null, 2)}\n`);
}

function appendAudit(entry: Record<string, unknown>): void {
  ensureDataDir();
  appendFileSync(auditPath(), `${JSON.stringify({ ...entry, at: Date.now() })}\n`);
}

function purgeExpiredTokens(tokens: DevToken[]): DevToken[] {
  const now = Date.now();
  return tokens.filter((t) => !t.usedAt && t.expiresAt > now);
}

function compareVersionIds(a: string, b: string): number {
  const pa = a.split('.').map((x) => Number.parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => Number.parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function listDevBuilds(): DevBuild[] {
  const dir = config.devBuildsDir;
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^Chat2Chat-dev-build-.+\.ipa$/.test(f))
    .map((f) => {
      const versionId = f.replace(/^Chat2Chat-dev-build-/, '').replace(/\.ipa$/, '');
      return { versionId, ipaFile: f, label: `dev build ${versionId}` };
    })
    .sort((a, b) => compareVersionIds(a.versionId, b.versionId));
}

function resolveBuild(versionId: string): DevBuild | undefined {
  const normalized = versionId.trim();
  return listDevBuilds().find((b) => b.versionId === normalized);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function registerDevDownloadRoutes(app: FastifyInstance): Promise<void> {
  const prefix = `${config.apiPrefix}/dev-download`;

  app.post(`${prefix}/request`, async (req, reply) => {
    const body = req.body as { email?: string; versionId?: string };
    const email = body.email?.trim().toLowerCase() ?? '';
    const versionId = body.versionId?.trim() ?? '';

    if (!EMAIL_RE.test(email)) {
      return reply.code(400).send({ error: 'Invalid email address' });
    }

    const build = resolveBuild(versionId);
    if (!build) {
      return reply.code(404).send({ error: 'Developer build not found' });
    }

    const rateKey = `${email}:${build.versionId}`;
    const last = rateLimit.get(rateKey) ?? 0;
    if (Date.now() - last < RATE_LIMIT_MS) {
      return reply.code(429).send({ error: 'Please wait before requesting another link for this build' });
    }
    rateLimit.set(rateKey, Date.now());

    const token = randomBytes(32).toString('base64url');
    const entry: DevToken = {
      token: hashToken(token),
      email,
      versionId: build.versionId,
      ipaFile: build.ipaFile,
      label: build.label,
      createdAt: Date.now(),
      expiresAt: Date.now() + config.devDownloadTokenTtlMs,
    };

    const tokens = purgeExpiredTokens(loadTokens());
    tokens.push(entry);
    saveTokens(tokens);

    const downloadUrl = `${config.apiPublicUrl}${prefix}/${token}`;
    let delivery: 'email' | 'console' = 'email';

    try {
      const sent = await sendDevDownloadEmail(email, build.label, downloadUrl);
      if (!sent) {
        delivery = 'console';
        console.info(`[dev-download] ${email} · ${build.label}: ${downloadUrl}`);
      }
    } catch (err) {
      console.error('[dev-download] SMTP failed:', err instanceof Error ? err.message : err);
      if (!smtpConfigured()) {
        delivery = 'console';
        console.info(`[dev-download] ${email} · ${build.label}: ${downloadUrl}`);
      } else {
        return reply.code(503).send({ error: 'Could not send email. Try again later.' });
      }
    }

    appendAudit({
      event: 'request',
      email,
      versionId: build.versionId,
      ipaFile: build.ipaFile,
      delivery,
    });

    return {
      sent: true,
      delivery,
      expiresInSec: Math.round(config.devDownloadTokenTtlMs / 1000),
      devDownloadUrl: delivery === 'console' ? downloadUrl : undefined,
    };
  });

  app.get(`${prefix}/:token`, async (req, reply) => {
    const { token } = req.params as { token: string };
    if (!token || token.length < 16) {
      return reply.code(400).send({ error: 'Invalid download link' });
    }

    const hashed = hashToken(token);
    const tokens = loadTokens();
    const idx = tokens.findIndex((t) => t.token === hashed);
    if (idx === -1) {
      return reply.code(404).send({ error: 'Download link not found or expired' });
    }

    const entry = tokens[idx]!;
    if (entry.usedAt) {
      return reply.code(410).send({ error: 'This download link has already been used' });
    }
    if (entry.expiresAt <= Date.now()) {
      return reply.code(410).send({ error: 'Download link expired' });
    }

    const ipaPath = join(config.devBuildsDir, entry.ipaFile);
    if (!existsSync(ipaPath)) {
      return reply.code(404).send({ error: 'Build file not found on server' });
    }

    entry.usedAt = Date.now();
    tokens[idx] = entry;
    saveTokens(tokens);

    appendAudit({
      event: 'download',
      email: entry.email,
      versionId: entry.versionId,
      ipaFile: entry.ipaFile,
    });

    reply.header('Content-Type', 'application/octet-stream');
    reply.header('Content-Disposition', `attachment; filename="${entry.ipaFile}"`);
    return reply.send(createReadStream(ipaPath));
  });
}
