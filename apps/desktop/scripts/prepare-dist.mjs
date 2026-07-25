import { cpSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDist = path.resolve(root, '../web/dist');
const target = path.resolve(root, 'web-dist');

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(webDist, target, { recursive: true });
console.log('Copied web build → apps/desktop/web-dist');
