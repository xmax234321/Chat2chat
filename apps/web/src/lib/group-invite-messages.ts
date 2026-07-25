import type { ChatMessage } from './types';

/** Keep one pending invite bubble per chat + group. */
export function dedupePendingGroupInviteMessages(messages: ChatMessage[]): ChatMessage[] {
  const latestByKey = new Map<string, ChatMessage>();
  const others: ChatMessage[] = [];

  for (const message of messages) {
    if (message.content.kind === 'group_invite' && message.content.status === 'pending') {
      const key = `${message.contactId}|${message.content.groupId}`;
      const prev = latestByKey.get(key);
      if (!prev || message.timestamp >= prev.timestamp) {
        latestByKey.set(key, message);
      }
      continue;
    }
    others.push(message);
  }

  return [...others, ...latestByKey.values()].sort((a, b) => a.timestamp - b.timestamp);
}
