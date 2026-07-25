/** Fisher–Yates shuffle (in-place copy). */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export const SEED_VERIFY_SLOT_COUNT = 5;

/** Pick one random index not in `exclude`. */
export function randomWordPositionExcluding(wordCount: number, exclude: Iterable<number>): number {
  const blocked = new Set(exclude);
  const available = Array.from({ length: wordCount }, (_, i) => i).filter((i) => !blocked.has(i));
  if (!available.length) {
    return Math.floor(Math.random() * wordCount);
  }
  return available[Math.floor(Math.random() * available.length)]!;
}

/** Pick `count` unique random word indices from a mnemonic (0-based). */
export function randomWordPositions(wordCount: number, count = SEED_VERIFY_SLOT_COUNT): number[] {
  const picked: number[] = [];
  while (picked.length < Math.min(count, wordCount)) {
    picked.push(randomWordPositionExcluding(wordCount, picked));
  }
  return picked.sort((a, b) => a - b);
}

export function shuffledWordBank(words: string[]): string[] {
  return shuffle(words);
}
