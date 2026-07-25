import { readCachedMediaBytes } from './media-cache';
import type { PickedMedia } from './pick-media';
import { downloadMedia, shareMediaFile } from './save-media';
import type { ChatMessage } from './types';
import { isEphemeralContent } from './ephemeral-media';

export function messageHasDownloadableMedia(message: ChatMessage): boolean {
  const content = message.content;
  if (content.kind === 'text' || content.kind === 'group_invite' || content.kind === 'export_block_notice') return false;
  if (content.uploading) return false;
  if (isEphemeralContent(content)) return false;
  return true;
}

export function messageCanForward(message: ChatMessage): boolean {
  if (message.content.kind === 'group_invite' || message.content.kind === 'export_block_notice') return false;
  if (message.content.kind === 'text' || message.content.kind === 'voice' || message.content.kind === 'file') {
    return !isEphemeralContent(message.content);
  }
  return !isEphemeralContent(message.content);
}

export function messageCopyText(message: ChatMessage): string | null {
  const content = message.content;
  if (content.kind === 'text') {
    const text = content.body.trim();
    return text || null;
  }
  if (content.kind === 'file') {
    const name = content.fileName?.trim();
    return name || null;
  }
  return null;
}

export function messageCanCopy(message: ChatMessage): boolean {
  return messageCopyText(message) != null;
}

async function mediaSrcForMessage(message: ChatMessage): Promise<{ src: string; revoke: boolean } | null> {
  const content = message.content;
  if (content.kind === 'text' || content.kind === 'group_invite' || content.kind === 'export_block_notice' || content.uploading) return null;

  if (content.previewUrl) {
    return { src: content.previewUrl, revoke: false };
  }

  const cached = await readCachedMediaBytes(message.id);
  if (!cached?.data?.length) return null;

  const mime = cached.mime || content.mime;
  const src = URL.createObjectURL(new Blob([cached.data.slice()], { type: mime }));
  return { src, revoke: true };
}

export async function downloadMessage(message: ChatMessage): Promise<void> {
  const content = message.content;
  if (isEphemeralContent(content)) {
    throw new Error('Disappearing media cannot be saved');
  }
  if (content.kind === 'text' || content.kind === 'group_invite' || content.kind === 'export_block_notice') {
    throw new Error('Nothing to download');
  }
  if (content.uploading) {
    throw new Error('Still uploading');
  }

  const media = await mediaSrcForMessage(message);
  if (!media) throw new Error('Media not available');

  try {
    if (content.kind === 'file') {
      await shareMediaFile(media.src, content.fileName, content.mime);
    } else {
      await downloadMedia(media.src, content.fileName, content.mime);
    }
  } finally {
    if (media.revoke) URL.revokeObjectURL(media.src);
  }
}

export async function forwardMessage(
  message: ChatMessage,
  targetContactId: string,
  senders: {
    sendText: (contactId: string, body: string) => Promise<void>;
    sendMedia: (contactId: string, picked: PickedMedia) => Promise<void>;
  },
): Promise<void> {
  if (!messageCanForward(message)) {
    throw new Error('This message cannot be forwarded');
  }
  const content = message.content;

  if (content.kind === 'text') {
    await senders.sendText(targetContactId, content.body);
    return;
  }

  if (content.kind === 'group_invite' || content.kind === 'export_block_notice') {
    throw new Error('This message cannot be forwarded');
  }

  if (content.uploading) {
    throw new Error('Still uploading');
  }

  const cached = await readCachedMediaBytes(message.id);
  if (!cached?.data?.length) {
    throw new Error('Media not available');
  }

  const data = cached.data.slice();
  const mime = cached.mime || content.mime;

  if (content.kind === 'voice') {
    const picked: PickedMedia = {
      file: new File([data], content.fileName, { type: mime }),
      mime,
      data,
      isVoice: true,
      durationMs: content.durationMs,
    };
    await senders.sendMedia(targetContactId, picked);
    return;
  }

  const isFile = content.kind === 'file';
  const previewUrl = isFile ? undefined : content.previewUrl ?? URL.createObjectURL(new Blob([data], { type: mime }));
  const picked: PickedMedia = {
    file: new File([data], content.fileName, { type: mime }),
    mime,
    data,
    previewUrl,
    isFile,
  };

  try {
    await senders.sendMedia(targetContactId, picked);
  } finally {
    if (previewUrl?.startsWith('blob:') && previewUrl !== content.previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  }
}

export async function forwardMessages(
  messages: ChatMessage[],
  targetContactId: string,
  senders: {
    sendText: (contactId: string, body: string) => Promise<void>;
    sendMedia: (contactId: string, picked: PickedMedia) => Promise<void>;
  },
): Promise<void> {
  for (const message of messages) {
    await forwardMessage(message, targetContactId, senders);
  }
}
