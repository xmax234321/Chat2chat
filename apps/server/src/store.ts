import type { WebSocket } from 'ws';
import { encodeWire, type SealedEnvelope, type GroupEnvelopeMeta } from '@chat2chat/protocol';
import { config } from './config.js';

export interface QueuedMessage {
  envelope: SealedEnvelope;
  expiresAt: number;
}

export const messageQueue = new Map<string, QueuedMessage>();
export const connections = new Map<string, Set<WebSocket>>();
const messageViews = new Map<string, Set<string>>();

/**
 * Trusted group metadata, keyed by messageId. Populated once, from the
 * first envelope carrying it that arrives over an authenticated sender
 * connection (see registerEnvelope below) — never from a viewer's own
 * view_ack claim. This is what closes the "any single client can force
 * group-message deletion by lying about memberCount" hole.
 */
const groupMetaByMessage = new Map<string, GroupEnvelopeMeta>();

const startedAt = Date.now();

export function serverUptimeMs(): number {
  return Date.now() - startedAt;
}

function queueKey(recipientId: string, messageId: string): string {
  return `${recipientId}:${messageId}`;
}

export function addConnection(userId: string, socket: WebSocket): void {
  let set = connections.get(userId);
  if (!set) {
    set = new Set();
    connections.set(userId, set);
  }
  set.add(socket);
}

export function removeConnection(userId: string, socket: WebSocket): void {
  const set = connections.get(userId);
  if (!set) return;
  set.delete(socket);
  if (set.size === 0) connections.delete(userId);
}

export function connectedSocketCount(): number {
  let n = 0;
  for (const set of connections.values()) n += set.size;
  return n;
}

export function deliverToRecipient(recipientId: string, envelope: SealedEnvelope): boolean {
  const sockets = connections.get(recipientId);
  if (!sockets || sockets.size === 0) return false;
  const raw = encodeWire({ v: 1, type: 'envelope', payload: envelope });
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) socket.send(raw);
  }
  return true;
}

/**
 * Record trusted group metadata for a message the first time we see it,
 * from an envelope that arrived over an authenticated sender connection.
 * Call this once per fan-out send (ws.ts does it for every 'envelope'
 * frame it relays), it's a no-op after the first call for a given id.
 */
export function registerGroupMeta(messageId: string, groupMeta: GroupEnvelopeMeta | undefined): void {
  if (!groupMeta) return;
  if (groupMetaByMessage.has(messageId)) return;
  groupMetaByMessage.set(messageId, groupMeta);
}

export function enqueue(envelope: SealedEnvelope): void {
  messageQueue.set(queueKey(envelope.recipientId, envelope.messageId), {
    envelope,
    expiresAt: Date.now() + config.messageTtlMs,
  });
}

export function dequeue(recipientId: string, messageId: string): boolean {
  return messageQueue.delete(queueKey(recipientId, messageId));
}

function viewThreshold(memberCount: number, policy: GroupEnvelopeMeta['deletePolicy']): number {
  if (policy.mode === 'all') return memberCount;
  if (policy.mode === 'majority') return Math.ceil(memberCount / 2);
  return Math.min(policy.count, memberCount);
}

export function dequeueAllForMessage(messageId: string): number {
  let removed = 0;
  for (const key of messageQueue.keys()) {
    if (key.endsWith(`:${messageId}`)) {
      messageQueue.delete(key);
      removed++;
    }
  }
  return removed;
}

/**
 * Record that `viewerId` has viewed `messageId`. memberCount/policy are no
 * longer accepted from the caller — they're looked up from the trusted
 * metadata recorded by registerGroupMeta at send time. A viewer who isn't
 * in the recorded member list is ignored. Messages with no group metadata
 * (plain 1:1 messages) fall back to a direct per-recipient dequeue.
 */
export function recordMessageView(viewerId: string, messageId: string): boolean {
  const meta = groupMetaByMessage.get(messageId);
  if (!meta) {
    dequeue(viewerId, messageId);
    return true;
  }
  if (!meta.memberIds.includes(viewerId)) return false;

  let viewers = messageViews.get(messageId);
  if (!viewers) {
    viewers = new Set();
    messageViews.set(messageId, viewers);
  }
  viewers.add(viewerId);

  const threshold = viewThreshold(meta.memberIds.length, meta.deletePolicy);
  if (viewers.size >= threshold) {
    messageViews.delete(messageId);
    groupMetaByMessage.delete(messageId);
    dequeueAllForMessage(messageId);
    return true;
  }
  return false;
}

export function flushExpiredMessages(): void {
  const now = Date.now();
  for (const [key, entry] of messageQueue) {
    if (entry.expiresAt <= now) messageQueue.delete(key);
  }
}

export function flushPendingForUser(userId: string): void {
  for (const [, entry] of messageQueue) {
    if (entry.envelope.recipientId === userId) {
      deliverToRecipient(userId, entry.envelope);
    }
  }
}

export function relayStats() {
  return {
    queuedMessages: messageQueue.size,
    connectedUsers: connections.size,
    connectedSockets: connectedSocketCount(),
    uptimeMs: serverUptimeMs(),
  };
}
