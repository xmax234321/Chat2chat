import type { WebSocket } from 'ws';
import { encodeWire, type SealedEnvelope, type GroupDeletePolicyWire } from '@chat2chat/protocol';
import { config } from './config.js';

export interface QueuedMessage {
  envelope: SealedEnvelope;
  expiresAt: number;
}

export const messageQueue = new Map<string, QueuedMessage>();
export const connections = new Map<string, Set<WebSocket>>();
const messageViews = new Map<string, Set<string>>();

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

export function enqueue(envelope: SealedEnvelope): void {
  messageQueue.set(queueKey(envelope.recipientId, envelope.messageId), {
    envelope,
    expiresAt: Date.now() + config.messageTtlMs,
  });
}

export function dequeue(recipientId: string, messageId: string): boolean {
  return messageQueue.delete(queueKey(recipientId, messageId));
}

function viewThreshold(memberCount: number, policy: GroupDeletePolicyWire): number {
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

export function recordMessageView(
  viewerId: string,
  messageId: string,
  memberCount: number,
  policy: GroupDeletePolicyWire,
): boolean {
  let viewers = messageViews.get(messageId);
  if (!viewers) {
    viewers = new Set();
    messageViews.set(messageId, viewers);
  }
  viewers.add(viewerId);
  const threshold = viewThreshold(memberCount, policy);
  if (viewers.size >= threshold) {
    messageViews.delete(messageId);
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
