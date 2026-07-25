import { useCallback } from 'react';
import { isMobileShell } from '../lib/platform';

/** Prevent iOS WKWebView from scrolling the page when focusing chat inputs. */
export function useIosInputScrollFix() {
  return useCallback((e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (!isMobileShell()) return;
    const el = e.currentTarget;
    el.readOnly = true;
    requestAnimationFrame(() => {
      el.readOnly = false;
      el.focus({ preventScroll: true });
    });
  }, []);
}
