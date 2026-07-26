import { randomBytes as nodeRandomBytes } from 'node:crypto';
import type { WebSocket } from 'ws';
import {
  decodeWire,
  encodeWire,
  type BlobAckPayload,
  type DeliveryAckPayload,
  type RegisterPayload,
  type RegisterVerifyPayload,
  type SealedEnvelope,
  type ViewAckPayload,
} from '@chat2chat/protocol';
import { base64UrlDecode, base64UrlEncode, verify } from '@chat2chat/crypto/server';
import type { FastifyInstance } from 'fastify';
import { handleBlobAck } from './blob.js';
import { isClientVersionSupported } from './client-version.js';
import { config } from './config.js';
import {
  addConnection,
  dequeue,
  deliverToRecipient,
  enqueue,
  flushPendingForUser,
  recordMessageView,
  registerGroupMeta,
  removeConnection,
} from './store.js';

const CHALLENGE_TTL_MS = 30_000;

interface PendingChallenge {
  userId: string;
  challenge: Uint8Array;
  expiresAt: number;
}

export async function registerWebSocketRoutes(app: FastifyInstance): Promise<void> {
  app.register(async (fastify) => {
    fastify.get('/ws', { websocket: true }, (socket: WebSocket) => {
      let registeredUserId: string | null = null;
      let pending: PendingChallenge | null = null;

      const sendError = (code: string, message: string) =>
        socket.send(encodeWire({ v: 1, type: 'error', payload: { code, message } }));

      socket.on('message', (raw) => {
        try {
          const msg = decodeWire(raw.toString());

          switch (msg.type) {
            case 'register': {
              const payload = msg.payload as RegisterPayload;
              const { userId, appVersion, appBuild } = payload;

              if (!userId?.startsWith('c2c_')) {
                sendError('BAD_USER_ID', 'Invalid userId');
                break;
              }

              if (config.enforceMinClientVersion) {
                const supported = isClientVersionSupported(
                  appVersion ? { version: appVersion, build: appBuild ?? '0' } : null,
                  { version: config.minClientVersion, build: config.minClientBuild },
                );
                if (!supported) {
                  socket.send(
                    encodeWire({
                      v: 1,
                      type: 'register_ack',
                      payload: {
                        ok: false,
                        serverTime: Date.now(),
                        code: 'UPGRADE_REQUIRED',
                        message: `Update Chat2Chat to ${config.minClientVersion} (build ${config.minClientBuild}) or newer. Older versions are no longer supported.`,
                        minVersion: config.minClientVersion,
                        minBuild: config.minClientBuild,
                      },
                    }),
                  );
                  socket.close(4003, 'upgrade required');
                  break;
                }
              }

              const challenge = new Uint8Array(nodeRandomBytes(32));
              const expiresAt = Date.now() + CHALLENGE_TTL_MS;
              pending = { userId, challenge, expiresAt };

              socket.send(
                encodeWire({
                  v: 1,
                  type: 'register_challenge',
                  payload: { challenge: base64UrlEncode(challenge), expiresAt },
                }),
              );
              break;
            }

            case 'register_verify': {
              const payload = msg.payload as RegisterVerifyPayload;

              if (!pending || pending.userId !== payload.userId || pending.expiresAt < Date.now()) {
                sendError('CHALLENGE_EXPIRED', 'Retry registration');
                socket.close(4001, 'challenge expired');
                break;
              }

              let ok = false;
              try {
                const signature = base64UrlDecode(payload.signature);
                ok = verify(payload.userId, pending.challenge, signature);
              } catch {
                ok = false;
              }

              const verifiedUserId = pending.userId;
              pending = null;

              if (!ok) {
                sendError('BAD_SIGNATURE', 'Signature verification failed');
                socket.close(4002, 'auth failed');
                break;
              }

              registeredUserId = verifiedUserId;
              addConnection(registeredUserId, socket);
              flushPendingForUser(registeredUserId);
              socket.send(
                encodeWire({
                  v: 1,
                  type: 'register_ack',
                  payload: { ok: true, serverTime: Date.now() },
                }),
              );
              break;
            }

            case 'envelope': {
              if (!registeredUserId) {
                sendError('NOT_REGISTERED', 'Complete registration before sending messages');
                break;
              }
              const envelope = msg.payload as SealedEnvelope;
              // Trusted because this frame arrived over registeredUserId's
              // own authenticated connection — not something a viewer can
              // forge later via view_ack.
              registerGroupMeta(envelope.messageId, envelope.groupMeta);
              const delivered = deliverToRecipient(envelope.recipientId, envelope);
              if (!delivered) enqueue(envelope);
              break;
            }

            case 'delivery_ack': {
              const { messageId } = msg.payload as DeliveryAckPayload;
              if (registeredUserId) dequeue(registeredUserId, messageId);
              break;
            }

            case 'view_ack': {
              const payload = msg.payload as ViewAckPayload;
              if (!registeredUserId) break;
              // memberCount/policy are no longer read from the client —
              // recordMessageView looks them up from the metadata the
              // sender registered when the message was sent.
              recordMessageView(registeredUserId, payload.messageId);
              break;
            }

            case 'blob_ack': {
              handleBlobAck(registeredUserId, msg.payload as BlobAckPayload);
              break;
            }

            case 'ping': {
              socket.send(encodeWire({ v: 1, type: 'pong', payload: {} }));
              break;
            }

            default:
              break;
          }
        } catch (err) {
          sendError('BAD_REQUEST', err instanceof Error ? err.message : 'Unknown error');
        }
      });

      socket.on('close', () => {
        pending = null;
        if (registeredUserId) removeConnection(registeredUserId, socket);
      });
    });
  });
}
