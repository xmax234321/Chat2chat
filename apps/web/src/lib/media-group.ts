import type { AlbumMediaContent, ChatMessage, MediaGroupFields, MessageContent } from './types';

export type { MediaGroupFields } from './types';

export function generateMediaGroupId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function isAlbumMediaContent(content: MessageContent): content is AlbumMediaContent {
  if (content.kind !== 'image' && content.kind !== 'video') return false;
  return (
    typeof content.mediaGroupId === 'string' &&
    content.mediaGroupId.length > 0 &&
    typeof content.mediaGroupTotal === 'number' &&
    content.mediaGroupTotal > 1
  );
}

export function albumPreviewFromMember(content: AlbumMediaContent): string {
  const total = content.mediaGroupTotal;
  if (content.kind === 'image') return total === 1 ? 'Photo' : `${total} photos`;
  return total === 1 ? 'Video' : `${total} videos`;
}

export function albumPreviewLabel(messages: ChatMessage[]): string {
  let photos = 0;
  let videos = 0;
  for (const message of messages) {
    const kind = message.content.kind;
    if (kind === 'image') photos += 1;
    else if (kind === 'video') videos += 1;
  }
  const parts: string[] = [];
  if (photos) parts.push(photos === 1 ? '1 photo' : `${photos} photos`);
  if (videos) parts.push(videos === 1 ? '1 video' : `${videos} videos`);
  return parts.join(', ') || 'Album';
}

export type ThreadItem =
  | { type: 'message'; message: ChatMessage }
  | { type: 'album'; messages: ChatMessage[] };

function sameAlbumBucket(a: ChatMessage, b: ChatMessage): boolean {
  if (a.contactId !== b.contactId) return false;
  if (a.direction !== b.direction) return false;
  if ((a.senderId ?? '') !== (b.senderId ?? '')) return false;
  if (!isAlbumMediaContent(a.content) || !isAlbumMediaContent(b.content)) return false;
  return a.content.mediaGroupId === b.content.mediaGroupId;
}

export function buildThreadItems(thread: ChatMessage[]): ThreadItem[] {
  const items: ThreadItem[] = [];
  let index = 0;

  while (index < thread.length) {
    const message = thread[index];
    if (!isAlbumMediaContent(message.content)) {
      items.push({ type: 'message', message });
      index += 1;
      continue;
    }

    const album = [message];
    index += 1;
    while (index < thread.length && sameAlbumBucket(message, thread[index])) {
      album.push(thread[index]);
      index += 1;
    }

    album.sort(
      (a, b) =>
        (isAlbumMediaContent(a.content) ? a.content.mediaGroupIndex : 0) -
        (isAlbumMediaContent(b.content) ? b.content.mediaGroupIndex : 0),
    );
    items.push({ type: 'album', messages: album });
  }

  return items;
}

export function albumMessageIds(messages: ChatMessage[]): string[] {
  return messages.map((message) => message.id);
}

/** Photo/video messages in thread order that can be opened in the fullscreen viewer. */
export function buildViewableChatMedia(thread: ChatMessage[]): ChatMessage[] {
  return thread.filter((message) => {
    const content = message.content;
    if (content.kind !== 'image' && content.kind !== 'video') return false;
    if (content.uploading) return false;
    if (content.expiredPlaceholder) return false;
    return true;
  });
}

export function mediaGroupWireFields(
  content: MessageContent,
): Partial<MediaGroupFields> | undefined {
  if (!isAlbumMediaContent(content)) return undefined;
  return {
    mediaGroupId: content.mediaGroupId,
    mediaGroupIndex: content.mediaGroupIndex,
    mediaGroupTotal: content.mediaGroupTotal,
  };
}

export function mediaGroupWireFieldsFromPick(
  picked: Pick<import('./pick-media').PickedMedia, 'mediaGroupId' | 'mediaGroupIndex' | 'mediaGroupTotal'>,
): Partial<MediaGroupFields> | undefined {
  if (!picked.mediaGroupId || !picked.mediaGroupTotal || picked.mediaGroupTotal <= 1) return undefined;
  return {
    mediaGroupId: picked.mediaGroupId,
    mediaGroupIndex: picked.mediaGroupIndex ?? 0,
    mediaGroupTotal: picked.mediaGroupTotal,
  };
}
