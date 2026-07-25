import {
  decryptMedia,
  base64UrlDecode,
  encryptWithPassword,
  decryptWithPassword,
} from '@chat2chat/crypto/browser';
import { decryptMediaFastFile, isFastFilePacked } from './fast-file-crypto';
import { Capacitor } from '@capacitor/core';
import type { Contact, ChatMessage, AppSettings, MessageContent, Group, GroupInvite } from './types';
import { isGroupId } from './types';
import { isEphemeralContent } from './ephemeral-media';
import { cacheMediaBlob, readCachedMediaBytes, iterateCachedMedia, type CachedMediaEntry } from './media-cache';
import { isElectron, isIosCapacitor } from './platform';
import { extractBackupZip, isZipBackupName, readZipEntry } from './backup-zip';
import { readBytesFromUserFile, readTextFromUserFile } from './read-user-file';
import { createFullImageBlobUrl, createMediaPreviewUrl, createVideoBubbleThumbUrl } from './media-thumbnail';

export type BackupSaveResult = {
  mode: 'shared' | 'saved' | 'downloaded';
  path?: string;
  exportExcludedChats?: BackupExportExclusion[];
};

export const BACKUP_FORMAT = 'chat2chat-backup' as const;
export const BACKUP_MIN_PASSWORD = 6;

export interface BackupMediaEntry {
  messageId: string;
  mime: string;
  data: string;
  /** Path inside a .c2backup.zip archive when media is stored externally. */
  file?: string;
}

export type BackupExportExclusionReason = 'export_blocked_by_peer';

export interface BackupExportExclusion {
  contactId: string;
  label: string;
  reason: BackupExportExclusionReason;
}

export interface BackupPayload {
  v: 1;
  mnemonic: string;
  contacts: Contact[];
  messages: ChatMessage[];
  groups?: Group[];
  groupInvites?: GroupInvite[];
  settings: Partial<AppSettings>;
  /** @deprecated Legacy backups may include this field. */
  recoveryEmail?: string | null;
  media: BackupMediaEntry[];
  /** Chats omitted because export was blocked for them. */
  exportExcludedChats?: BackupExportExclusion[];
  exportedAt: number;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: 1;
  userId: string;
  createdAt: string;
  salt: string;
  nonce: string;
  ciphertext: string;
}

type MediaContent = Extract<MessageContent, { kind: 'image' | 'video' | 'file' | 'voice' }>;

function isMediaContent(content: MessageContent): content is MediaContent {
  return content.kind === 'image' || content.kind === 'video' || content.kind === 'file' || content.kind === 'voice';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function bytesFromPreviewUrl(url: string): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    if (url.startsWith('data:')) {
      const comma = url.indexOf(',');
      if (comma < 0) return null;
      const meta = url.slice(0, comma);
      const payload = url.slice(comma + 1);
      if (meta.includes(';base64')) {
        const binary = atob(payload);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
      }
      return new TextEncoder().encode(decodeURIComponent(payload));
    }
    if (!url.startsWith('blob:')) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return bytes.length ? bytes : null;
  } catch {
    return null;
  }
}

async function downloadRemoteMedia(
  content: MediaContent,
  userId: string,
  httpBaseUrl: string,
): Promise<Uint8Array | null> {
  if (
    content.uploading ||
    !content.blobId ||
    content.blobId === 'local' ||
    !content.fileKey ||
    !content.size
  ) {
    return null;
  }

  const base = httpBaseUrl.replace(/\/$/, '');
  const url = `${base}/api/v1/blob/${content.blobId}`;
  const headers = { 'X-User-Id': userId };

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const encrypted = new Uint8Array(await res.arrayBuffer());
        if (!encrypted.length) return null;
        const fileKey = base64UrlDecode(content.fileKey);
        if (isFastFilePacked(encrypted)) {
          return decryptMediaFastFile(encrypted, fileKey, content.size);
        }
        return decryptMedia(encrypted, fileKey, content.size);
      }
      if (res.status === 404 && attempt < 4) {
        await sleep(350 * (attempt + 1));
        continue;
      }
      return null;
    } catch {
      if (attempt < 4) {
        await sleep(350 * (attempt + 1));
        continue;
      }
    }
  }
  return null;
}

export const BACKUP_ZIP_JSON_NAME = 'backup.json' as const;

export function mediaZipPath(messageId: string): string {
  const safe = bytesToBase64(new TextEncoder().encode(messageId))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `media/${safe}.bin`;
}

