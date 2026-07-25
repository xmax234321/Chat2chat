const LAST_CHAT_KEY = 'chat2chat.lastMobileChat';

type WarmListener = (contactId: string) => void;

let warmListener: WarmListener | null = null;

export function primeMobileChat(contactId: string): void {
  try {
    localStorage.setItem(LAST_CHAT_KEY, contactId);
  } catch {
    // ignore
  }
  warmListener?.(contactId);
}

export function readLastMobileChatId(): string | null {
  try {
    return localStorage.getItem(LAST_CHAT_KEY);
  } catch {
    return null;
  }
}

export function subscribeMobileChatWarm(listener: WarmListener): () => void {
  warmListener = listener;
  return () => {
    if (warmListener === listener) warmListener = null;
  };
}
