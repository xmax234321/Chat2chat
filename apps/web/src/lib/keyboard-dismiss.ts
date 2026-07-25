import { isCapacitor } from './platform';

export async function dismissKeyboard(): Promise<void> {
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();

  document.documentElement.classList.remove('keyboard-open');
  document.documentElement.style.setProperty('--keyboard-inset', '0px');
  document.documentElement.style.setProperty('--keyboard-height', '0px');

  if (!isCapacitor()) return;
  try {
    const { Keyboard } = await import('@capacitor/keyboard');
    await Keyboard.hide();
  } catch {
    /* browser */
  }
}
