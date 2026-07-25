import { base64UrlEncode, base64UrlDecode } from './base64.js';

/** Fixed envelope sizes for traffic analysis resistance */
export const MESSAGE_BUCKET_SIZE = 512;

export type WireMessageType =
  | 'register'
  | 'register_ack'
  | 'envelope'
  | 'group_envelope'
  | 'delivery_ack'
  | 'view_ack'
  | 'blob_ready'
  | 'blob_ack'
  | 'ping'
  | 'pong'
  | 'error';

export type GroupDeletePolicyWire =
  | { mode: 'all' }
  | { mode: 'majority' }
  | { mode: 'count'; count: number };

export interface GroupEnvelopeMeta {
  memberIds: string[];
  deletePolicy: GroupDeletePolicyWire;
}

export interface GroupEnvelopeWire {
  envelope: SealedEnvelope;
  meta: GroupEnvelopeMeta;
}

export interface WireMessage<T = unknown> {
  v: 1;
  type: WireMessageType;
  payload: T;
}

/** Sealed sender: server routes by opaque token, not plaintext sender ID */
export interface SealedEnvelope {
  /** Opaque routing token (derived from recipient + ephemeral id) */
  routeToken: string;
  /** Recipient user ID — minimal metadata required for delivery */
  recipientId: string;
  /** Unique message id for ACK / dedup */
  messageId: string;
  /** Unix ms timestamp (coarse, for TTL) */
  timestamp: number;
  /** Padded ciphertext bucket (base64url) */
  ciphertext: string;
  /** Optional sealed sender auth tag */
  senderToken?: string;
}

export interface RegisterPayload {
  userId: string;
  /** Ephemeral connection token */
  deviceToken: string;
  /** Client marketing version (e.g. 1.4.2) */
  appVersion?: string;
  /** Client build number (e.g. 50) */
  appBuild?: string;
}

export interface RegisterAckPayload {
  ok: boolean;
  serverTime: number;
  code?: string;
  message?: string;
  minVersion?: string;
  minBuild?: string;
}

export interface DeliveryAckPayload {
  messageId: string;
}

export interface ViewAckPayload {
  messageId: string;
  recipientId?: string;
  groupId?: string;
  memberCount?: number;
  policy?: GroupDeletePolicyWire;
}

export interface BlobAckPayload {
  blobId: string;
}

export interface BlobReadyPayload {
  blobId: string;
  recipientId: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export function encodeWire<T>(msg: WireMessage<T>): string {
  return JSON.stringify(msg);
}

export function decodeWire<T>(raw: string): WireMessage<T> {
  const parsed = JSON.parse(raw) as WireMessage<T>;
  if (parsed.v !== 1) throw new Error('Unsupported protocol version');
  return parsed;
}

export function encodeCiphertextBucket(bytes: Uint8Array): string {
  return base64UrlEncode(bytes);
}

export function decodeCiphertextBucket(encoded: string): Uint8Array {
  return base64UrlDecode(encoded);
}

/** Generate opaque route token from recipient + random bytes */
export function buildRouteToken(recipientId: string, randomPart: Uint8Array): string {
  const combined = `${recipientId}:${base64UrlEncode(randomPart)}`;
  return base64UrlEncode(new TextEncoder().encode(combined));
}

export function createEnvelope(params: {
  recipientId: string;
  messageId: string;
  paddedCiphertext: Uint8Array;
  senderToken?: string;
}): SealedEnvelope {
  const randomPart = crypto.getRandomValues(new Uint8Array(16));
  return {
    routeToken: buildRouteToken(params.recipientId, randomPart),
    recipientId: params.recipientId,
    messageId: params.messageId,
    timestamp: Date.now(),
    ciphertext: encodeCiphertextBucket(params.paddedCiphertext),
    senderToken: params.senderToken,
  };
}
