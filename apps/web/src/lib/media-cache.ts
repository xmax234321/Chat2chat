import { isCapacitor } from './platform';

const DB_NAME = 'chat2chat-media-v1';
const STORE = 'blobs';
const FS_DIR = 'chat2chat-media';

/** Bump when disk cache changes so UI can reload previews. */
let cacheRevision = 0;
const cacheListeners = new Set<() => void>();

export function subscribeMediaCacheUpdates(listener: () => void): () => void {
  cacheListeners.add(listener);
  return () => cacheListeners.delete(listener);
}

function notifyMediaCacheUpdated(): void {
  cacheRevision += 1;
  for (const listener of cacheListeners) listener();
}

export function mediaCacheRevision(): number {
  return cacheRevision;
}

interface CachedBlob {
  messageId: string;
  mime: string;
  data: ArrayBuffer;
}

export interface CachedMediaEntry {
  messageId: string;
  mime: string;
  data: Uint8Array;
}

export interface CachedNativeRef {
  messageId: string;
  mime: string;
  uri: string;
  size: number;
}

/** MIME type iOS WKWebView can play in <video>. */
export function normalizePlaybackMime(mime: string): string {
  const base = mime.split(';')[0]?.trim().toLowerCase() ?? mime;
  if (base === 'video/quicktime' || base === 'video/x-m4v') return 'video/mp4';
  return base || 'video/mp4';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
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

function fsPaths(messageId: string): { bin: string; meta: string } {
  const safe = messageId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return { bin: `${FS_DIR}/${safe}.bin`, meta: `${FS_DIR}/${safe}.json` };
}

async function readNativeFsMeta(messageId: string): Promise<CachedNativeRef | null> {
  if (!isCapacitor()) return null;
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  const { bin, meta } = fsPaths(messageId);
  try {
    const metaRes = await Filesystem.readFile({
      path: meta,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    const parsed = JSON.parse(metaRes.data as string) as { mime?: string; messageId?: string };
    const stat = await Filesystem.stat({ path: bin, directory: Directory.Data });
    if (!stat.size) return null;
    return {
      messageId: parsed.messageId ?? messageId,
      mime: parsed.mime ?? 'application/octet-stream',
      uri: stat.uri,
      size: stat.size,
    };
  } catch {
    return null;
  }
}

async function readNativeFs(messageId: string): Promise<CachedMediaEntry | null> {
  const ref = await readNativeFsMeta(messageId);
  if (!ref) return null;
  try {
    const { readNativePickBytes } = await import('./read-native-file');
    const data = await readNativePickBytes(ref.uri, { expectedSize: ref.size });
    if (!data.length) return null;
    return { messageId: ref.messageId, mime: ref.mime, data };
  } catch {
    return null;
  }
}

/** Native file on disk — no byte copy through JS bridge. */
export async function readCachedNativeRef(messageId: string): Promise<CachedNativeRef | null> {
  return readNativeFsMeta(messageId);
}

const NATIVE_CACHE_CHUNK = 262_144;
const PERSIST_MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function nativeCacheSize(messageId: string): Promise<number> {
  if (!isCapacitor()) return 0;
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { bin } = fsPaths(messageId);
  try {
    const stat = await Filesystem.stat({ path: bin, directory: Directory.Data });
    return stat.size ?? 0;
  } catch {
    return 0;
  }
}

async function isCacheValid(messageId: string, expectedSize?: number): Promise<boolean> {
  const fromIdb = await readIdb(messageId);
  if (fromIdb?.data.length) {
    if (!expectedSize || fromIdb.data.length === expectedSize) return true;
  }
  const fsSize = await nativeCacheSize(messageId);
  if (fsSize > 0) {
    if (!expectedSize || fsSize === expectedSize) return true;
  }
  return false;
}

async function persistNativeFromPath(
  messageId: string,
  path: string,
  mime: string,
): Promise<boolean> {
  if (!isCapacitor()) return false;
  try {
    const { PhotoGallery } = await import('./native-photo-gallery');
    const result = await PhotoGallery.persistMedia({
      path: path.replace(/^file:\/\//, ''),
      messageId,
      mime,
    });
    return Boolean(result.ok && (result.size ?? 0) > 0);
  } catch {
    return false;
  }
}

async function persistNativeChunked(
  messageId: string,
  data: Uint8Array,
  mime: string,
): Promise<boolean> {
  if (!isCapacitor()) return false;
  try {
    const { PhotoGallery } = await import('./native-photo-gallery');
    let offset = 0;
    while (offset < data.length) {
      const part = data.subarray(offset, offset + NATIVE_CACHE_CHUNK);
      const complete = offset + part.length >= data.length;
      await PhotoGallery.persistMediaChunk({
        messageId,
        base64: bytesToBase64(part),
        offset,
        ...(offset === 0 ? { mime } : {}),
        complete,
      });
      offset += part.length;
    }
    const size = await nativeCacheSize(messageId);
    return size > 0 && size === data.length;
  } catch {
    return false;
  }
}

async function persistIdb(messageId: string, data: Uint8Array, mime: string): Promise<boolean> {
  try {
    await writeIdb(messageId, data, mime);
    const entry = await readIdb(messageId);
    return Boolean(entry?.data.length === data.length);
  } catch {
    return false;
  }
}

export type PersistMediaOptions = {
  messageId: string;
  mime: string;
  data?: Uint8Array;
  nativePath?: string;
  expectedSize?: number;
};

/** Photo/video MIME types kept as raw decrypted bytes on device. */
export function isPhotoOrVideoMime(mime: string): boolean {
  const base = mime.split(';')[0]?.trim().toLowerCase() ?? mime;
  return base.startsWith('image/') || base.startsWith('video/');
}

/** Durable local copy — native file + IndexedDB, with verify and retries. */
export async function persistOutgoingMedia(options: PersistMediaOptions): Promise<void> {
  const { messageId, mime, data, nativePath, expectedSize } = options;
  const size = expectedSize ?? data?.length ?? 0;

  if (await isCacheValid(messageId, size || undefined)) return;

  let lastError: unknown;
  for (let attempt = 0; attempt < PERSIST_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(250 * attempt);

    const wins: boolean[] = [];

    if (isCapacitor() && nativePath) {
      wins.push(await persistNativeFromPath(messageId, nativePath, mime));
    }
    if (data?.length) {
      wins.push(await persistIdb(messageId, data, mime));
      if (isCapacitor()) {
        wins.push(await persistNativeChunked(messageId, data, mime));
      }
    }

    if (wins.some(Boolean) && (await isCacheValid(messageId, size || undefined))) {
      notifyMediaCacheUpdated();
      return;
    }
    lastError = new Error('Cache verify failed');
  }

  throw lastError instanceof Error ? lastError : new Error('Could not save media locally');
}

/** Copy a native picked file into durable cache (no JS bridge for file bytes). */
export async function cacheMediaFromNativePath(
  messageId: string,
  path: string,
  mime: string,
): Promise<void> {
  await persistOutgoingMedia({ messageId, mime, nativePath: path });
}

async function deleteNativeFs(messageId: string): Promise<void> {
  if (!isCapacitor()) return;
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { bin, meta } = fsPaths(messageId);
  for (const path of [bin, meta]) {
    try {
      await Filesystem.deleteFile({ path, directory: Directory.Data });
    } catch {
      /* already gone */
    }
  }
}

async function writeIdb(messageId: string, data: Uint8Array, mime: string): Promise<void> {
  if (!('indexedDB' in globalThis)) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error('cache write failed'));
    const entry: CachedBlob = {
      messageId,
      mime,
      data: data.slice().buffer,
    };
    tx.objectStore(STORE).put(entry);
  });
}

async function readIdb(messageId: string): Promise<CachedMediaEntry | null> {
  if (!('indexedDB' in globalThis)) return null;
  const db = await openDb();
  const entry = await new Promise<CachedBlob | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(messageId);
    req.onsuccess = () => resolve(req.result as CachedBlob | undefined);
    req.onerror = () => reject(req.error ?? new Error('cache read failed'));
    tx.oncomplete = () => db.close();
  });
  if (!entry?.data) return null;
  return {
    messageId: entry.messageId,
    mime: entry.mime,
    data: new Uint8Array(entry.data),
  };
}

