const STORAGE_KEY = 'chat2chat.privacyStorySeen';

export type PrivacyStorySlide = {
  id: string;
  title: string;
  body: string;
  cosmosSeed: string;
};

export const PRIVACY_STORY_SLIDES: PrivacyStorySlide[] = [
  {
    id: 'your-data',
    title: 'YOUR DATA',
    body: 'Every day, governments around the world seek access to private conversations, personal data, and the people behind them.',
    cosmosSeed: 'your-data',
  },
  {
    id: 'always-watching',
    title: 'ALWAYS WATCHING',
    body: 'Corporations collect what you say, what you share, who you talk to, and when you do it.',
    cosmosSeed: 'always-watching',
  },
  {
    id: 'truly-yours',
    title: 'TRULY YOURS',
    body: 'We believe your conversations should belong to you — and only you.',
    cosmosSeed: 'truly-yours',
  },
  {
    id: 'welcome',
    title: 'Welcome to Chat2Chat.',
    body: '',
    cosmosSeed: 'welcome',
  },
];

export function hasSeenPrivacyStory(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markPrivacyStorySeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // ignore quota / private mode
  }
}

export function clearPrivacyStorySeen(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
