import type { ChatMessage, MessageContent } from './types';
import { albumPreviewFromMember, isAlbumMediaContent } from './media-group';

export type PreviewKind =
  | 'text'
  | 'image'
  | 'video'
  | 'voice'
  | 'file'
  | 'invite'
  | 'notice'
  | 'empty';

export interface MessageListPreview {
  kind: PreviewKind;
  text: string;
  pending?: boolean;
}

function mediaUploadLabel(kind: 'image' | 'video' | 'file' | 'voice'): string {
  if (kind === 'video') return 'Sending video…';
  if (kind === 'image') return 'Sending photo…';
  if (kind === 'voice') return 'Sending voice…';
  return 'Sending file…';
}

export function previewText(content: MessageContent): string {
  if (content.kind === 'text') return content.body;
  if (isAlbumMediaContent(content)) return albumPreviewFromMember(content);
  if (content.kind === 'image') return 'Photo';
  if (content.kind === 'video') return 'Video';
  if (content.kind === 'voice') return 'Voice message';
  if (content.kind === 'group_invite') {
    if (content.status === 'accepted') return `Joined ${content.groupName}`;
    if (content.status === 'declined') return 'Group invite declined';
    return `Invite to ${content.groupName}`;
  }
  if (content.kind === 'export_block_notice') {
    return `Chat export was blocked by ${content.byAlias}`;
  }
  return content.fileName || 'File';
}

export function buildMessageListPreview(message?: ChatMessage): MessageListPreview {
  if (!message) return { kind: 'empty', text: 'No messages yet' };

  const pending = Boolean(message.pendingDelivery);
  const content = message.content;

  if (
    (content.kind === 'image' ||
      content.kind === 'video' ||
      content.kind === 'file' ||
      content.kind === 'voice') &&
    content.uploading
  ) {
    return {
      kind: content.kind === 'voice' ? 'voice' : content.kind,
      text: mediaUploadLabel(content.kind),
      pending: false,
    };
  }

  if (content.kind === 'text') return { kind: 'text', text: content.body, pending };
  if (isAlbumMediaContent(content)) {
    return { kind: content.kind, text: albumPreviewFromMember(content), pending };
  }
  if (content.kind === 'image') return { kind: 'image', text: 'Photo', pending };
  if (content.kind === 'video') return { kind: 'video', text: 'Video', pending };
  if (content.kind === 'voice') return { kind: 'voice', text: 'Voice message', pending };
  if (content.kind === 'group_invite') {
    return { kind: 'invite', text: previewText(content), pending };
  }
  if (content.kind === 'export_block_notice') {
    return { kind: 'notice', text: previewText(content), pending };
  }
  return { kind: 'file', text: content.fileName || 'File', pending };
}

export function isPendingDeliveryMessage(message: ChatMessage): boolean {
  return message.direction === 'out' && Boolean(message.pendingDelivery);
}
