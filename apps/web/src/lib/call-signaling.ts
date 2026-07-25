export type CallSignalType = 'ring' | 'offer' | 'answer' | 'ice' | 'hangup' | 'busy';

export interface CallSignal {
  kind: 'call';
  from: string;
  callId: string;
  type: CallSignalType;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export type CallSignalPayload = Omit<CallSignal, 'kind' | 'from'>;

export function encodeCallSignal(signal: CallSignal): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(signal));
}

export function decodeCallSignal(bytes: Uint8Array): CallSignal | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return isCallSignal(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isCallSignal(parsed: unknown): parsed is CallSignal {
  if (!parsed || typeof parsed !== 'object') return false;
  const s = parsed as Record<string, unknown>;
  if (s.kind !== 'call') return false;
  if (typeof s.from !== 'string' || !s.from.startsWith('c2c_')) return false;
  if (typeof s.callId !== 'string' || !s.callId) return false;
  const type = s.type;
  if (
    type !== 'ring' &&
    type !== 'offer' &&
    type !== 'answer' &&
    type !== 'ice' &&
    type !== 'hangup' &&
    type !== 'busy'
  ) {
    return false;
  }
  if (s.sdp !== undefined && (typeof s.sdp !== 'object' || s.sdp === null)) return false;
  if (s.candidate !== undefined && (typeof s.candidate !== 'object' || s.candidate === null)) return false;
  return true;
}
