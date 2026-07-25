import { encryptAesGcm } from './nonce.js';
import { toArrayBuffer } from './types.js';

export type WorkerEncryptTask = {
  id: number;
  index: number;
  nonce: Uint8Array;
  plaintext: Uint8Array;
};

export type WorkerEncryptResult = {
  id: number;
  index: number;
  ciphertext: Uint8Array;
  authTag: Uint8Array;
};

type WorkerRequest =
  | { type: 'init'; fileKey: ArrayBuffer }
  | { type: 'encrypt'; task: WorkerEncryptTask & { plaintext: ArrayBuffer; nonce: ArrayBuffer } };

type WorkerDoneResult = {
  id: number;
  index: number;
  ciphertext: ArrayBuffer;
  authTag: ArrayBuffer;
};

type WorkerResponse =
  | { type: 'ready' }
  | { type: 'done'; result: WorkerDoneResult }
  | { type: 'error'; id: number; message: string };

let aesKey: CryptoKey | null = null;

async function onInit(fileKey: ArrayBuffer): Promise<void> {
  aesKey = await crypto.subtle.importKey('raw', fileKey, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
  ]);
}

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  void (async () => {
    const msg = ev.data;
    if (msg.type === 'init') {
      await onInit(msg.fileKey);
      (self as DedicatedWorkerGlobalScope).postMessage({ type: 'ready' } satisfies WorkerResponse);
      return;
    }

    if (!aesKey) throw new Error('Worker not initialized');
    const { id, index, nonce, plaintext } = msg.task;
    try {
      const { ciphertext, authTag } = await encryptAesGcm(
        aesKey,
        new Uint8Array(nonce),
        new Uint8Array(plaintext),
      );
      const ciphertextBuf = toArrayBuffer(ciphertext);
      const authTagBuf = toArrayBuffer(authTag);
      const done: Extract<WorkerResponse, { type: 'done' }> = {
        type: 'done',
        result: {
          id,
          index,
          ciphertext: ciphertextBuf,
          authTag: authTagBuf,
        },
      };
      (self as DedicatedWorkerGlobalScope).postMessage(done, [ciphertextBuf, authTagBuf]);
    } catch (e) {
      const err: WorkerResponse = {
        type: 'error',
        id,
        message: e instanceof Error ? e.message : String(e),
      };
      (self as DedicatedWorkerGlobalScope).postMessage(err);
    }
  })();
};

export type {};
