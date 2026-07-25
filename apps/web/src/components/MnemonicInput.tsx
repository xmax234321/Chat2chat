import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { KeyboardAccessory } from './KeyboardAccessory';
import {
  emptyMnemonicWords,
  isCompleteMnemonic,
  isValidBip39Word,
  MNEMONIC_WORD_COUNT,
  splitMnemonicToWords,
  suggestWords,
  wordsToMnemonic,
} from '../lib/bip39-words';

interface MnemonicInputProps {
  value: string;
  onChange: (mnemonic: string) => void;
  onCompleteChange?: (complete: boolean) => void;
}

export function MnemonicInput({ value, onChange, onCompleteChange }: MnemonicInputProps) {
  const [words, setWords] = useState(() => splitMnemonicToWords(value));
  const [active, setActive] = useState<number | null>(null);
  const [touched, setTouched] = useState<boolean[]>(() => Array(MNEMONIC_WORD_COUNT).fill(false));
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const pickingSuggestionRef = useRef(false);

  useEffect(() => {
    const next = splitMnemonicToWords(value);
    if (wordsToMnemonic(next) !== wordsToMnemonic(words)) {
      setWords(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    onCompleteChange?.(isCompleteMnemonic(words));
  }, [words, onCompleteChange]);

  const updateWords = (next: string[]) => {
    setWords(next);
    onChange(wordsToMnemonic(next));
  };

  const applyWord = (index: number, raw: string) => {
    const trimmed = raw.trim().toLowerCase();
    const next = [...words];
    next[index] = trimmed;
    updateWords(next);
    if (isValidBip39Word(trimmed) && index < MNEMONIC_WORD_COUNT - 1) {
      window.requestAnimationFrame(() => {
        inputRefs.current[index + 1]?.focus();
        setActive(index + 1);
      });
    }
  };

  const pickSuggestion = (index: number, word: string) => {
    const next = [...words];
    next[index] = word;
    updateWords(next);
    const touchedNext = [...touched];
    touchedNext[index] = true;
    setTouched(touchedNext);
    pickingSuggestionRef.current = true;
    setActive(index);
    window.requestAnimationFrame(() => {
      inputRefs.current[index]?.focus();
      window.setTimeout(() => {
        pickingSuggestionRef.current = false;
      }, 120);
    });
  };

  const onPaste = (index: number, text: string) => {
    const parts = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return;
    const next = [...words];
    let j = index;
    for (const part of parts) {
      if (j >= MNEMONIC_WORD_COUNT) break;
      next[j] = part;
      j++;
    }
    updateWords(next);
    setTouched(Array(MNEMONIC_WORD_COUNT).fill(true));
    inputRefs.current[Math.min(j, MNEMONIC_WORD_COUNT - 1)]?.focus();
  };

  const onKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (index < MNEMONIC_WORD_COUNT - 1) inputRefs.current[index + 1]?.focus();
      return;
    }
    if (e.key === 'Backspace' && !words[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const prefix = active !== null ? (words[active] ?? '').trim().toLowerCase() : '';
  const matches = prefix ? suggestWords(prefix, 2) : [];
  const primary = matches[0] ?? '';
  const secondary = matches[1] ?? '';
  const showSuggestions = active !== null && prefix.length > 0 && matches.length > 0;

  const onSuggestionDown = (word: string) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (active !== null) pickSuggestion(active, word);
  };

  return (
    <div className="mnemonic-input">
      <div className="mnemonic-grid">
        {words.map((word, i) => {
          const invalid = touched[i] && word.length > 0 && !isValidBip39Word(word);
          return (
            <div key={i} className={`mnemonic-cell${invalid ? ' invalid' : ''}`}>
              <span className="mnemonic-index">{String(i + 1).padStart(2, '0')}</span>
              <input
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="text"
                className="mnemonic-word-input"
                value={word}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                placeholder="word"
                onFocus={(e) => {
                  setActive(i);
                  e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }}
                onBlur={(e) => {
                  if (pickingSuggestionRef.current) return;
                  const next = e.relatedTarget as Node | null;
                  if (next && e.currentTarget.closest('.mnemonic-input')?.contains(next)) return;
                  window.setTimeout(() => setActive((cur) => (cur === i ? null : cur)), 250);
                  const touchedNext = [...touched];
                  touchedNext[i] = true;
                  setTouched(touchedNext);
                }}
                onChange={(e) => applyWord(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                onPaste={(e) => {
                  const text = e.clipboardData.getData('text');
                  if (text.includes(' ')) {
                    e.preventDefault();
                    onPaste(i, text);
                  }
                }}
              />
              {invalid && <span className="mnemonic-error">Unknown word</span>}
            </div>
          );
        })}
      </div>
      <KeyboardAccessory visible={showSuggestions}>
        <div className="mnemonic-suggestions" role="listbox" aria-label="BIP39 word suggestions">
          <div className="mnemonic-suggestion mnemonic-suggestion-quote" aria-hidden>
            «{prefix}»
          </div>
          <button
            type="button"
            className="mnemonic-suggestion mnemonic-suggestion-primary"
            onPointerDown={onSuggestionDown(primary)}
          >
            {primary}
          </button>
          {secondary ? (
            <button
              type="button"
              className="mnemonic-suggestion"
              onPointerDown={onSuggestionDown(secondary)}
            >
              {secondary}
            </button>
          ) : (
            <div className="mnemonic-suggestion mnemonic-suggestion-empty" aria-hidden />
          )}
        </div>
      </KeyboardAccessory>
    </div>
  );
}

export function resetMnemonicWords(): string[] {
  return emptyMnemonicWords();
}
