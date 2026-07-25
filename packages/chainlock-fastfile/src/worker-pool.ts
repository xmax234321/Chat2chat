import type { WorkerEncryptResult } from './aes-worker.js';

type QueueItem = {
  id: number;
  index: number;
  nonce: Uint8Array;
  plaintext: Uint8Array;
  resolve: (r: WorkerEncryptResult) => void;
  reject: (e: Error) => void;
};

export interface WorkerPoolOptions {
  workerCount?: number;
  workerUrl?: string | URL;
  createWorker?: () => Worker;
}

function defaultWorkerCount(): number {
  if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
    return Math.min(4, Math.max(2, navigator.hardwareConcurrency));
  }
  return 2;
}

function resolveDefaultWorkerUrl(): URL {
  return new URL('./aes-worker.js', import.meta.url);
}

async function spawnWorker(url: string | URL, fileKey: Uint8Array): Promise<Worker> {
  const worker = new Worker(url, { type: 'module' });
  return initWorker(worker, fileKey);
}

async function initWorker(worker: Worker, fileKey: Uint8Array): Promise<Worker> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Worker init timeout')), 30_000);
    worker.onmessage = (ev) => {
      if (ev.data?.type === 'ready') {
        clearTimeout(timer);
        resolve(worker);
      }
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      reject(e);
    };
    const keyBuf = fileKey.buffer.slice(fileKey.byteOffset, fileKey.byteOffset + fileKey.byteLength);
    worker.postMessage({ type: 'init', fileKey: keyBuf }, [keyBuf]);
  });
}

/** Pool of AES-GCM encrypt workers with a shared task queue. */
export class WorkerPool {
  private readonly idle = new Set<Worker>();
  private readonly pendingById = new Map<
    number,
    { resolve: (r: WorkerEncryptResult) => void; reject: (e: Error) => void }
  >();
  private readonly queue: QueueItem[] = [];
  private nextTaskId = 0;
  private closed = false;

  private readonly activeTask = new Map<Worker, number>();

  private constructor(private readonly workers: Worker[]) {
    for (const w of workers) {
      this.idle.add(w);
      this.wireWorker(w);
    }
  }

  static async create(fileKey: Uint8Array, options: WorkerPoolOptions = {}): Promise<WorkerPool> {
    if (typeof Worker === 'undefined') {
      return new WorkerPool([]);
    }
    const count = options.workerCount ?? defaultWorkerCount();
    const workers = await Promise.all(
      Array.from({ length: count }, () => {
        if (options.createWorker) {
          return initWorker(options.createWorker(), fileKey);
        }
        const workerUrl = options.workerUrl ?? resolveDefaultWorkerUrl();
        return spawnWorker(workerUrl, fileKey);
      }),
    );
    return new WorkerPool(workers);
  }

  encryptChunk(index: number, nonce: Uint8Array, plaintext: Uint8Array): Promise<WorkerEncryptResult> {
    if (this.closed) return Promise.reject(new Error('Worker pool closed'));
    const id = this.nextTaskId++;
    return new Promise((resolve, reject) => {
      this.queue.push({ id, index, nonce, plaintext, resolve, reject });
      this.drain();
    });
  }

  close(): void {
    this.closed = true;
    for (const w of this.workers) w.terminate();
    this.idle.clear();
    for (const item of this.queue) item.reject(new Error('Worker pool closed'));
    this.queue.length = 0;
  }

  get size(): number {
    return this.workers.length;
  }

  private wireWorker(worker: Worker): void {
    worker.onmessage = (ev: MessageEvent) => {
      const data = ev.data as
        | { type: 'done'; result: WorkerEncryptResult & { ciphertext: ArrayBuffer; authTag: ArrayBuffer } }
        | { type: 'error'; id: number; message: string };

      this.idle.add(worker);
      this.activeTask.delete(worker);
      if (data.type === 'error') {
        const pending = this.pendingById.get(data.id);
        this.pendingById.delete(data.id);
        pending?.reject(new Error(data.message));
      } else {
        const pending = this.pendingById.get(data.result.id);
        this.pendingById.delete(data.result.id);
        pending?.resolve({
          id: data.result.id,
          index: data.result.index,
          ciphertext: new Uint8Array(data.result.ciphertext),
          authTag: new Uint8Array(data.result.authTag),
        });
      }
      this.drain();
    };
    worker.onerror = () => {
      const taskId = this.activeTask.get(worker);
      this.activeTask.delete(worker);
      if (taskId != null) {
        const pending = this.pendingById.get(taskId);
        this.pendingById.delete(taskId);
        pending?.reject(new Error('Worker failed'));
      }
      this.idle.add(worker);
      this.drain();
    };
  }

  private drain(): void {
    while (this.queue.length > 0 && this.idle.size > 0) {
      const worker = this.idle.values().next().value as Worker;
      const task = this.queue.shift()!;
      this.idle.delete(worker);
      this.pendingById.set(task.id, { resolve: task.resolve, reject: task.reject });
      this.activeTask.set(worker, task.id);

      const plainBuf = task.plaintext.buffer.slice(
        task.plaintext.byteOffset,
        task.plaintext.byteOffset + task.plaintext.byteLength,
      );
      const nonceBuf = task.nonce.buffer.slice(
        task.nonce.byteOffset,
        task.nonce.byteOffset + task.nonce.byteLength,
      );

      worker.postMessage(
        {
          type: 'encrypt',
          task: { id: task.id, index: task.index, nonce: nonceBuf, plaintext: plainBuf },
        },
        [plainBuf],
      );
    }
  }
}
