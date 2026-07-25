import { decryptPairBundle } from './crypto';
import {
  decodeDesktopLinkFrame,
  encodeDesktopLinkFrame,
  type DesktopLinkOffer,
  type DesktopLinkWire,
} from './protocol';

const DESKTOP_LINK_TOKEN_KEY = 'chat2chat-desktop-link-token';

type ElectronDesktopLink = {
  start: (offer: DesktopLinkOffer) => Promise<{ host: string; port: number }>;
  startSession: (offer: DesktopLinkOffer) => Promise<{ host: string; port: number }>;
  stop: (options?: { force?: boolean }) => Promise<void>;
  sendBle: (frame: string) => Promise<void>;
  onPaired: (cb: (data: unknown) => void) => () => void;
  onBleMessage: (cb: (frame: string) => void) => () => void;
  onPhoneOnline: (cb: (online: boolean) => void) => () => void;
};

function electronBridge(): ElectronDesktopLink | null {
  const w = window as unknown as { chat2chat?: { desktopLink?: ElectronDesktopLink } };
  return w.chat2chat?.desktopLink ?? null;
}

export type DesktopLinkMessageHandler = (frame: DesktopLinkWire) => void;

let messageHandler: DesktopLinkMessageHandler | null = null;

export function loadDesktopLinkToken(): string | null {
  try {
    return localStorage.getItem(DESKTOP_LINK_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveDesktopLinkToken(token: string): void {
  try {
    localStorage.setItem(DESKTOP_LINK_TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearDesktopLinkToken(): void {
  try {
    localStorage.removeItem(DESKTOP_LINK_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export async function startDesktopLinkAdvertising(offer: DesktopLinkOffer): Promise<DesktopLinkOffer> {
  const bridge = electronBridge();
  if (!bridge) throw new Error('Desktop linking requires the Chat2Chat desktop app');
  const started = await bridge.start(offer);
  return { ...offer, host: started.host, port: started.port };
}

export async function startDesktopLinkSession(offer: DesktopLinkOffer): Promise<DesktopLinkOffer> {
  const bridge = electronBridge();
  if (!bridge?.startSession) throw new Error('Desktop linking requires the Chat2Chat desktop app');
  const started = await bridge.startSession(offer);
  return { ...offer, host: started.host, port: started.port };
}

export async function stopDesktopLinkAdvertising(options?: { force?: boolean }): Promise<void> {
  await electronBridge()?.stop(options);
}

export function bindDesktopLinkHandlers(options: {
  onPaired: (bundle: Awaited<ReturnType<typeof decryptPairBundle>>, token: string) => void;
  onMessage?: DesktopLinkMessageHandler;
  onPhoneOnline?: (online: boolean) => void;
}): () => void {
  const bridge = electronBridge();
  if (!bridge) return () => {};

  messageHandler = options.onMessage ?? null;

  const unsubs = [
    bridge.onPaired((data) => {
      const payload = data as { token: string; bundle: string };
      void decryptPairBundle(payload.token, payload.bundle).then((bundle) => {
        options.onPaired(bundle, payload.token);
      });
    }),
    bridge.onBleMessage((raw) => {
      const frame = decodeDesktopLinkFrame(raw);
      if (frame) messageHandler?.(frame);
    }),
    bridge.onPhoneOnline((online) => options.onPhoneOnline?.(online)),
  ];

  return () => {
    for (const unsub of unsubs) unsub();
    messageHandler = null;
  };
}

export async function sendDesktopBleFrame(frame: DesktopLinkWire): Promise<void> {
  await electronBridge()?.sendBle(encodeDesktopLinkFrame(frame));
}

export async function sendRelayViaPhone(
  recipientId: string,
  messageId: string,
  payload: string,
): Promise<void> {
  await sendDesktopBleFrame({ type: 'send_relay', recipientId, messageId, payload });
}