export async function* iterateBackupMedia(
  messages: ChatMessage[],
  userId: string,
  httpBaseUrl: string,
): AsyncGenerator<CachedMediaEntry> {
  const seen = new Set<string>();
  const ephemeralIds = new Set(
    messages
      .filter((m) => isMediaContent(m.content) && isEphemeralContent(m.content))
      .map((m) => m.id),
  );

  for await (const entry of iterateCachedMedia()) {
    if (!entry.data.length || ephemeralIds.has(entry.messageId)) continue;
    seen.add(entry.messageId);
    yield entry;
    await sleep(0);
  }

  const mediaMessages = messages.filter(
    (m) => isMediaContent(m.content) && !m.content.uploading && !isEphemeralContent(m.content),
  );

  for (const message of mediaMessages) {
    if (seen.has(message.id)) continue;

    const cached = await readCachedMediaBytes(message.id);
    if (cached?.data.length) {
      seen.add(message.id);
      yield cached;
      await sleep(0);
      continue;
    }

    const content = message.content;
    if (!isMediaContent(content)) continue;

    if (content.previewUrl) {
      const fromPreview = await bytesFromPreviewUrl(content.previewUrl);
      if (fromPreview?.length) {
        seen.add(message.id);
        yield { messageId: message.id, mime: content.mime, data: fromPreview };
        await sleep(0);
        continue;
      }
    }

    const fromServer = await downloadRemoteMedia(content, userId, httpBaseUrl);
    if (fromServer?.length) {
      seen.add(message.id);
      yield { messageId: message.id, mime: content.mime, data: fromServer };
      await sleep(0);
    }
  }
}

export async function collectBackupMedia(
  messages: ChatMessage[],
  userId: string,
  httpBaseUrl: string,
): Promise<CachedMediaEntry[]> {
  const entries: CachedMediaEntry[] = [];
  for await (const entry of iterateBackupMedia(messages, userId, httpBaseUrl)) {
    entries.push(entry);
  }
  return entries;
}

export function validateBackupPassword(password: string): string | null {
  if (password.trim().length < BACKUP_MIN_PASSWORD) {
    return `Password must be at least ${BACKUP_MIN_PASSWORD} characters`;
  }
  return null;
}

function stripMessageForExport(message: ChatMessage): ChatMessage {
  if (message.content.kind === 'text' || message.content.kind === 'group_invite' || message.content.kind === 'export_block_notice') return message;
  const { previewUrl: _preview, uploading: _uploading, ephemeral: _ephemeral, ...content } = message.content;
  return { ...message, content: { ...content, uploading: false } };
}

/** Chats excluded from backup because export is blocked locally or by the peer. */
export function listExportBlockedChats(
  contacts: Contact[],
  messages: ChatMessage[],
): BackupExportExclusion[] {
  const chatIds = new Set(messages.map((m) => m.contactId));
  const excluded: BackupExportExclusion[] = [];
  for (const contactId of chatIds) {
    if (isGroupId(contactId)) continue;
    const contact = contacts.find((c) => c.userId === contactId);
    if (!contact) continue;
    if (contact.exportBlockedByPeer) {
      excluded.push({
        contactId,
        label: contact.alias,
        reason: 'export_blocked_by_peer',
      });
    }
  }
  excluded.sort((a, b) => a.label.localeCompare(b.label));
  return excluded;
}

export function formatBackupExclusionNotice(excluded: BackupExportExclusion[]): string | null {
  if (!excluded.length) return null;
  if (excluded.length === 1) {
    const entry = excluded[0];
    return `1 chat was not included in backup (export blocked by contact): ${entry.label}.`;
  }
  const names = excluded.map((e) => e.label).join(', ');
  return `${excluded.length} chats were not included in backup (export blocked by contact): ${names}.`;
}

/** Excludes disappearing media and export-blocked chats from backup exports. */
export function messagesForBackup(
  messages: ChatMessage[],
  contacts: Contact[],
): ChatMessage[] {
  const blockedIds = new Set(listExportBlockedChats(contacts, messages).map((e) => e.contactId));
  return messages
    .filter((message) => !blockedIds.has(message.contactId))
    .filter((message) => message.content.kind === 'text' || !isEphemeralContent(message.content))
    .map(stripMessageForExport);
}

