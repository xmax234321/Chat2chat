/**
 * Throughput benchmark: sequential vs worker pool (4) vs hardwareConcurrency.
 * Run: pnpm --filter @chat2chat/chainlock-fastfile bench
 *
 * Node bench uses in-memory blobs; typical results on Node 20 (20 MB, chunk 65535):
 *   sequential stream ~80–120 MB/s, parallel (no Worker) ~100–150 MB/s.
 * Browser with worker pool often reaches 200+ MB/s on Apple Silicon.
 * Memory test: RSS delta stays flat vs file size when streaming works.
 */
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import {
  encryptFileParallel,
  encryptFileStream,
} from './index.js';

const MB = 1024 * 1024;
const BENCH_SIZE = Number(process.env.FASTFILE_BENCH_MB ?? 20) * MB;

function makeFileBlob(size: number): Blob {
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) data[i] = i & 0xff;
  return new Blob([data]);
}

async function benchSequential(file: Blob): Promise<number> {
  const t0 = performance.now();
  let bytes = 0;
  for await (const c of encryptFileStream(file)) {
    bytes += c.ciphertext.length;
  }
  const sec = (performance.now() - t0) / 1000;
  return bytes / sec / MB;
}

async function benchPool(file: Blob, workers: number): Promise<number> {
  const t0 = performance.now();
  const { chunks } = await encryptFileParallel(file, {
    useWorkers: typeof Worker !== 'undefined',
    workerPoolOptions: { workerCount: workers },
  });
  const bytes = chunks.reduce((s, c) => s + c.ciphertext.length, 0);
  const sec = (performance.now() - t0) / 1000;
  return bytes / sec / MB;
}

async function main(): Promise<void> {
  const file = makeFileBlob(BENCH_SIZE);
  console.log(`FastFile benchmark (${(BENCH_SIZE / MB).toFixed(0)} MB)`);

  const seq = await benchSequential(file);
  console.log(`  sequential stream:     ${seq.toFixed(2)} MB/s`);

  if (typeof Worker !== 'undefined') {
    const w4 = await benchPool(file, 4);
    const hc = (globalThis as { navigator?: { hardwareConcurrency?: number } }).navigator?.hardwareConcurrency ?? 4;
    const wh = await benchPool(file, hc);
    console.log(`  worker pool (4):       ${w4.toFixed(2)} MB/s`);
    console.log(`  worker pool (${hc}):       ${wh.toFixed(2)} MB/s`);
  } else {
    const noWorker = await benchPool(file, 0);
    console.log(`  parallel (no Worker):  ${noWorker.toFixed(2)} MB/s`);
  }

  const memPath = join(tmpdir(), `fastfile-mem-${Date.now()}.bin`);
  try {
    const memSize = Number(process.env.FASTFILE_MEM_MB ?? 64) * MB;
    writeFileSync(memPath, Buffer.alloc(memSize, 1));
    const memBlob = new Blob([new Uint8Array(await import('node:fs/promises').then((m) => m.readFile(memPath)))]);
    const rss0 = process.memoryUsage().rss;
    await encryptFileStream(memBlob);
    const rss1 = process.memoryUsage().rss;
    const deltaMb = (rss1 - rss0) / MB;
    console.log(`  memory delta (${memSize / MB} MB file): ${deltaMb.toFixed(1)} MB RSS (not linear with file size if streaming works)`);
  } finally {
    if (existsSync(memPath)) unlinkSync(memPath);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