/** Copy legacy IndexedDB blobs into durable app storage on iOS. */
export async function migrateMediaCacheToNativeFs(): Promise<void> {
  if (!isCapacitor() || !('indexedDB' in globalThis)) return;
  const db = await openDb();
  const ids = await new Promise<string[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAllKeys();
    req.onsuccess = () => resolve((req.result as string[]) ?? []);
    req.onerror = () => reject(req.error ?? new Error('cache read failed'));
    tx.oncomplete = () => db.close();
  });

  for (const messageId of ids) {
    const existing = await readNativeFsMeta(messageId);
    if (existing?.size) continue;
    const fromIdb = await readIdb(messageId);
    if (fromIdb?.data.length) {
      try {
        await persistNativeChunked(messageId, fromIdb.data, fromIdb.mime);
        notifyMediaCacheUpdated();
      } catch {
        /* keep IDB copy */
      }
    }
  }
  notifyMediaCacheUpdated();
}

/**
 * Save decrypted photo/video bytes on device (raw file + IndexedDB).
 * Server blobs stay encrypted — only local cache is plaintext.
 */
export async function cacheDecryptedMedia(
  messageId: string,
  data: Uint8Array,
  mime: string,
): Promise<void> {
  const bytes = data.slice();
  if (isPhotoOrVideoMime(mime)) {
    await persistOutgoingMedia({ messageId, mime, data: bytes, expectedSize: bytes.length });
    notifyMediaCacheUpdated();
    return;
  }
  await writeIdb(messageId, bytes, mime);
  if (isCapacitor()) {
    try {
      await persistNativeChunked(messageId, bytes, mime);
      notifyMediaCacheUpdated();
    } catch {
      /* IndexedDB copy remains */
    }
  }
}

