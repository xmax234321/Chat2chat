import { initKeyboardFieldScroll } from './keyboard-viewport';

type CapacitorWindow = {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
  };
};

/** Inject relay URLs for the Capacitor shell (same pattern as Electron preload). */
export function initMobileBridge(): void {
  const cap = (window as unknown as CapacitorWindow).Capacitor;
  if (!cap?.isNativePlatform?.()) return;

  window.chat2chat = {
    isElectron: false,
    isCapacitor: true,
    platform: (cap.getPlatform?.() ?? 'ios') as NodeJS.Platform,
    serverWs: import.meta.env.VITE_CHAT2CHAT_SERVER ?? 'wss://api.chat2chat.org/ws',
    serverHttp: import.meta.env.VITE_CHAT2CHAT_HTTP ?? 'https://api.chat2chat.org',
  };
  document.documentElement.classList.add('native-shell');
  document.documentElement.style.setProperty('--keyboard-inset', '0px');
  document.documentElement.style.setProperty('--keyboard-height', '0px');
  watchSafeAreaInsets();
  initKeyboardViewportInsets();
  void initCapacitorKeyboard();
  initKeyboardFieldScroll();
  initNativeScrollLock();
  void initNativeChrome();
}

function measureKeyboardInset(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  return Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
}

function readKeyboardHeightVar(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--keyboard-height');
  return parseFloat(raw) || 0;
}

function setKeyboardOpen(open: boolean, keyboardHeight = 0): void {
  const root = document.documentElement;
  root.classList.toggle('keyboard-open', open);
  const inset = open ? (keyboardHeight > 0 ? keyboardHeight : measureKeyboardInset()) : 0;
  root.style.setProperty('--keyboard-inset', `${inset}px`);
  if (open && keyboardHeight > 0) {
    root.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
  } else if (!open) {
    root.style.setProperty('--keyboard-height', '0px');
  }
  window.dispatchEvent(new Event('keyboard-inset-change'));
}

function syncKeyboardFromViewport(): void {
  if (!document.documentElement.classList.contains('keyboard-open')) return;
  const fromVar = readKeyboardHeightVar();
  const inset = fromVar > 0 ? fromVar : measureKeyboardInset();
  document.documentElement.style.setProperty('--keyboard-inset', `${inset}px`);
  if (fromVar <= 0) {
    document.documentElement.style.setProperty('--keyboard-height', `${inset}px`);
  }
  window.dispatchEvent(new Event('keyboard-inset-change'));
}

/** Track visual viewport while the keyboard is open (BIP39 accessory bar, etc.). */
function initKeyboardViewportInsets(): void {
  const vv = window.visualViewport;
  if (!vv) return;

  const update = () => syncKeyboardFromViewport();

  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  window.addEventListener('resize', update);
}

async function initCapacitorKeyboard(): Promise<void> {
  try {
    const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');

    await Keyboard.setResizeMode({ mode: KeyboardResize.Native });

    const onWillShow = (info: { keyboardHeight?: number }) => {
      const height = Math.max(0, Math.round(info.keyboardHeight ?? 0));
      setKeyboardOpen(true, height);
      requestAnimationFrame(() => syncKeyboardFromViewport());
    };

    const onDidShow = () => {
      if (readKeyboardHeightVar() <= 0) {
        setKeyboardOpen(true, measureKeyboardInset());
      } else {
        syncKeyboardFromViewport();
      }
    };

    const onHide = () => setKeyboardOpen(false, 0);

    await Keyboard.addListener('keyboardWillShow', onWillShow);
    await Keyboard.addListener('keyboardDidShow', onDidShow);
    await Keyboard.addListener('keyboardWillHide', onHide);
    await Keyboard.addListener('keyboardDidHide', onHide);
  } catch {
    /* browser build */
  }
}

/** Read iOS safe-area insets for CSS (Dynamic Island / notch). */
function applySafeAreaInsets(): void {
  const cap = (window as unknown as CapacitorWindow).Capacitor;
  const root = document.documentElement;
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
  document.body.appendChild(probe);
  const s = getComputedStyle(probe);
  const ios = cap?.getPlatform?.() === 'ios';
  const top = parseFloat(s.paddingTop) || 0;
  const right = parseFloat(s.paddingRight) || 0;
  const bottomRaw = parseFloat(s.paddingBottom) || 0;
  const left = parseFloat(s.paddingLeft) || 0;
  const bottom = ios ? Math.max(bottomRaw, 34) : bottomRaw;
  document.body.removeChild(probe);

  root.style.setProperty('--safe-top', `${top}px`);
  root.style.setProperty('--safe-right', `${right}px`);
  root.style.setProperty('--safe-bottom', `${bottom}px`);
  root.style.setProperty('--safe-left', `${left}px`);
}

function watchSafeAreaInsets(): void {
  applySafeAreaInsets();
  window.addEventListener('resize', applySafeAreaInsets);
  window.addEventListener('orientationchange', applySafeAreaInsets);
}

async function initNativeChrome(): Promise<void> {
  try {
    const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
      import('@capacitor/status-bar'),
      import('@capacitor/splash-screen'),
    ]);
    await SplashScreen.hide();
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0B0B0C' });
    applySafeAreaInsets();
  } catch {
    /* browser build */
  }
}

const SCROLLABLE_SELECTOR =
  '.scroll-area, .screen-body.msg-list, .chat-panel-messages, .screen-body.onboarding-proof-body, .contact-shared-sheet-body, .contact-shared-fullscreen-body, .media-gallery-scroll, .media-gallery-batch-strip';

function findScrollableAncestor(start: EventTarget | null): HTMLElement | null {
  let el = start as HTMLElement | null;
  while (el && el !== document.documentElement) {
    if (el.matches(SCROLLABLE_SELECTOR)) return el;
    if (el.matches('textarea, input')) return el;
    el = el.parentElement;
  }
  return null;
}

const COMPOSER_INTERACTIVE_SELECTOR =
  '.msg-input-bar, .chat-composer-footer, .attach-sheet-backdrop, .attach-sheet-stack, .send-btn, .attach-btn';

function isComposerInteractiveTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el?.closest?.(COMPOSER_INTERACTIVE_SELECTOR));
}

/** Block rubber-band scroll on iOS; allow only marked scroll regions. */
function initNativeScrollLock(): void {
  document.addEventListener(
    'touchmove',
    (event) => {
      if (findScrollableAncestor(event.target)) return;
      if (isComposerInteractiveTarget(event.target)) return;
      event.preventDefault();
    },
    { passive: false },
  );
}
