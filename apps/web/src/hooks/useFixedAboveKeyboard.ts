import { useLayoutEffect, type RefObject } from 'react';
import { isMobileShell } from '../lib/platform';

/** Matches iOS keyboard prediction bar height. */
const KEYBOARD_ACCESSORY_HEIGHT = 44;

function positionAboveKeyboard(el: HTMLElement): void {
  const keyboardOpen = document.documentElement.classList.contains('keyboard-open');

  if (!keyboardOpen) {
    el.style.removeProperty('position');
    el.style.removeProperty('top');
    el.style.removeProperty('bottom');
    el.style.removeProperty('left');
    el.style.removeProperty('right');
    return;
  }

  // With KeyboardResize.Native the webview already shrinks — pin to its bottom edge.
  el.style.position = 'fixed';
  el.style.left = '0';
  el.style.right = '0';
  el.style.bottom = '0';
  el.style.top = 'auto';
  el.style.height = `${KEYBOARD_ACCESSORY_HEIGHT}px`;
}

function trackKeyboardAnimation(update: () => void): void {
  let frame = 0;
  const tick = () => {
    update();
    frame += 1;
    if (frame < 40) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Pin an element to the bottom edge of the visible area above the iOS keyboard. */
export function useFixedAboveKeyboard(ref: RefObject<HTMLElement | null>, enabled: boolean): void {
  useLayoutEffect(() => {
    if (!enabled || !isMobileShell()) return;
    const el = ref.current;
    if (!el) return;

    const update = () => positionAboveKeyboard(el);

    update();
    trackKeyboardAnimation(update);

    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('keyboard-inset-change', () => trackKeyboardAnimation(update));

    const ro = new ResizeObserver(update);
    ro.observe(el);

    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('keyboard-inset-change', update);
      ro.disconnect();
      el.style.removeProperty('position');
      el.style.removeProperty('top');
      el.style.removeProperty('bottom');
      el.style.removeProperty('left');
      el.style.removeProperty('right');
      el.style.removeProperty('height');
    };
  }, [enabled, ref]);
}