export async function buildBackupPayload(input: {
  mnemonic: string;
  userId: string;
  contacts: Contact[];
  messages: ChatMessage[];
  groups?: Group[];
  groupInvites?: GroupInvite[];
  settings: AppSettings;
  httpBaseUrl: string;
  media?: BackupMediaEntry[];
}): Promise<BackupPayload> {
  const exportExcludedChats = listExportBlockedChats(input.contacts, input.messages);
  const backupMessages = messagesForBackup(input.messages, input.contacts);
  const media =
    input.media ??
    (await collectBackupMedia(backupMessages, input.userId, input.httpBaseUrl)).map((entry) => ({
      messageId: entry.messageId,
      mime: entry.mime,
      data: bytesToBase64(entry.data),
    }));

  return {
    v: 1,
    mnemonic: input.mnemonic.trim().toLowerCase(),
    contacts: input.contacts,
    messages: backupMessages,
    groups: input.groups,
    groupInvites: input.groupInvites,
    settings: input.settings,
    media,
    ...(exportExcludedChats.length ? { exportExcludedChats } : {}),
    exportedAt: Date.now(),
  };
}

export function encryptBackupPayload(password: string, payload: BackupPayload, userId: string): BackupFile {
  const err = validateBackupPassword(password);
  if (err) throw new Error(err);

  const plain = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = encryptWithPassword(password, plain);

  return {
    format: BACKUP_FORMAT,
    version: 1,
    userId,
    createdAt: new Date().toISOString(),
    salt: bytesToBase64(encrypted.salt),
    nonce: bytesToBase64(encrypted.nonce),
    ciphertext: bytesToBase64(encrypted.ciphertext),
  };
}

export function parseBackupFile(raw: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('File is not valid JSON');
  }
  const file = parsed as Partial<BackupFile>;
  if (file.format !== BACKUP_FORMAT || file.version !== 1) {
    throw new Error('Not a Chat2Chat backup file');
  }
  if (!file.salt || !file.nonce || !file.ciphertext || !file.userId) {
    throw new Error('Backup file is incomplete');
  }
  return file as BackupFile;
}

export function decryptBackupPayload(password: string, file: BackupFile): BackupPayload {
  try {
    const plain = decryptWithPassword(password, {
      salt: base64ToBytes(file.salt),
      nonce: base64ToBytes(file.nonce),
      ciphertext: base64ToBytes(file.ciphertext),
    });
    const payload = JSON.parse(new TextDecoder().decode(plain)) as BackupPayload;
    if (!payload?.mnemonic || !Array.isArray(payload.contacts) || !Array.isArray(payload.messages)) {
      throw new Error('Invalid backup contents');
    }
    if (payload.v !== 1) throw new Error('Unsupported backup version');
    if (!Array.isArray(payload.media)) payload.media = [];
    return payload;
  } catch (e) {
    if (e instanceof Error && /invalid backup|unsupported|not a chat2chat/i.test(e.message)) throw e;
    throw new Error('Wrong password or corrupted backup');
  }
}

export function backupFilename(userId: string): string {
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
  const date = new Date().toISOString().slice(0, 10);
  return `chat2chat-backup-${safeId}-${date}.c2backup.json`;
}

export function backupZipFilename(userId: string): string {
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
  const date = new Date().toISOString().slice(0, 10);
  return `chat2chat-backup-${safeId}-${date}.c2backup.zip`;
}

export function downloadBackupFile(file: BackupFile): void {
  const content = JSON.stringify(file, null, 2);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFilename(file.userId);
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function saveBackupViaElectron(content: string, filename: string): Promise<BackupSaveResult> {
  const bridge = window.chat2chat?.saveBackup;
  if (!bridge) throw new Error('Save dialog is not available in this desktop build');
  const result = await bridge({ defaultPath: filename, content });
  if (result.canceled) throw new Error('Save canceled');
  return { mode: 'downloaded', path: result.filePath };
}

/** Result from the native / desktop backup file picker. */
export type PickedBackup = {
  content: string;
  fileName?: string;
  extractUri?: string;
  restoreSessionId?: string;
  zipFiles?: Map<string, Uint8Array>;
};

/** Open a user-picked backup file (.json or .c2backup.zip). */
export async function openBackupFromUserFile(file: File): Promise<PickedBackup> {
  if (isZipBackupName(file.name)) {
    const bytes = await readBytesFromUserFile(file);
    const { backupJson, zipFiles } = extractBackupZip(bytes);
    return { content: backupJson, fileName: file.name, zipFiles };
  }

  const content = await readTextFromUserFile(file);
  return { content, fileName: file.name };
}

/** Pick a backup file on desktop (Electron) or iOS (native picker). */
export async function pickBackupFile(): Promise<PickedBackup | null> {
  if (isElectron()) {
    const bridge = window.chat2chat?.openBackup;
    if (!bridge) return null;
    const result = await bridge();
    if (result.canceled) return null;

    if (result.zipBytes) {
      const { backupJson, zipFiles } = extractBackupZip(base64ToBytes(result.zipBytes));
      return {
        content: backupJson,
        fileName: result.filePath?.split(/[/\\]/).pop(),
        zipFiles,
      };
    }

    if (!result.content) return null;
    return {
      content: result.content,
      fileName: result.filePath?.split(/[/\\]/).pop(),
    };
  }

  if (isIosCapacitor()) {
    try {
      const { BackupExport } = await import('./native-backup-export');
      const result = await BackupExport.pickBackupFile();
      if (!result.content) return null;
      return {
        content: result.content,
        fileName: result.fileName,
        extractUri: result.extractUri,
        restoreSessionId: result.restoreSessionId,
      };
    } catch {
      return null;
    }
  }

  return null;
}

function isSaveCanceledError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /cancel/i.test(message);
}

