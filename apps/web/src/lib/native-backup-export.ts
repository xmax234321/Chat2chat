import { registerPlugin } from '@capacitor/core';

export interface BackupExportPlugin {
  writeBackupFile(options: { filename: string; content: string }): Promise<{ uri: string; path?: string }>;
  beginZipBackup(options: { filename: string }): Promise<{ sessionId: string }>;
  addZipMediaFile(options: { sessionId: string; path: string; data: string }): Promise<void>;
  finishZipBackup(options: { sessionId: string; backupJson: string }): Promise<{ uri: string; path?: string }>;
  readZipMediaFile(options: { extractUri: string; path: string }): Promise<{ data: string }>;
  releaseZipRestoreSession(options: { sessionId: string }): Promise<void>;
  presentShareSheet(options: { uri: string }): Promise<{ shared: boolean }>;
  pickBackupFile(): Promise<{
    content: string;
    fileName?: string;
    extractUri?: string;
    restoreSessionId?: string;
  }>;
  listBackupsFolder(): Promise<{ files: Array<{ name: string; uri: string; modifiedAt: number }> }>;
  readBackupsFolderFile(options: { filename: string }): Promise<{
    content: string;
    fileName?: string;
    extractUri?: string;
    restoreSessionId?: string;
  }>;
  pruneBackupsFolder(): Promise<{ removed: number }>;
}

export const BackupExport = registerPlugin<BackupExportPlugin>('BackupExport');
