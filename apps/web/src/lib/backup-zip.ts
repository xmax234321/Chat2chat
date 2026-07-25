import { unzipSync } from 'fflate';

export const BACKUP_ZIP_JSON_NAME = 'backup.json';

const LOCAL_SIG = 0x04034b50;

export function isZipBackupName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith('.zip') || lower.endsWith('.c2backup.zip');
}

export function normalizeZipPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    ((bytes[offset + 3] << 24) >>> 0)
  );
}

/** Reads stored ZIP entries. legacyHeader=true supports older iOS backups with shortened headers. */
function extractStoredZip(bytes: Uint8Array, legacyHeader = false): Map<string, Uint8Array> {
  const zipFiles = new Map<string, Uint8Array>();
  let offset = 0;
  const sizeOffset = legacyHeader ? 14 : 18;
  const nameLengthOffset = legacyHeader ? 22 : 26;
  const extraLengthOffset = legacyHeader ? 24 : 28;
  const nameStartOffset = legacyHeader ? 26 : 30;

  while (offset + nameStartOffset <= bytes.length) {
    const signature = readU32(bytes, offset);
    if (signature !== LOCAL_SIG) break;

    const compression = readU16(bytes, offset + 8);
    const compressedSize = readU32(bytes, offset + sizeOffset);
    const uncompressedSize = readU32(bytes, offset + sizeOffset + 4);
    const nameLength = readU16(bytes, offset + nameLengthOffset);
    const extraLength = readU16(bytes, offset + extraLengthOffset);
    const nameStart = offset + nameStartOffset;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > bytes.length) break;

    const relativePath = new TextDecoder().decode(bytes.subarray(nameStart, nameEnd));
    const dataStart = nameEnd + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) break;

    if (compression !== 0) {
      throw new Error('Unsupported compression in backup zip');
    }
    if (uncompressedSize !== compressedSize) {
      throw new Error('Invalid backup zip entry size');
    }

    zipFiles.set(normalizeZipPath(relativePath), bytes.slice(dataStart, dataEnd));
    offset = dataEnd;
  }

  if (!zipFiles.has(BACKUP_ZIP_JSON_NAME)) {
    throw new Error('Not a Chat2Chat backup zip (missing backup.json)');
  }

  return zipFiles;
}

function loadZipFiles(bytes: Uint8Array): Map<string, Uint8Array> {
  try {
    const archive = unzipSync(bytes);
    const zipFiles = new Map<string, Uint8Array>();
    for (const [path, data] of Object.entries(archive)) {
      zipFiles.set(normalizeZipPath(path), data);
    }
    if (zipFiles.has(BACKUP_ZIP_JSON_NAME)) {
      return zipFiles;
    }
  } catch {
    /* try custom readers */
  }

  try {
    return extractStoredZip(bytes, false);
  } catch {
    return extractStoredZip(bytes, true);
  }
}

export function extractBackupZip(bytes: Uint8Array): {
  backupJson: string;
  zipFiles: Map<string, Uint8Array>;
} {
  if (!bytes.length) {
    throw new Error('Backup file is empty');
  }

  let zipFiles: Map<string, Uint8Array>;
  try {
    zipFiles = loadZipFiles(bytes);
  } catch {
    throw new Error('Could not read backup zip');
  }

  const backupBytes = zipFiles.get(BACKUP_ZIP_JSON_NAME);
  if (!backupBytes?.length) {
    throw new Error('Not a Chat2Chat backup zip (missing backup.json)');
  }

  const backupJson = new TextDecoder().decode(backupBytes);
  return { backupJson, zipFiles };
}

export function readZipEntry(zipFiles: Map<string, Uint8Array>, relativePath: string): Uint8Array | null {
  const normalized = normalizeZipPath(relativePath);
  return zipFiles.get(normalized) ?? null;
}
