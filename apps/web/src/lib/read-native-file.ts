import { isCapacitor } from './platform';

/** Single bridge read — fine for typical phone videos (≤48 MB). */
const SINGLE_READ_MAX_BYTES = 48 * 1024 * 1024;
/** Chunk size when single read is unavailable (base64 ~1.33× over wire). */
const CHUNK_BYTES = 1024 * 1024;

function mergeParts(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function readNativePickChunked(
  path: string,
  chunkBytes = CHUNK_BYTES,
  onProgress?: (pct: number) => void,
): Promise<Uint8Array> {
  const { PhotoGallery } = await import('./native-photo-gallery');
  const normalized = path.replace(/^file:\/\//, '');
  const parts: Uint8Array[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    let result: { base64: string; size: number };
    try {
      result = await PhotoGallery.readPick({
        path: normalized,
        offset,
        maxBytes: chunkBytes,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(msg || 'Could not read file');
    }
    if (offset === 0 && typeof result.size === 'number') {
      total = result.size;
    }
    const part = base64ToBytes(result.base64);
    if (!part.length) {
      if (offset === 0) throw new Error('File is empty');
      break;
    }
    parts.push(part);
    offset += part.length;
    if (Number.isFinite(total) && total > 0) {
      onProgress?.(Math.min(100, Math.round((offset / total) * 100)));
    }
    if (offset >= total) break;
    if (part.length < chunkBytes) break;
  }

  if (!parts.length) throw new Error('Could not read file');
  const merged = mergeParts(parts);
  if (Number.isFinite(total) && merged.length !== total) {
    throw new Error('Could not read file');
  }
  return merged;
}

async function readNativePickSingle(path: string, expectedSize?: number): Promise<Uint8Array | null> {
  const { PhotoGallery } = await import('./native-photo-gallery');
  const normalized = path.replace(/^file:\/\//, '');

  let size = expectedSize ?? 0;
  if (!size) {
    try {
      const head = await PhotoGallery.readPick({ path: normalized, offset: 0, maxBytes: 1 });
      size = head.size ?? 0;
    } catch {
      return null;
    }
  }

  if (!size || size > SINGLE_READ_MAX_BYTES) return null;

  try {
    const result = await PhotoGallery.readPick({ path: normalized });
    const data = base64ToBytes(result.base64);
    if (!data.length) return null;
    if (result.size && data.length !== result.size) return null;
    return data;
  } catch {
    return null;
  }
}

/** Read a native picked file via PhotoGallery.readPick (single shot or chunked on iOS). */
export async function readNativePickBytes(
  path: string,
  options?: { expectedSize?: number; onProgress?: (pct: number) => void },
): Promise<Uint8Array> {
  const normalized = path.replace(/^file:\/\//, '');

  if (isCapacitor()) {
    const single = await readNativePickSingle(normalized, options?.expectedSize);
    if (single) {
      options?.onProgress?.(100);
      return single;
    }
    return readNativePickChunked(normalized, CHUNK_BYTES, options?.onProgress);
  }

  try {
    const res = await fetch(path);
    if (res.ok) {
      const data = new Uint8Array(await res.arrayBuffer());
      if (data.length) return data;
    }
  } catch {
    /* fall through */
  }

  return readNativePickChunked(normalized, CHUNK_BYTES, options?.onProgress);
}
