import { randomBytes } from 'node:crypto';
import WebSocket from 'ws';
import { padToBucket, unpadFromBucket } from '@chat2chat/crypto';
import {
  ATTACHMENT_META_BUCKET,
  createEnvelope,
  decodeCiphertextBucket,
  decodeWire,
  encodeWire,
  type BlobAckPayload,
  type DeliveryAckPayload,
  type RegisterAckPayload,
  type SealedEnvelope,
  type WireMessage,
} from '@chat2chat/protocol';

export interface TransportClientOptions {
  serverUrl: string;
  userId: string;
  appVersion?: string;
  appBuild?: string;
  onMessage?: (envelope: SealedEnvelope, plaintext: Uint8Array) => void;
  /** Called for attachment metadata envelopes (photo/video) */
  onAttachment?: (envelope: SealedEnvelope, paddedBucket: Uint8Array) => void | Promise<void>;
  onError?: (error: Error) => void;
  /** Auto-ACK delivery after onMessage/onAttachment (default: true) */
  autoAck?: boolean;
}

/**
 * WebSocket transport client.
 * Handles registration, sealed envelope send/receive, and delivery ACK
 * (triggering server-side deletion).
 */
export class TransportClient {
  private ws: WebSocket | null = null;
  private deviceToken: string;
  private connected = false;
  private readonly pendingAcks = new Set<string>();

  constructor(private readonly options: TransportClientOptions) {
    this.deviceToken = randomBytes(16).toString('hex');
    if (options.autoAck === undefined) options.autoAck = true;
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.options.serverUrl);
      this.ws = ws;

      ws.on('open', () => {
        this.send({
          v: 1,
          type: 'register',
          payload: {
            userId: this.options.userId,
            deviceToken: this.deviceToken,
            appVersion: this.options.appVersion,
            appBuild: this.options.appBuild,
          },
        });
      });

      ws.on('message', (data) => {
        try {
          const msg = decodeWire(data.toString());
          this.handleWireMessage(msg, resolve);
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });

      ws.on('error', (err) => {
        this.options.onError?.(err);
        reject(err);
      });

      ws.on('close', () => {
        this.connected = false;
      });
    });
  }

  private handleWireMessage(msg: WireMessage, onRegistered: () => void): void {
    switch (msg.type) {
      case 'register_ack': {
        const ack = msg.payload as RegisterAckPayload;
        if (!ack.ok) {
          const err = new Error(ack.message ?? 'Registration rejected');
          this.options.onError?.(err);
          this.ws?.close();
          throw err;
        }
        this.connected = true;
        onRegistered();
        break;
      }
      case 'envelope': {
        const envelope = msg.payload as SealedEnvelope;
        void this.handleIncoming(envelope);
        break;
      }
      case 'error': {
        this.options.onError?.(new Error(JSON.stringify(msg.payload)));
        break;
      }
      default:
        break;
    }
  }

  private async handleIncoming(envelope: SealedEnvelope): Promise<void> {
    const bucket = decodeCiphertextBucket(envelope.ciphertext);

    // Attachment metadata uses larger bucket (2048 bytes)
    if (bucket.length === ATTACHMENT_META_BUCKET) {
      await this.options.onAttachment?.(envelope, bucket);
      if (this.options.autoAck) await this.ackDelivery(envelope.messageId);
      return;
    }

    const plaintext = unpadFromBucket(bucket);
    await this.options.onMessage?.(envelope, plaintext);
    if (this.options.autoAck) await this.ackDelivery(envelope.messageId);
  }

  /** Send pre-padded bucket (text or attachment metadata) */
  sendRaw(recipientId: string, messageId: string, paddedBucket: Uint8Array): void {
    if (!this.ws || !this.connected) {
      throw new Error('Not connected');
    }
    const envelope = createEnvelope({
      recipientId,
      messageId,
      paddedCiphertext: paddedBucket,
    });
    this.send({ v: 1, type: 'envelope', payload: envelope });
  }

  /** Send padded ciphertext to recipient via relay */
  sendPlaintext(recipientId: string, messageId: string, plaintext: Uint8Array): void {
    this.sendRaw(recipientId, messageId, padToBucket(plaintext));
  }

  /** Confirm blob saved locally — server deletes ephemeral blob */
  sendBlobAck(blobId: string): void {
    if (!this.ws || !this.connected) return;
    this.send({
      v: 1,
      type: 'blob_ack',
      payload: { blobId } satisfies BlobAckPayload,
    });
  }

  /** Confirm local persistence — server deletes ephemeral copy */
  async ackDelivery(messageId: string): Promise<void> {
    if (!this.ws || !this.connected) return;
    if (this.pendingAcks.has(messageId)) return;
    this.pendingAcks.add(messageId);
    this.send({
      v: 1,
      type: 'delivery_ack',
      payload: { messageId } satisfies DeliveryAckPayload,
    });
  }

  private send<T>(msg: WireMessage<T>): void {
    this.ws?.send(encodeWire(msg));
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
