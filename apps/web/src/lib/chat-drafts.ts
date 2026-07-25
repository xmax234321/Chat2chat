const STORAGE_KEY = 'chat2chat-composer-drafts';

type DraftMap = Record<string, string>;

function readMap(): DraftMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DraftMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: DraftMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function loadChatDraft(chatId: string): string {
  return readMap()[chatId] ?? '';
}

export function saveChatDraft(chatId: string, text: string): void {
  const map = readMap();
  const trimmed = text;
  if (!trimmed) {
    if (!(chatId in map)) return;
    delete map[chatId];
  } else {
    map[chatId] = trimmed;
  }
  writeMap(map);
}
