/** BLE service + characteristics for phone ↔ desktop sync. */
export const DESKTOP_LINK_SERVICE_UUID = 'c2c0d001-0000-4000-8000-0000c2c00001';
export const DESKTOP_LINK_RX_UUID = 'c2c0d002-0000-4000-8000-0000c2c00002';
export const DESKTOP_LINK_TX_UUID = 'c2c0d003-0000-4000-8000-0000c2c00003';

export const DESKTOP_LINK_PAIR_TTL_MS = 120_000;
export const DESKTOP_LINK_DEFAULT_PORT = 3848;

export interface DesktopLinkOffer {
  version: 1;
  token: string;
  host: string;
  port: number;
  serviceUuid: string;
  expiresAt: number;
}

export type DesktopLinkWire =
  | { type: 'pair_request'; token: string; bundle: string }
  | { type: 'pair_ok'; desktopDeviceId: string }
  | { type: 'pair_error'; message: string }
  | { type: 'ping' }
  | { type: 'pong' }
  | { type: 'sync_message'; message: unknown }
  | { type: 'sync_contacts'; contacts: unknown[] }
  | { type: 'phone_online'; online: boolean }
  | { type: 'send_relay'; recipientId: string; messageId: string; payload: string };

export function buildDesktopLinkQr(offer: DesktopLinkOffer): string {
  const params = new URLSearchParams({
    t: offer.token,
    h: offer.host,
    p: String(offer.port),
    s: offer.serviceUuid,
    e: String(offer.expiresAt),
  });
  return `chat2chat://link-desktop/v1?${params.toString()}`;
}

export function parseDesktopLinkQr(text: string): DesktopLinkOffer | null {
  let raw = text.trim();
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* keep */
  }

  if (!/link-desktop/i.test(raw)) return null;

  let params: URLSearchParams;
  try {
    const url = new URL(raw.replace(/^chat2chat:\/\//, 'https://'));
    if (url.hostname !== 'link-desktop' && !url.pathname.includes('link-desktop')) return null;
    params = url.searchParams;
  } catch {
    const queryStart = raw.indexOf('?');
    if (queryStart === -1) return null;
    params = new URLSearchParams(raw.slice(queryStart + 1));
  }

  const token = params.get('t');
  const host = params.get('h');
  const port = Number(params.get('p') ?? DESKTOP_LINK_DEFAULT_PORT);
  const serviceUuid = params.get('s') ?? DESKTOP_LINK_SERVICE_UUID;
  const expiresAt = Number(params.get('e') ?? 0);
  if (!token || !host || !Number.isFinite(port)) return null;
  if (expiresAt > 0 && Date.now() > expiresAt) return null;

  return {
    version: 1,
    token,
    host,
    port,
    serviceUuid,
    expiresAt: expiresAt || Date.now() + DESKTOP_LINK_PAIR_TTL_MS,
  };
}

export function encodeDesktopLinkFrame(msg: DesktopLinkWire): string {
  return JSON.stringify(msg);
}

export function decodeDesktopLinkFrame(raw: string): DesktopLinkWire | null {
  try {
    return JSON.parse(raw) as DesktopLinkWire;
  } catch {
    return null;
  }
}
