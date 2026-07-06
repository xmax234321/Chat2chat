/**
 * Message encryption via ChainLock v1 bucket padding.
 * Browser/mobile clients use padding-only framing (no Double Ratchet on the wire).
 * A Node-side ChainLockSession provider may register ratchet-backed encryption separately.
 */
import {
  padToBucket as chainlockPad,
  unpadFromBucket as chainlockUnpad,
} from '@chat2chat/chainlock-padding';

export const CHAINLOCK_WIRE_MAGIC = new Uint8Array([0x43, 0x4c, 0x31, 0x00]); // "CL1\0"

export function padOutgoingPayload(bytes: Uint8Array): Uint8Array {
  const framed = frameChainLockWire(bytes);
  return chainlockPad(framed);
}

export function unpadIncomingPayload(padded: Uint8Array): Uint8Array {
  const framed = chainlockUnpad(padded);
  return unframeChainLockWire(framed);
}

/** Unpad inbound ChainLock bucket padding and wire framing. */
export function unpadIncomingAuto(padded: Uint8Array): Uint8Array {
  return unpadIncomingPayload(padded);
}

/** Detect ChainLock wire framing from unpadded inner bytes. */
export function isChainLockFramed(bytes: Uint8Array): boolean {
  return (
    bytes.length >= CHAINLOCK_WIRE_MAGIC.length &&
    CHAINLOCK_WIRE_MAGIC.every((b, i) => bytes[i] === b)
  );
}

function frameChainLockWire(payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(CHAINLOCK_WIRE_MAGIC.length + payload.length);
  out.set(CHAINLOCK_WIRE_MAGIC, 0);
  out.set(payload, CHAINLOCK_WIRE_MAGIC.length);
  return out;
}

function unframeChainLockWire(framed: Uint8Array): Uint8Array {
  if (!isChainLockFramed(framed)) {
    throw new Error('Invalid ChainLock wire frame');
  }
  return framed.subarray(CHAINLOCK_WIRE_MAGIC.length);
}

export interface ChainLockSessionProvider {
  encrypt(contactId: string, plaintext: Uint8Array): Promise<Uint8Array>;
  decrypt(contactId: string, padded: Uint8Array): Promise<Uint8Array>;
}

let nodeSessionProvider: ChainLockSessionProvider | null = null;

/** Register Node-side ChainLockSession provider (demo/server). */
export function registerChainLockSessionProvider(provider: ChainLockSessionProvider): void {
  nodeSessionProvider = provider;
}

export async function encryptOutgoingMessage(
  contactId: string,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  if (nodeSessionProvider) {
    return nodeSessionProvider.encrypt(contactId, plaintext);
  }
  return padOutgoingPayload(plaintext);
}

export async function decryptIncomingMessage(
  contactId: string,
  bytes: Uint8Array,
): Promise<Uint8Array> {
  if (nodeSessionProvider) {
    return nodeSessionProvider.decrypt(contactId, bytes);
  }
  // BrowserTransport already unpads the outer bucket; inner wire is CL1-framed JSON.
  if (isChainLockFramed(bytes)) {
    return unframeChainLockWire(bytes);
  }
  try {
    return unpadIncomingPayload(bytes);
  } catch {
    // Plain JSON after transport unpad (desktop relay / legacy standard padding).
    return bytes;
  }
}
