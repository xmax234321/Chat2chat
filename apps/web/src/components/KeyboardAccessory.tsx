import { createPortal } from 'react-dom';
import { useRef, type ReactNode } from 'react';
import { useFixedAboveKeyboard } from '../hooks/useFixedAboveKeyboard';
import { isMobileShell } from '../lib/platform';

type Props = {
  visible: boolean;
  children: ReactNode;
  className?: string;
};

/** Fixed bar directly above the iOS keyboard (BIP39 suggestions, etc.). */
export function KeyboardAccessory({ visible, children, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useFixedAboveKeyboard(ref, visible);

  if (!visible) return null;

  const bar = (
    <div
      ref={ref}
      className={className ?? 'keyboard-accessory'}
      role="toolbar"
      aria-label="Suggestions"
    >
      {children}
    </div>
  );

  if (isMobileShell()) {
    return createPortal(bar, document.body);
  }

  return bar;
}
