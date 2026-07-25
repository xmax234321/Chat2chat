import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const websiteRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(websiteRoot, '../..');
const dist = join(websiteRoot, 'dist');
const landing = join(repoRoot, 'deploy/landing');

if (!existsSync(join(dist, 'index.html'))) {
  console.error('Run vite build first: pnpm --filter @chat2chat/website build');
  process.exit(1);
}

const preserve = new Set(['download', 'downloads', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png']);

for (const name of readdirSync(landing)) {
  if (preserve.has(name)) continue;
  rmSync(join(landing, name), { recursive: true, force: true });
}

for (const name of readdirSync(dist)) {
  cpSync(join(dist, name), join(landing, name), { recursive: true });
}

for (const icon of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png']) {
  const src = join(landing, icon);
  if (!existsSync(src)) {
    const fallback = join(repoRoot, 'deploy/landing', icon);
    if (existsSync(fallback)) cpSync(fallback, src);
  }
}

console.log('Synced website build → deploy/landing/');