export const APP_BACKUPS_FOLDER_HINT = 'Files → On My iPhone → Chat2Chat → Backups';

export type PreparedBackupShare = {
  uri: string;
  filename: string;
  path?: string;
  exportExcludedChats?: BackupExportExclusion[];
};

/** Build a ZIP backup on iOS: encrypted JSON + media files, one file at a time. */
export async function buildAndPrepareMobileZipBackup(input: {
  password: string;
  mnemonic: string;
  userId: string;
  contacts: Contact[];
  messages: ChatMessage[];
  groups?: Group[];
  groupInvites?: GroupInvite[];
  settings: AppSettings;
  httpBaseUrl: string;
}): Promise<PreparedBackupShare> {
  if (!isIosCapacitor()) {
    throw new Error('ZIP backup is only available on iOS');
  }

  const { BackupExport } = await import('./native-backup-export');
  const filename = backupZipFilename(input.userId);
  const { sessionId } = await BackupExport.beginZipBackup({ filename });
  const mediaRefs: BackupMediaEntry[] = [];
  const backupMessages = messagesForBackup(input.messages, input.contacts);

  try {
    for await (const entry of iterateBackupMedia(backupMessages, input.userId, input.httpBaseUrl)) {
      const path = mediaZipPath(entry.messageId);
      await BackupExport.addZipMediaFile({
        sessionId,
        path,
        data: bytesToBase64(entry.data),
      });
      mediaRefs.push({
        messageId: entry.messageId,
        mime: entry.mime,
        data: '',
        file: path,
      });
      await sleep(0);
    }

    const payload = await buildBackupPayload({ ...input, media: mediaRefs });
    const file = encryptBackupPayload(input.password, payload, input.userId);
    const result = await BackupExport.finishZipBackup({
      sessionId,
      backupJson: JSON.stringify(file),
    });
    if (!result.uri) throw new Error('Could not write backup zip');
    return {
      uri: result.uri,
      filename,
      path: result.path ?? `Backups/${filename}`,
      exportExcludedChats: payload.exportExcludedChats,
    };
  } catch (err) {
    throw err instanceof Error ? err : new Error('Could not create backup zip');
  }
}

export async function importBackupMediaToCache(
  media: BackupMediaEntry[],
  picked?: Pick<PickedBackup, 'extractUri' | 'restoreSessionId' | 'zipFiles'>,
): Promise<void> {
  for (const entry of media) {
    let bytes: Uint8Array | null = null;

    if (entry.file && picked?.zipFiles) {
      bytes = readZipEntry(picked.zipFiles, entry.file);
    } else if (entry.file && picked?.extractUri && isIosCapacitor()) {
      const { BackupExport } = await import('./native-backup-export');
      const result = await BackupExport.readZipMediaFile({
        extractUri: picked.extractUri,
        path: entry.file,
      });
      bytes = base64ToBytes(result.data);
    } else if (entry.data) {
      bytes = base64ToBytes(entry.data);
    }

    if (bytes?.length) {
      await cacheMediaBlob(entry.messageId, bytes, entry.mime);
    }
    await sleep(0);
  }

  if (picked?.restoreSessionId && isIosCapacitor()) {
    try {
      const { BackupExport } = await import('./native-backup-export');
      await BackupExport.releaseZipRestoreSession({ sessionId: picked.restoreSessionId });
    } catch {
      /* cleanup best-effort */
    }
  }
}

