import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppLockPasscodeType } from '../lib/app-lock';
import { loadAppLockPasscodeType } from '../lib/app-lock';

type Props = {
  mode?: AppLockPasscodeType;
  creating?: boolean;
  title?: string;
  subtitle?: string;
  error?: string;
  disabled?: boolean;
  busy?: boolean;
  resetToken?: number;
  autoFocus?: boolean;
  keyboardPaused?: boolean;
  onComplete: (pin: string) => void;
  onPinChange?: () => void;
};

export function PinPad({
  mode,
  creating = false,
  title,
  subtitle,
  error,
  disabled = false,
  busy = false,
  resetToken = 0,
  autoFocus = true,
  keyboardPaused = false,
  onComplete,
  onPinChange,
}: Props) {
  const passcodeType = mode ?? loadAppLockPasscodeType();
  const isAlphanumeric = passcodeType === 'alphanumeric';
  const digitCount = passcodeType === '6' ? 6 : passcodeType === '4' ? 4 : null;

  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const locked = disabled || busy;

  const focusInput = useCallback(() => {
    if (locked) return;
    inputRef.current?.focus({ preventScroll: true });
  }, [locked]);

  useEffect(() => {
    if (keyboardPaused) {
      inputRef.current?.blur();
      return;
    }
    setValue('');
    if (autoFocus) focusInput();
  }, [resetToken, passcodeType, focusInput, autoFocus, keyboardPaused]);

  const handleChange = (next: string) => {
    if (locked) return;
    let cleaned = next;
    if (!isAlphanumeric) {
      cleaned = next.replace(/\D/g, '').slice(0, digitCount ?? 0);
    } else {
      cleaned = next.replace(/[^a-zA-Z0-9]/g, '');
    }
    setValue(cleaned);
    onPinChange?.();
    if (!isAlphanumeric && digitCount != null && cleaned.length === digitCount) {
      onComplete(cleaned);
    }
  };

  const submitAlphanumeric = () => {
    if (locked || !value.trim()) return;
    onComplete(value);
  };

  return (
    <div className="pin-pad">
      {title && <h2 className="pin-pad-title">{title}</h2>}
      {subtitle && <p className="pin-pad-subtitle">{subtitle}</p>}

      {isAlphanumeric ? (
        <div className="pin-passphrase-wrap">
          <input
            ref={inputRef}
            className="pin-passphrase-input"
            type="password"
            inputMode="text"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            autoComplete={creating ? 'new-password' : 'current-password'}
            placeholder="Enter passcode"
            value={value}
            disabled={locked}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={() => {
              if (!locked && autoFocus && !keyboardPaused) window.setTimeout(() => focusInput(), 0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitAlphanumeric();
              }
            }}
          />
          <button
            type="button"
            className="btn-primary pin-passphrase-submit"
            disabled={disabled || value.length < 4}
            onClick={submitAlphanumeric}
          >
            Continue
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="pin-boxes-hit"
          onClick={focusInput}
          disabled={locked}
          aria-label={`Enter ${digitCount}-digit passcode`}
        >
          <div className="pin-boxes" aria-hidden>
            {Array.from({ length: digitCount ?? 4 }, (_, i) => {
              const char = value[i];
              return (
                <span
                  key={i}
                  className={`pin-box${char ? ' pin-box-filled' : ''}${error ? ' pin-box-error' : ''}${
                    i === value.length ? ' pin-box-active' : ''
                  }`}
                >
                  {char ?? ''}
                </span>
              );
            })}
          </div>
          <input
            ref={inputRef}
            className="pin-native-input"
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={digitCount ?? undefined}
            value={value}
            disabled={locked}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={() => {
              if (!locked && autoFocus && !keyboardPaused) window.setTimeout(() => focusInput(), 0);
            }}
            aria-hidden
            tabIndex={-1}
          />
        </button>
      )}

      {error && <p className="pin-pad-error">{error}</p>}
    </div>
  );
}
