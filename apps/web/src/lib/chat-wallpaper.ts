const IDB_NAME = 'chat2chat-wallpaper-v1';
const STORE = 'wallpaper';
const KEY = 'settings';

export type ChatWallpaperSettings = {
  imageDataUrl: string;
  blur: number;
  /** Background for chat header + composer when wallpaper is active. */
  chromeColor: string;
};

const DEFAULT: ChatWallpaperSettings = {
  imageDataUrl: '',
  blur: 12,
  chromeColor: '#0b0b0c',
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onerror = () => reject(req.error ?? new Error('wallpaper db failed'));
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
  });
}

export async function loadChatWallpaper(): Promise<ChatWallpaperSettings> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const raw = await new Promise<ChatWallpaperSettings | undefined>((resolve, reject) => {
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result as ChatWallpaperSettings | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!raw?.imageDataUrl) return { ...DEFAULT };
    return {
      imageDataUrl: raw.imageDataUrl,
      blur: typeof raw.blur === 'number' ? Math.min(40, Math.max(0, raw.blur)) : DEFAULT.blur,
      chromeColor:
        typeof raw.chromeColor === 'string' && raw.chromeColor.trim()
          ? raw.chromeColor.trim()
          : DEFAULT.chromeColor,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export async function saveChatWallpaper(settings: ChatWallpaperSettings): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(settings, KEY);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  window.dispatchEvent(new Event('chat-wallpaper-change'));
}

export async function clearChatWallpaper(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(KEY);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  window.dispatchEvent(new Event('chat-wallpaper-change'));
}

export function subscribeChatWallpaper(listener: () => void): () => void {
  window.addEventListener('chat-wallpaper-change', listener);
  return () => window.removeEventListener('chat-wallpaper-change', listener);
}

/** Downscale large uploads before persisting locally. */
export async function normalizeWallpaperFile(file: File, maxSide = 1400): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process image');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.88);
}
