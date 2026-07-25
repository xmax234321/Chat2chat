import { useLayoutEffect, type RefObject } from 'react';

function positionComposer(el: HTMLElement): void {
  const vv = window.visualViewport;
  const keyboardOpen = document.documentElement.classList.contains('keyboard-open');
  const bottomInset =
    keyboardOpen && vv
      ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--keyboard-inset')) || 0;

  el.style.position = 'fixed';
  el.style.left = '0';
  el.style.right = '0';
  el.style.width = '100%';
  el.style.bottom = keyboardOpen ? `${bottomInset}px` : '0px';
  el.style.zIndex = '12060';
}

function trackKeyboardAnimation(update: () => void): void {
  let frame = 0;
  const tick = () => {
    update();
    frame += 1;
    if (frame < 45) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Keeps a bottom composer pinned above the iOS keyboard. */
export function usePinToKeyboardBottom(ref: RefObject<HTMLElement | null>, enabled: boolean): void {
  useLayoutEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const update = () => positionComposer(el);
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
      el.style.removeProperty('bottom');
      el.style.removeProperty('left');
      el.style.removeProperty('right');
      el.style.removeProperty('width');
      el.style.removeProperty('z-index');
    };
  }, [enabled, ref]);
}