/** @alias cacheDecryptedMedia */
export async function cacheMediaBlob(messageId: string, data: Uint8Array, mime: string): Promise<void> {
  return cacheDecryptedMedia(messageId, data, mime);
}

export async function readCachedMediaBytes(messageId: string): Promise<CachedMediaEntry | null> {
  if (isCapacitor()) {
    const fromFs = await readNativeFs(messageId);
    if (fromFs) return fromFs;
  }
  return readIdb(messageId);
}

export async function readCachedMediaUrl(messageId: string): Promise<string | null> {
  const entry = await readCachedMediaBytes(messageId);
  if (!entry?.data.length) return null;
  return URL.createObjectURL(new Blob([entry.data.slice()], { type: entry.mime }));
}

export async function readAllCachedMedia(): Promise<CachedMediaEntry[]> {
  const entries: CachedMediaEntry[] = [];
  for await (const entry of iterateCachedMedia()) {
    entries.push(entry);
  }
  return entries;
}

export async function* iterateCachedMedia(): AsyncGenerator<CachedMediaEntry> {
  const seen = new Set<string>();

  if (isCapacitor()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    try {
      const listing = await Filesystem.readdir({ path: FS_DIR, directory: Directory.Data });
      for (const file of listing.files) {
        if (!file.name.endsWith('.json')) continue;
        try {
          const metaRes = await Filesystem.readFile({
            path: `${FS_DIR}/${file.name}`,
            directory: Directory.Data,
            encoding: Encoding.UTF8,
          });
          const parsed = JSON.parse(metaRes.data as string) as { mime?: string; messageId?: string };
          const messageId = parsed.messageId;
          if (!messageId || seen.has(messageId)) continue;
          const entry = await readNativeFs(messageId);
          if (entry?.data.length) {
            seen.add(messageId);
            yield entry;
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
          }
        } catch {
          /* skip broken entry */
        }
      }
    } catch {
      /* no fs cache yet */
    }
  }

  if (!('indexedDB' in globalThis)) return;
  const db = await openDb();
  let ids: string[];
  try {
    ids = await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve((req.result as string[]) ?? []);
      req.onerror = () => reject(req.error ?? new Error('cache read failed'));
    });
  } finally {
    db.close();
  }

  for (const id of ids) {
    if (seen.has(id)) continue;
    const entry = await readIdb(id);
    if (entry?.data.length) {
      seen.add(id);
      yield entry;
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
}

export async function deleteCachedMediaBlobs(messageIds: string[]): Promise<void> {
  if (!messageIds.length) return;
  for (const id of messageIds) {
    await deleteNativeFs(id);
  }
  if (!('indexedDB' in globalThis)) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error('cache delete failed'));
    const store = tx.objectStore(STORE);
    for (const id of messageIds) store.delete(id);
  });
}

export async function importMediaCache(entries: CachedMediaEntry[]): Promise<void> {
  for (const entry of entries) {
    if (!entry.data.length) continue;
    await cacheMediaBlob(entry.messageId, entry.data, entry.mime);
  }
}

/** Remove all cached media blobs from device storage (not backups folder). */
export async function clearAllMediaCache(): Promise<void> {
  if (isCapacitor()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    try {
      await Filesystem.rmdir({ path: FS_DIR, directory: Directory.Data, recursive: true });
    } catch {
      /* folder may not exist */
    }
  }

  if (!('indexedDB' in globalThis)) {
    notifyMediaCacheUpdated();
    return;
  }

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error('cache clear failed'));
    tx.objectStore(STORE).clear();
  });
  notifyMediaCacheUpdated();
}
