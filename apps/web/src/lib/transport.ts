import {
  ATTACHMENT_META_BUCKET,
  createEnvelope,
  decodeCiphertextBucket,
  decodeWire,
  encodeWire,
  type BlobAckPayload,
  type DeliveryAckPayload,
  type GroupEnvelopeMeta,
  type RegisterAckPayload,
  type RegisterChallengePayload,
  type SealedEnvelope,
  type ViewAckPayload,
  type WireMessage,
} from '@chat2chat/protocol';
import { base64UrlDecode, base64UrlEncode, padToBucket, unpadFromBucket } from '@chat2chat/crypto/browser';

export interface BrowserTransportOptions {
  serverUrl: string;
  userId: string;
  signData?: (data: Uint8Array) => Uint8Array;
  appVersion?: string;
  appBuild?: string;
  onMessage?: (envelope: SealedEnvelope, plaintext: Uint8Array) => void | Promise<void>;
  onAttachment?: (envelope: SealedEnvelope, bucket: Uint8Array) => void | Promise<void>;
  onError?: (error: Error) => void;
  onConnectionChange?: (connected: boolean) => void;
  onConnectingChange?: (connecting: boolean) => void;
  autoAck?: boolean;
  reconnect?: boolean;
}

type PendingPing = {
  sent: number;
  resolve: (ms: number) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class UpgradeRequiredError extends Error {
  readonly minVersion?: string;
  readonly minBuild?: string;

  constructor(message: string, minVersion?: string, minBuild?: string) {
    super(message);
    this.name = 'UpgradeRequiredError';
    this.minVersion = minVersion;
    this.minBuild = minBuild;
  }
}

export class BrowserTransport {
  private ws: WebSocket | null = null;
  private deviceToken: string;
  private connected = false;
  private connecting = false;
  private connectPromise: Promise<void> | null = null;
  private socketGeneration = 0;
  private pendingAcks = new Set<string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private pendingPing: PendingPing | null = null;

  constructor(private readonly options: BrowserTransportOptions) {
    this.deviceToken = randomHex(16);
    if (options.autoAck === undefined) options.autoAck = true;
    if (options.reconnect === undefined) options.reconnect = true;
  }

  connect(): Promise<void> {
    if (this.connected) return Promise.resolve();
    if (this.connecting && this.connectPromise) return this.connectPromise;

    this.shouldReconnect = true;
    this.connecting = true;
    this.options.onConnectingChange?.(true);

    this.connectPromise = new Promise((resolve, reject) => {
      this.disposeSocket();

      const generation = ++this.socketGeneration;
      const ws = new WebSocket(this.options.serverUrl);
      this.ws = ws;
      let settled = false;

      const finish = (err?: Error) => {
        if (settled) return;
        settled = true;
        this.connecting = false;
        this.connectPromise = null;
        if (err) reject(err);
        else resolve();
      };

      ws.onopen = () => {
        if (generation !== this.socketGeneration) return;
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
      };

      ws.onmessage = (ev) => {
        if (generation !== this.socketGeneration) return;
        try {
          const msg = decodeWire(String(ev.data));
          this.handleWire(
            msg,
            () => finish(),
            (err) => finish(err),
          );
        } catch (err) {
          this.options.onConnectingChange?.(false);
          finish(err instanceof Error ? err : new Error(String(err)));
        }
      };

      ws.onerror = () => {
        if (generation !== this.socketGeneration) return;
        this.options.onConnectingChange?.(false);
        finish(new Error('WebSocket error'));
      };

      ws.onclose = () => {
        if (generation !== this.socketGeneration) return;
        this.connected = false;
        this.connecting = false;
        this.connectPromise = null;
        this.ws = null;
        this.options.onConnectingChange?.(false);
        this.options.onConnectionChange?.(false);
        if (!settled) finish(new Error('WebSocket closed before register'));
        if (this.options.reconnect && this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };
    });

    return this.connectPromise;
  }

  private disposeSocket(): void {
    if (!this.ws) return;
    const stale = this.ws;
    this.ws = null;
    stale.onopen = null;
    stale.onmessage = null;
    stale.onerror = null;
    stale.onclose = null;
    if (stale.readyState === WebSocket.OPEN || stale.readyState === WebSocket.CONNECTING) {
      stale.close();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.connecting || this.connected) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.shouldReconnect || this.connected || this.connecting) return;
      this.connect().catch(() => {
        if (this.shouldReconnect) this.scheduleReconnect();
      });
    }, 3000);
  }

  private handleWire(
    msg: WireMessage,
    onRegistered: () => void,
    onFailed?: (error: Error) => void,
  ): void {
    switch (msg.type) {
      case 'register_challenge': {
        const payload = msg.payload as RegisterChallengePayload;
        if (!this.options.signData) {
          const err = new Error('Missing signing identity for relay registration');
          this.options.onConnectingChange?.(false);
          this.options.onError?.(err);
          onFailed?.(err);
          break;
        }
        const signature = this.options.signData(base64UrlDecode(payload.challenge));
        this.send({
          v: 1,
          type: 'register_verify',
          payload: {
            userId: this.options.userId,
            challenge: payload.challenge,
            signature: base64UrlEncode(signature),
          },
        });
        break;
      }
      case 'register_ack': {
        const ack = msg.payload as RegisterAckPayload;
        if (!ack.ok) {
          const err =
            ack.code === 'UPGRADE_REQUIRED'
              ? new UpgradeRequiredError(
                  ack.message ?? 'App update required',
                  ack.minVersion,
                  ack.minBuild,
                )
              : new Error(ack.message ?? 'Registration rejected');
          if (ack.code === 'UPGRADE_REQUIRED') {
            this.shouldReconnect = false;
          }
          this.options.onConnectingChange?.(false);
          this.options.onError?.(err);
          this.ws?.close();
          onFailed?.(err);
          return;
        }
        this.connected = true;
        this.connecting = false;
        this.options.onConnectingChange?.(false);
        this.options.onConnectionChange?.(true);
        onRegistered();
        break;
      }
      case 'envelope':
        void this.handleIncoming(msg.payload as SealedEnvelope);
        break;
      case 'pong': {
        const pending = this.pendingPing;
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingPing = null;
          pending.resolve(Math.max(0, Date.now() - pending.sent));
        }
        break;
      }
      case 'error':
        this.options.onError?.(new Error(JSON.stringify(msg.payload)));
        break;
      default:
        break;
    }
  }

  private async handleIncoming(envelope: SealedEnvelope): Promise<void> {
    const bucket = decodeCiphertextBucket(envelope.ciphertext);
    if (bucket.length === ATTACHMENT_META_BUCKET) {
      await this.options.onAttachment?.(envelope, bucket);
      if (this.options.autoAck) await this.ackDelivery(envelope.messageId);
      return;
    }
    const plaintext = unpadFromBucket(bucket);
    await this.options.onMessage?.(envelope, plaintext);
    if (this.options.autoAck) await this.ackDelivery(envelope.messageId);
  }

  sendRaw(
    recipientId: string,
    messageId: string,
    padded: Uint8Array,
    groupMeta?: GroupEnvelopeMeta,
  ): void {
    if (!this.ws || !this.connected) throw new Error('Not connected');
    const envelope = createEnvelope({ recipientId, messageId, paddedCiphertext: padded });
    if (groupMeta) envelope.groupMeta = groupMeta;
    this.send({ v: 1, type: 'envelope', payload: envelope });
  }

  sendPlaintext(
    recipientId: string,
    messageId: string,
    plaintext: Uint8Array,
    groupMeta?: GroupEnvelopeMeta,
  ): void {
    this.sendRaw(recipientId, messageId, padToBucket(plaintext), groupMeta);
  }

  sendBlobAck(blobId: string): void {
    if (!this.ws || !this.connected) return;
    this.send({ v: 1, type: 'blob_ack', payload: { blobId } satisfies BlobAckPayload });
  }

  async ackDelivery(messageId: string): Promise<void> {
    if (!this.ws || !this.connected || this.pendingAcks.has(messageId)) return;
    this.pendingAcks.add(messageId);
    this.send({
      v: 1,
      type: 'delivery_ack',
      payload: { messageId } satisfies DeliveryAckPayload,
    });
  }

  sendViewAck(payload: ViewAckPayload): void {
    if (!this.ws || !this.connected) return;
    this.send({ v: 1, type: 'view_ack', payload });
  }

  private send<T>(msg: WireMessage<T>): void {
    this.ws?.send(encodeWire(msg));
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.socketGeneration += 1;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.disposeSocket();
    this.connected = false;
    this.connecting = false;
    this.connectPromise = null;
    this.options.onConnectingChange?.(false);
    this.options.onConnectionChange?.(false);
  }

  isConnected(): boolean {
    return this.connected;
  }

  isConnecting(): boolean {
    return this.connecting;
  }

  ping(timeoutMs = 5000): Promise<number> {
    if (!this.ws || !this.connected) {
      return Promise.reject(new Error('Not connected'));
    }
    if (this.pendingPing) {
      return Promise.reject(new Error('Ping in flight'));
    }
    return new Promise((resolve, reject) => {
      const sent = Date.now();
      const timer = setTimeout(() => {
        if (this.pendingPing) {
          this.pendingPing = null;
          reject(new Error('Ping timeout'));
        }
      }, timeoutMs);
      this.pendingPing = {
        sent,
        resolve,
        reject,
        timer,
      };
      this.send({ v: 1, type: 'ping', payload: {} });
    });
  }
}

function randomHex(bytes: number): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function httpBaseFromWsUrl(wsUrl: string): string {
  const url = new URL(wsUrl);
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  url.pathname = '';
  url.search = '';
  url.hash = '';
  return url.origin;
}
