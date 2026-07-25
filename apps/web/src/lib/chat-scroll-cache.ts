export type ChatScrollSnapshot = {
  top: number;
  atBottom: boolean;
};

const cache = new Map<string, ChatScrollSnapshot>();

export function readChatScrollCache(contactId: string): ChatScrollSnapshot | undefined {
  return cache.get(contactId);
}

export function writeChatScrollCache(contactId: string, snapshot: ChatScrollSnapshot): void {
  cache.set(contactId, snapshot);
}

export function clearChatScrollCache(contactId: string): void {
  cache.delete(contactId);
}