export function messagesForRestore(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => {
    if (message.content.kind === 'text' || message.content.kind === 'group_invite' || message.content.kind === 'export_block_notice') return message;
    const { previewUrl: _preview, uploading: _uploading, ...content } = message.content;
    return { ...message, content: { ...content, uploading: false } };
  });
}

/** Write encrypted backup to device storage. Does not open the share menu. */
export async function prepareBackupShare(file: BackupFile): Promise<PreparedBackupShare> {
  const content = JSON.stringify(file);
  const filename = backupFilename(file.userId);

  if (isIosCapacitor()) {
    const { BackupExport } = await import('./native-backup-export');
    const result = await BackupExport.writeBackupFile({ filename, content });
    if (!result.uri) throw new Error('Could not write backup file');
    return { uri: result.uri, filename, path: result.path ?? `Backups/${filename}` };
  }

  const path = `Backups/${filename}`;
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');

  const written = await Filesystem.writeFile({
    path,
    data: content,
    directory: Directory.Documents,
    recursive: true,
    encoding: Encoding.UTF8,
  });

  const uri = written.uri || (await Filesystem.getUri({ path, directory: Directory.Documents })).uri;
  if (!uri) throw new Error('Could not write backup file');

  return { uri, filename, path };
}

/** Open share / save menu. Must be called directly from a button tap on iOS. */
export async function sharePreparedBackup(prepared: PreparedBackupShare): Promise<void> {
  if (isIosCapacitor()) {
    try {
      const { BackupExport } = await import('./native-backup-export');
      await BackupExport.presentShareSheet({ uri: prepared.uri });
      return;
    } catch (err) {
      if (isSaveCanceledError(err)) throw new Error('Save canceled');
    }
  }

  const { Share } = await import('@capacitor/share');
  const canShare = await Share.canShare();
  if (!canShare.value) {
    throw new Error('Sharing is not available on this device');
  }

  try {
    await Share.share({
      title: 'Chat2Chat backup',
      url: prepared.uri,
      dialogTitle: 'Save backup to Files',
    });
  } catch (err) {
    if (isSaveCanceledError(err)) throw new Error('Save canceled');
    throw err instanceof Error ? err : new Error('Could not save backup');
  }
}

async function saveBackupOnMobile(content: string): Promise<BackupSaveResult> {
  const file = JSON.parse(content) as BackupFile;
  await prepareBackupShare(file);
  return { mode: 'saved' };
}

/** Save backup — share sheet on mobile, native dialog on desktop, browser download elsewhere. */
export async function saveBackupFile(file: BackupFile): Promise<BackupSaveResult> {
  const content = JSON.stringify(file);
  const filename = backupFilename(file.userId);

  if (Capacitor.isNativePlatform()) {
    return saveBackupOnMobile(content);
  }

  if (isElectron()) {
    return saveBackupViaElectron(content, filename);
  }

  downloadBackupFile(file);
  return { mode: 'downloaded' };
}

export async function messagesWithMediaPreviews(
  messages: ChatMessage[],
  media: BackupMediaEntry[],
): Promise<ChatMessage[]> {
  const byId = new Map(media.map((m) => [m.messageId, m]));
  return Promise.all(
    messages.map(async (message) => {
      if (message.content.kind !== 'image' && message.content.kind !== 'video' && message.content.kind !== 'file' && message.content.kind !== 'voice') {
        return message;
      }
      const cached = byId.get(message.id);
      if (!cached) {
        return { ...message, content: { ...message.content, uploading: false } };
      }
      const bytes = base64ToBytes(cached.data);
      let previewUrl: string | undefined;
      if (message.content.kind === 'file') {
        previewUrl = await createMediaPreviewUrl(bytes, cached.mime, message.content.fileName);
      } else if (message.content.kind === 'video') {
        previewUrl = await createVideoBubbleThumbUrl(bytes, cached.mime, message.content.fileName);
      } else if (message.content.kind === 'voice') {
        previewUrl = URL.createObjectURL(new Blob([bytes.slice()], { type: cached.mime }));
      } else {
        previewUrl = createFullImageBlobUrl(bytes, cached.mime);
      }
      return {
        ...message,
        content: { ...message.content, previewUrl, uploading: false },
      };
    }),
  );
}

export function mediaEntriesForCache(media: BackupMediaEntry[]): CachedMediaEntry[] {
  return media.map((entry) => ({
    messageId: entry.messageId,
    mime: entry.mime,
    data: base64ToBytes(entry.data),
  }));
}
