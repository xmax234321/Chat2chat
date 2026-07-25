import { Capacitor } from '@capacitor/core';
import { isCapacitor } from './platform';
import { isVideoFramePreview } from './media-thumbnail';

const DB_NAME = 'chat2chat-video-thumbs-v1';
const STORE = 'thumbs';
const FS_DIR = 'chat2chat-media-thumbs';

let thumbRevision = 0;
const thumbListeners = new Set<() => void>();

export function subscribeVideoThumbCacheUpdates(listener: () => void): () => void {
  thumbListeners.add(listener);
  return () => thumbListeners.delete(listener);
}

export function videoThumbCacheRevision(): number {
  return thumbRevision;
}

function notifyThumbCacheUpdated(): void {
  thumbRevision += 1;
  for (const listener of thumbListeners) listener();
}

function thumbPaths(messageId: string): { bin: string; meta: string } {
  const safe = messageId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return { bin: `${FS_DIR}/${safe}.jpg`, meta: `${FS_DIR}/${safe}.json` };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error ?? new Error('thumb DB open failed'));
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'messageId' });
    };
    req.onsuccess = () => resolve(req.result);
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function writeIdb(messageId: string, data: Uint8Array): Promise<void> {
  if (!('indexedDB' in globalThis)) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error('thumb write failed'));
    tx.objectStore(STORE).put({
      messageId,
      mime: 'image/jpeg',
      data: data.slice().buffer,
    });
  });
}

async function readIdb(messageId: string): Promise<Uint8Array | null> {
  if (!('indexedDB' in globalThis)) return null;
  const db = await openDb();
  const entry = await new Promise<{ data?: ArrayBuffer } | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(messageId);
    req.onsuccess = () => resolve(req.result as { data?: ArrayBuffer } | undefined);
    req.onerror = () => reject(req.error ?? new Error('thumb read failed'));
    tx.oncomplete = () => db.close();
  });
  if (!entry?.data) return null;
  return new Uint8Array(entry.data);
}

async function writeNativeFs(messageId: string, data: Uint8Array): Promise<string | null> {
  if (!isCapacitor()) return null;
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  const { bin, meta } = thumbPaths(messageId);
  try {
    await Filesystem.writeFile({
      path: bin,
      data: bytesToBase64(data),
      directory: Directory.Data,
      recursive: true,
    });
    await Filesystem.writeFile({
      path: meta,
      data: JSON.stringify({ messageId, mime: 'image/jpeg' }),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    const { uri } = await Filesystem.getUri({ path: bin, directory: Directory.Data });
    return uri;
  } catch {
    return null;
  }
}

async function readNativeFsUrl(messageId: string): Promise<string | null> {
  if (!isCapacitor()) return null;
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { bin } = thumbPaths(messageId);
  try {
    const stat = await Filesystem.stat({ path: bin, directory: Directory.Data });
    if (!stat.size) return null;
    return stat.uri;
  } catch {
    return null;
  }
}

/** Persist a JPEG thumbnail separately from the video file. */
export async function cacheVideoThumb(messageId: string, jpeg: Uint8Array): Promise<void> {
  if (!jpeg.length) return;
  const bytes = jpeg.slice();
  await writeIdb(messageId, bytes);
  await writeNativeFs(messageId, bytes);
  notifyThumbCacheUpdated();
}

/** Save thumb from a display URL (blob, capacitor, data URL). */
export async function cacheVideoThumbFromUrl(messageId: string, url: string): Promise<void> {
  if (!url || url.startsWith('data:image/png')) return;

  if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/webp')) {
    const comma = url.indexOf(',');
    if (comma < 0) return;
    const b64 = url.slice(comma + 1);
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    await cacheVideoThumb(messageId, bytes);
    return;
  }

  if (isCapacitor() && (url.includes('_capacitor_file_') || url.startsWith('capacitor://'))) {
    const fsPath = url.replace(/^capacitor:\/\/[^/]+\/_capacitor_file_\//, '').replace(/^file:\/\//, '');
    if (fsPath) {
      try {
        const { readNativePickBytes } = await import('./read-native-file');
        const bytes = await readNativePickBytes(fsPath);
        if (bytes.length) await cacheVideoThumb(messageId, bytes);
      } catch {
        /* ignore */
      }
    }
    return;
  }

  if (url.startsWith('blob:')) {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const buf = await res.arrayBuffer();
      if (buf.byteLength) await cacheVideoThumb(messageId, new Uint8Array(buf));
    } catch {
      /* ignore */
    }
  }
}

/** Read cached video thumb as a display URL — no video decode required. */
export async function readCachedVideoThumbUrl(messageId: string): Promise<string | null> {
  const nativeUri = await readNativeFsUrl(messageId);
  if (nativeUri) {
    const fsPath = nativeUri.replace(/^file:\/\//, '');
    return Capacitor.convertFileSrc(fsPath);
  }

  const fromIdb = await readIdb(messageId);
  if (fromIdb?.length) {
    return URL.createObjectURL(new Blob([fromIdb.slice()], { type: 'image/jpeg' }));
  }

  return null;
}

export async function deleteCachedVideoThumbs(messageIds: string[]): Promise<void> {
  if (!messageIds.length) return;

  if (isCapacitor()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    for (const messageId of messageIds) {
      const { bin, meta } = thumbPaths(messageId);
      for (const path of [bin, meta]) {
        try {
          await Filesystem.deleteFile({ path, directory: Directory.Data });
        } catch {
          /* gone */
        }
      }
    }
  }

  if ('indexedDB' in globalThis) {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error ?? new Error('thumb delete failed'));
      const store = tx.objectStore(STORE);
      for (const id of messageIds) store.delete(id);
    });
  }

  notifyThumbCacheUpdated();
}

/** Store a generated frame preview for later — independent of the video file. */
export async function persistVideoThumbPreview(messageId: string, thumb: string | undefined): Promise<void> {
  if (!isVideoFramePreview(thumb)) return;
  await cacheVideoThumbFromUrl(messageId, thumb!);
}
