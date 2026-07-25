import type { WebSocket } from 'ws';
import {
  decodeWire,
  encodeWire,
  type BlobAckPayload,
  type DeliveryAckPayload,
  type RegisterPayload,
  type SealedEnvelope,
  type ViewAckPayload,
} from '@chat2chat/protocol';
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
  removeConnection,
} from './store.js';

export async function registerWebSocketRoutes(app: FastifyInstance): Promise<void> {
  app.register(async (fastify) => {
    fastify.get('/ws', { websocket: true }, (socket: WebSocket) => {
      let registeredUserId: string | null = null;

      socket.on('message', (raw) => {
        try {
          const msg = decodeWire(raw.toString());

          switch (msg.type) {
            case 'register': {
              const payload = msg.payload as RegisterPayload;
              const { userId, appVersion, appBuild } = payload;

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
                        message: `Update Chat2Chat to ${config.minClientVersion} (build ${config.minClientBuild}) or newer.`,
                        minVersion: config.minClientVersion,
                        minBuild: config.minClientBuild,
                      },
                    }),
                  );
                  socket.close(4003, 'upgrade required');
                  break;
                }
              }

              registeredUserId = userId;
              addConnection(userId, socket);
              flushPendingForUser(userId);
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
              const envelope = msg.payload as SealedEnvelope;
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
              if (payload.memberCount && payload.policy) {
                recordMessageView(
                  registeredUserId,
                  payload.messageId,
                  payload.memberCount,
                  payload.policy,
                );
              } else {
                dequeue(registeredUserId, payload.messageId);
              }
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
          socket.send(
            encodeWire({
              v: 1,
              type: 'error',
              payload: {
                code: 'BAD_REQUEST',
                message: err instanceof Error ? err.message : 'Unknown error',
              },
            }),
          );
        }
      });

      socket.on('close', () => {
        if (registeredUserId) removeConnection(registeredUserId, socket);
      });
    });
  });
}
