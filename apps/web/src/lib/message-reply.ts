import type { ChatMessage } from './types';

export interface MessageReplyRef {
  id: string;
  preview: string;
  senderLabel: string;
}

export function replyPreviewForMessage(message: ChatMessage): string {
  const content = message.content;
  if (content.kind === 'text') return content.body.slice(0, 160);
  if (content.kind === 'voice') return 'Voice message';
  if (content.kind === 'image') return 'Photo';
  if (content.kind === 'video') return 'Video';
  if (content.kind === 'file') return content.fileName || 'File';
  return 'Message';
}

export function buildReplyRef(message: ChatMessage, senderLabel: string): MessageReplyRef {
  return {
    id: message.id,
    preview: replyPreviewForMessage(message),
    senderLabel,
  };
}
