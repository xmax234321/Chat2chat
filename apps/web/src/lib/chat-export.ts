import type { ChatMessage, Contact } from './types';
import { isContactExportBlocked } from './chat-privacy-protocol';
import { isEphemeralContent } from './ephemeral-media';
import { Capacitor } from '@capacitor/core';
import { isIosCapacitor } from './platform';

export async function downloadChatExport(contact: Contact, messages: ChatMessage[]): Promise<void> {
  if (isContactExportBlocked(contact)) {
    throw new Error('Export is blocked for this chat');
  }
  const exportMessages = messages.filter(
    (m) =>
      m.content.kind === 'text' ||
      m.content.kind === 'group_invite' ||
      m.content.kind === 'export_block_notice' ||
      !isEphemeralContent(m.content),
  );
  const payload = {
    format: 'chat2chat-chat-export',
    version: 1,
    contact: {
      userId: contact.userId,
      alias: contact.alias,
      fingerprint: contact.fingerprint,
    },
    messages: exportMessages.map((m) => ({
      id: m.id,
      direction: m.direction,
      timestamp: m.timestamp,
      content:
        m.content.kind === 'text'
          ? { kind: 'text', body: m.content.body }
          : m.content.kind === 'group_invite'
            ? {
                kind: 'group_invite' as const,
                groupName: m.content.groupName,
                status: m.content.status,
              }
            : m.content.kind === 'export_block_notice'
              ? {
                  kind: 'export_block_notice' as const,
                  byUserId: m.content.byUserId,
                  byAlias: m.content.byAlias,
                }
              : {
                kind: m.content.kind,
                fileName: m.content.fileName,
                mime: m.content.mime,
                size: m.content.size,
              },
      senderId: m.senderId,
      senderAlias: m.senderAlias,
    })),
    exportedAt: Date.now(),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const safeName = contact.alias.replace(/[^\w.-]+/g, '_').slice(0, 40) || 'chat';
  const fileName = `${safeName}-export.json`;

  if (Capacitor.isNativePlatform()) {
    const content = JSON.stringify(payload, null, 2);
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const path = `exports/${fileName}`;
    await Filesystem.writeFile({
      path,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
    if (!uri) throw new Error('Could not prepare export file');
    if (isIosCapacitor()) {
      const { BackupExport } = await import('./native-backup-export');
      await BackupExport.presentShareSheet({ uri });
    } else {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: fileName, url: uri, dialogTitle: 'Export chat' });
    }
    return;
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
