import { Capacitor } from '@capacitor/core';
import { extractBackupZip, isZipBackupName } from './backup-zip';
import { isIosCapacitor } from './platform';
import type { PickedBackup } from './backup';

export type AppFolderFileKind = 'backup' | 'login';

export interface AppFolderFileEntry {
  name: string;
  uri: string;
  modifiedAt: number;
  kind: AppFolderFileKind;
}

const BACKUPS_PATH = 'Backups';

export function classifyAppFolderFile(name: string): AppFolderFileKind | null {
  const lower = name.toLowerCase();
  if (lower.includes('.c2backup.') || lower.endsWith('.c2backup.json') || lower.endsWith('.c2backup.zip')) {
    return 'backup';
  }
  if (lower.includes('.c2cproof.') || lower.startsWith('chat2chat-login-')) {
    return 'login';
  }
  return null;
}

export function formatAppFolderFileDate(modifiedAt: number): string {
  if (!modifiedAt) return 'Unknown date';
  return new Date(modifiedAt).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatAppFolderFileIdHint(name: string): string {
  const base = name.replace(/\.(c2backup\.|c2cproof\.)?(json|zip)$/i, '');
  const stripped = base
    .replace(/^chat2chat-(backup|login)-/i, '')
    .replace(/\.c2backup$/i, '')
    .replace(/\.c2cproof$/i, '');
  const chunk = stripped.replace(/[^a-zA-Z0-9]/g, '');
  if (chunk.length >= 8) return chunk.slice(-8).toUpperCase();
  if (chunk.length > 0) return chunk.toUpperCase();
  return '····';
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function listAppFolderFiles(kind?: AppFolderFileKind): Promise<AppFolderFileEntry[]> {
  if (!Capacitor.isNativePlatform()) return [];

  let raw: Array<{ name: string; uri: string; modifiedAt: number }> = [];

  if (isIosCapacitor()) {
    try {
      const { BackupExport } = await import('./native-backup-export');
      const result = await BackupExport.listBackupsFolder();
      raw = result.files ?? [];
    } catch {
      return [];
    }
  } else {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const listing = await Filesystem.readdir({ path: BACKUPS_PATH, directory: Directory.Documents });
      for (const file of listing.files) {
        if (file.type === 'directory') continue;
        const stat = await Filesystem.stat({
          path: `${BACKUPS_PATH}/${file.name}`,
          directory: Directory.Documents,
        });
        const uri = (await Filesystem.getUri({
          path: `${BACKUPS_PATH}/${file.name}`,
          directory: Directory.Documents,
        })).uri;
        raw.push({
          name: file.name,
          uri: uri ?? '',
          modifiedAt: stat.mtime ?? 0,
        });
      }
    } catch {
      return [];
    }
  }

  return raw
    .map((file) => {
      const fileKind = classifyAppFolderFile(file.name);
      if (!fileKind) return null;
      return { ...file, kind: fileKind };
    })
    .filter((entry): entry is AppFolderFileEntry => entry !== null && (!kind || entry.kind === kind))
    .sort((a, b) => b.modifiedAt - a.modifiedAt);
}

export async function readBackupFromAppFolderEntry(entry: AppFolderFileEntry): Promise<PickedBackup> {
  if (isIosCapacitor()) {
    const { BackupExport } = await import('./native-backup-export');
    const result = await BackupExport.readBackupsFolderFile({ filename: entry.name });
    if (!result.content) throw new Error('Could not read backup file');
    return {
      content: result.content,
      fileName: result.fileName ?? entry.name,
      extractUri: result.extractUri,
      restoreSessionId: result.restoreSessionId,
    };
  }

  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  const path = `${BACKUPS_PATH}/${entry.name}`;

  if (isZipBackupName(entry.name)) {
    const read = await Filesystem.readFile({ path, directory: Directory.Documents });
    const bytes = base64ToBytes(typeof read.data === 'string' ? read.data : '');
    const { backupJson, zipFiles } = extractBackupZip(bytes);
    return { content: backupJson, fileName: entry.name, zipFiles };
  }

  const read = await Filesystem.readFile({
    path,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
  });
  return { content: read.data as string, fileName: entry.name };
}

export async function readTextFromAppFolderEntry(entry: AppFolderFileEntry): Promise<string> {
  if (isIosCapacitor()) {
    const { BackupExport } = await import('./native-backup-export');
    const result = await BackupExport.readBackupsFolderFile({ filename: entry.name });
    if (!result.content) throw new Error('Could not read file');
    return result.content;
  }

  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  const read = await Filesystem.readFile({
    path: `${BACKUPS_PATH}/${entry.name}`,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
  });
  return read.data as string;
}

export async function pruneNonEssentialAppFolderFiles(): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;

  if (isIosCapacitor()) {
    try {
      const { BackupExport } = await import('./native-backup-export');
      const result = await BackupExport.pruneBackupsFolder();
      return result.removed ?? 0;
    } catch {
      return 0;
    }
  }

  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const listing = await Filesystem.readdir({ path: BACKUPS_PATH, directory: Directory.Documents });
    let removed = 0;
    for (const file of listing.files) {
      if (file.type === 'directory') continue;
      if (classifyAppFolderFile(file.name)) continue;
      await Filesystem.deleteFile({
        path: `${BACKUPS_PATH}/${file.name}`,
        directory: Directory.Documents,
      });
      removed += 1;
    }
    return removed;
  } catch {
    return 0;
  }
}

export async function shareAppFolderFile(entry: { name?: string; filename?: string; uri?: string }): Promise<void> {
  const fileName = entry.name ?? entry.filename;
  if (!fileName) throw new Error('File not found');
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Sharing is only available in the mobile app');
  }

  if (isIosCapacitor()) {
    const { BackupExport } = await import('./native-backup-export');
    let uri = entry.uri;
    if (!uri) {
      const files = await listAppFolderFiles();
      uri = files.find((f) => f.name === fileName)?.uri;
    }
    if (!uri) throw new Error('File not found');
    await BackupExport.presentShareSheet({ uri });
    return;
  }

  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const { uri } = await Filesystem.getUri({
    path: `${BACKUPS_PATH}/${fileName}`,
    directory: Directory.Documents,
  });
  if (!uri) throw new Error('File not found');
  await Share.share({ title: fileName, url: uri, dialogTitle: 'Save to Files' });
}
