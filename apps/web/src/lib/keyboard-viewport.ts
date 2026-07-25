function findScrollableParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node && node !== document.documentElement) {
    const style = getComputedStyle(node);
    const overflowY = style.overflowY;
    if (
      (overflowY === 'auto' || overflowY === 'scroll' || node.classList.contains('screen-body')) &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function readKeyboardInset(): number {
  const root = getComputedStyle(document.documentElement);
  const height = parseFloat(root.getPropertyValue('--keyboard-height')) || 0;
  if (height > 0) return height;
  return parseFloat(root.getPropertyValue('--keyboard-inset')) || 0;
}

function usesSheetKeyboardLift(el: HTMLElement): boolean {
  return Boolean(
    el.closest('.share-contact-sheet, .share-contact-backdrop, .attach-sheet-backdrop, .contact-note-sheet'),
  );
}

/** Keep focused inputs/textareas visible above the iOS keyboard. */
export function scrollFieldIntoView(el: HTMLElement): void {
  if (el.classList.contains('pin-native-input')) return;
  if (el.closest('.media-gallery-detail-caption, .media-gallery-detail-composer')) return;
  if (usesSheetKeyboardLift(el)) return;

  const vv = window.visualViewport;
  const margin = 16;

  const rect = el.getBoundingClientRect();
  if (!vv) {
    el.scrollIntoView({ block: 'center', behavior: 'auto' });
    return;
  }

  const visibleTop = vv.offsetTop + margin;
  const visibleBottom = vv.offsetTop + vv.height - margin;

  if (rect.top >= visibleTop && rect.bottom <= visibleBottom) return;

  const scrollParent = findScrollableParent(el);
  if (scrollParent) {
    if (rect.bottom > visibleBottom) {
      scrollParent.scrollTop += rect.bottom - visibleBottom + margin;
    } else if (rect.top < visibleTop) {
      scrollParent.scrollTop -= visibleTop - rect.top + margin;
    }
    return;
  }

  const panel = el.closest(
    '.contact-label-screen-inner, .contact-rename-sheet, .contact-shared-fullscreen',
  ) as HTMLElement | null;
  if (panel) {
    const kb = readKeyboardInset();
    const shift = Math.max(0, Math.min(kb, rect.bottom - visibleBottom + margin));
    panel.style.transform = shift > 0 ? `translateY(${-shift}px)` : '';
  }
}

function clearPanelShift(el: HTMLElement): void {
  const panel = el.closest(
    '.contact-label-screen-inner, .contact-rename-sheet, .contact-shared-fullscreen',
  ) as HTMLElement | null;
  if (panel) panel.style.transform = '';
}

export function initKeyboardFieldScroll(): void {
  const onFocusIn = (event: FocusEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.matches('textarea, input, select, [contenteditable="true"]')) return;
    if (target.closest('.chat-composer-footer')) return;

    const run = () => scrollFieldIntoView(target);
    run();
    requestAnimationFrame(run);
    window.setTimeout(run, 120);
    window.setTimeout(run, 320);
  };

  const onFocusOut = (event: FocusEvent) => {
    const target = event.target;
    if (target instanceof HTMLElement) clearPanelShift(target);
  };

  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('focusout', onFocusOut);
  window.addEventListener('keyboard-inset-change', () => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.matches('textarea, input, select')) {
      scrollFieldIntoView(active);
    }
  });

  const vv = window.visualViewport;
  vv?.addEventListener('resize', () => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.matches('textarea, input, select')) {
      scrollFieldIntoView(active);
    }
  });
}
