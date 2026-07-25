import { isCapacitor } from '../platform';
import { encryptPairBundle, type DesktopPairBundle, chunkBlePayload } from './crypto';
import {
  decodeDesktopLinkFrame,
  DESKTOP_LINK_RX_UUID,
  DESKTOP_LINK_SERVICE_UUID,
  DESKTOP_LINK_TX_UUID,
  encodeDesktopLinkFrame,
  type DesktopLinkOffer,
  type DesktopLinkWire,
} from './protocol';

export type DesktopLinkMessageHandler = (frame: DesktopLinkWire) => void;

let messageHandler: DesktopLinkMessageHandler | null = null;
let listenerRemove: (() => void) | null = null;
let rxBuffer: string[] = [];
let linkWs: WebSocket | null = null;
let usingBle = false;
let savedLinkOffer: DesktopLinkOffer | null = null;

async function getNative() {
  const { NativeDesktopLink } = await import('../native-desktop-link');
  return NativeDesktopLink;
}

export function setPhoneLinkEndpoint(offer: DesktopLinkOffer): void {
  savedLinkOffer = offer;
}

async function connectPhoneWs(offer: DesktopLinkOffer): Promise<void> {
  if (linkWs?.readyState === WebSocket.OPEN) return;

  await new Promise<void>((resolve, reject) => {
    if (linkWs) {
      linkWs.close();
      linkWs = null;
    }

    const ws = new WebSocket(`ws://${offer.host}:${offer.port}`);
    linkWs = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'link_register', role: 'phone', token: offer.token }));
      resolve();
    };
    ws.onerror = () => reject(new Error('Could not reach desktop on local network'));
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as { type?: string; payload?: string };
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }
        if (msg.type === 'link_frame' && msg.payload) {
          const frame = decodeDesktopLinkFrame(msg.payload);
          if (frame) messageHandler?.(frame);
        }
      } catch {
        /* ignore */
      }
    };
    ws.onclose = () => {
      if (linkWs === ws) linkWs = null;
      messageHandler?.({ type: 'phone_online', online: false });
    };
  });
}

export async function reconnectPhoneToDesktop(offer: DesktopLinkOffer): Promise<void> {
  setPhoneLinkEndpoint(offer);
  await connectPhoneWs(offer);
}

async function ensurePhoneLinkWs(): Promise<boolean> {
  if (linkWs?.readyState === WebSocket.OPEN) return true;
  if (!savedLinkOffer) return false;
  try {
    await connectPhoneWs(savedLinkOffer);
    return true;
  } catch {
    return false;
  }
}

export async function pairPhoneWithDesktop(
  offer: DesktopLinkOffer,
  bundle: DesktopPairBundle,
): Promise<void> {
  setPhoneLinkEndpoint(offer);
  const encrypted = await encryptPairBundle(offer.token, bundle);
  const pairUrl = `http://${offer.host}:${offer.port}/pair`;

  const res = await fetch(pairUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: offer.token,
      bundle: encrypted,
    }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Pairing failed (${res.status})`);
  }

  await connectPhoneWs(offer);

  if (isCapacitor()) {
    try {
      await connectPhoneBle(offer.serviceUuid);
      usingBle = true;
    } catch {
      usingBle = false;
    }
  }

  await writeBleFrame({ type: 'phone_online', online: true });
}

export async function connectPhoneBle(serviceUuid = DESKTOP_LINK_SERVICE_UUID): Promise<void> {
  if (!isCapacitor()) throw new Error('Bluetooth linking requires the mobile app');
  const native = await getNative();
  await native.disconnect().catch(() => {});
  const result = await native.connect({
    serviceUuid,
    rxUuid: DESKTOP_LINK_RX_UUID,
    txUuid: DESKTOP_LINK_TX_UUID,
    deviceNamePrefix: 'Chat2Chat',
  });
  if (!result.connected) throw new Error('Could not connect to desktop over Bluetooth');

  if (listenerRemove) listenerRemove();
  const handle = await native.addListener('message', (event) => {
    void handleBleChunk(event.value);
  });
  listenerRemove = () => void handle.remove();
  usingBle = true;
}

async function handleBleChunk(raw: string): Promise<void> {
  try {
    const parsed = JSON.parse(raw) as { kind?: string; index?: number; total?: number; data?: string };
    if (parsed.kind === 'chunk' && typeof parsed.data === 'string') {
      rxBuffer[parsed.index ?? rxBuffer.length] = parsed.data;
      if (rxBuffer.filter(Boolean).length === parsed.total) {
        const assembled = rxBuffer.join('');
        rxBuffer = [];
        const decoded = decodeDesktopLinkFrame(atob(assembled));
        if (decoded) messageHandler?.(decoded);
      }
      return;
    }
  } catch {
    /* fall through */
  }
  const frame = decodeDesktopLinkFrame(raw);
  if (frame) messageHandler?.(frame);
}

export async function writeBleFrame(frame: DesktopLinkWire): Promise<void> {
  const json = encodeDesktopLinkFrame(frame);
  const wsReady = await ensurePhoneLinkWs();

  if (wsReady && linkWs?.readyState === WebSocket.OPEN) {
    linkWs.send(JSON.stringify({ type: 'link_frame', from: 'phone', payload: json }));
  }

  if (!isCapacitor() || !usingBle) return;
  const native = await getNative();
  const b64 = btoa(json);
  const chunks = chunkBlePayload(b64);
  for (const chunk of chunks) {
    await native.write({ value: chunk });
  }
}

export async function sendMessageToDesktop(message: unknown): Promise<void> {
  await writeBleFrame({ type: 'sync_message', message });
}

export async function sendContactsToDesktop(contacts: unknown[]): Promise<void> {
  await writeBleFrame({ type: 'sync_contacts', contacts });
}

export function onDesktopLinkMessage(handler: DesktopLinkMessageHandler | null): void {
  messageHandler = handler;
}

export async function notifyPhoneLinkOffline(): Promise<void> {
  try {
    await writeBleFrame({ type: 'phone_online', online: false });
  } catch {
    /* ignore */
  }
  if (linkWs) {
    linkWs.close();
    linkWs = null;
  }
}

export async function disconnectPhoneBle(): Promise<void> {
  if (listenerRemove) {
    listenerRemove();
    listenerRemove = null;
  }
  rxBuffer = [];
  usingBle = false;
  savedLinkOffer = null;
  if (linkWs) {
    linkWs.close();
    linkWs = null;
  }
  if (!isCapacitor()) return;
  const native = await getNative();
  await native.disconnect().catch(() => {});
}

export async function isPhoneBleConnected(): Promise<boolean> {
  if (linkWs?.readyState === WebSocket.OPEN) return true;
  if (!isCapacitor()) return false;
  try {
    const native = await getNative();
    const state = await native.isConnected();
    return state.connected;
  } catch {
    return false;
  }
}
