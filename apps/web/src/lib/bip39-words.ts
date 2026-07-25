import { wordlist } from '@scure/bip39/wordlists/english';

export const BIP39_WORDS = wordlist;
export const BIP39_WORD_SET = new Set(wordlist);
export const MNEMONIC_WORD_COUNT = 12;

export function suggestWords(prefix: string, limit = 8): string[] {
  const p = prefix.trim().toLowerCase();
  if (!p) return [];
  const out: string[] = [];
  for (const w of wordlist) {
    if (w.startsWith(p)) {
      out.push(w);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function isValidBip39Word(word: string): boolean {
  const w = word.trim().toLowerCase();
  return w.length > 0 && BIP39_WORD_SET.has(w);
}

export function parseMnemonicWords(text: string): string[] {
  return text.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export function wordsToMnemonic(words: string[]): string {
  return words.map((w) => w.trim().toLowerCase()).filter(Boolean).join(' ');
}

export function isCompleteMnemonic(words: string[]): boolean {
  return words.length === MNEMONIC_WORD_COUNT && words.every((w) => isValidBip39Word(w));
}

export function emptyMnemonicWords(): string[] {
  return Array.from({ length: MNEMONIC_WORD_COUNT }, () => '');
}

export function splitMnemonicToWords(mnemonic: string): string[] {
  const parts = parseMnemonicWords(mnemonic);
  const words = emptyMnemonicWords();
  for (let i = 0; i < Math.min(parts.length, MNEMONIC_WORD_COUNT); i++) {
    words[i] = parts[i]!;
  }
  return words;
}
