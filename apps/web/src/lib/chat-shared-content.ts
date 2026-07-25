import { isEphemeralContent } from './ephemeral-media';
import type { ChatMessage, MessageContent } from './types';

import { extractUrls } from './link-url';

type AttachmentMessageContent = Extract<MessageContent, { kind: 'image' | 'video' | 'file' }>;

export type SharedContentTab = 'media' | 'files' | 'links';

export type SharedMediaItem = ChatMessage & {
  content: AttachmentMessageContent & { kind: 'image' | 'video' };
};

export type SharedFileItem = ChatMessage & {
  content: AttachmentMessageContent & { kind: 'file' };
};

export interface SharedLinkItem {
  url: string;
  messageId: string;
  timestamp: number;
  preview: string;
}

export interface SharedContentSummary {
  media: SharedMediaItem[];
  files: SharedFileItem[];
  links: SharedLinkItem[];
}

function isShareableMessage(message: ChatMessage): boolean {
  if (message.content.kind === 'text' || message.content.kind === 'group_invite' || message.content.kind === 'export_block_notice') return true;
  return !isEphemeralContent(message.content) && !message.content.uploading;
}

export function collectSharedContent(thread: ChatMessage[]): SharedContentSummary {
  const media: SharedMediaItem[] = [];
  const files: SharedFileItem[] = [];
  const links: SharedLinkItem[] = [];
  const seenLinks = new Set<string>();

  for (const message of thread) {
    if (!isShareableMessage(message)) continue;
    const content = message.content;

    if (content.kind === 'image' || content.kind === 'video') {
      media.push(message as SharedMediaItem);
      continue;
    }

    if (content.kind === 'file') {
      files.push(message as SharedFileItem);
      continue;
    }

    if (content.kind === 'text') {
      const matches = extractUrls(content.body);
      for (const url of matches) {
        const normalized = url.toLowerCase();
        if (seenLinks.has(normalized)) continue;
        seenLinks.add(normalized);
        links.push({
          url,
          messageId: message.id,
          timestamp: message.timestamp,
          preview: content.body.trim().slice(0, 120),
        });
      }
    }
  }

  media.sort((a, b) => b.timestamp - a.timestamp);
  files.sort((a, b) => b.timestamp - a.timestamp);
  links.sort((a, b) => b.timestamp - a.timestamp);

  return { media, files, links };
}

export function truncateUserId(userId: string): string {
  if (userId.length <= 10) return userId;
  return `${userId.slice(0, 10)}…`;
}
