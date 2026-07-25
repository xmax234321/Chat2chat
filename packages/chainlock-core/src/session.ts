import { CiphertextMessageType } from '@signalapp/libsignal-client';
import {
  createProtocolStores,
  generatePreKeyBundleData,
  toLibsignalBundle,
  type PreKeyBundleData,
  type ProtocolStores,
  type RatchetCiphertext,
  RatchetSession,
} from '@chat2chat/crypto';
import { padToBucket, selectBucket, unpadFromBucket, roundTimestampForServer } from '@chat2chat/chainlock-padding';
import {
  decodeChainLockPacket,
  decodeChainLockPayload,
  encodeChainLockPacket,
  encodeChainLockPayload,
  PreKeyBundlePublish,
  type ChainLockPacketFields,
} from './proto.js';

export const SKIP_LIMIT = 1000;
export const ROOT_KEY_ROTATION_MESSAGE_LIMIT = 50;
export const ROOT_KEY_ROTATION_MS = 24 * 60 * 60 * 1000;
export const SIGNED_PREKEY_ROTATION_MS = 7 * 24 * 60 * 60 * 1000;
export const ONE_TIME_PREKEY_BATCH = 100;
export const ONE_TIME_PREKEY_REPLENISH_THRESHOLD = 20;

export interface ChainLockDecryptResult {
  plaintext: Uint8Array;
  exactTimestamp: number;
  serverTimestamp: number;
  chainTag: number;
  messageIndex: number;
}

interface ChainReceiveState {
  highestIndex: number;
  skippedCount: number;
}

export interface ChainLockSessionState {
  chainTag: number;
  messageIndex: number;
  messagesSinceRootRotation: number;
  rootKeyRotatedAt: number;
  receiveByChain: Map<number, ChainReceiveState>;
}

export class ChainLockSession {
  private readonly ratchet: RatchetSession;
  private state: ChainLockSessionState;

  private constructor(ratchet: RatchetSession, state?: Partial<ChainLockSessionState>) {
    this.ratchet = ratchet;
    this.state = {
      chainTag: state?.chainTag ?? 1,
      messageIndex: state?.messageIndex ?? 0,
      messagesSinceRootRotation: state?.messagesSinceRootRotation ?? 0,
      rootKeyRotatedAt: state?.rootKeyRotatedAt ?? Date.now(),
      receiveByChain: state?.receiveByChain ?? new Map(),
    };
  }

  static async establishOutbound(
    localStores: ProtocolStores,
    remoteUserId: string,
    remoteBundleData: PreKeyBundleData,
  ): Promise<ChainLockSession> {
    const ratchet = await RatchetSession.establishOutbound(
      localStores,
      remoteUserId,
      toLibsignalBundle(remoteBundleData),
    );
    return new ChainLockSession(ratchet, { chainTag: 1, messageIndex: 0 });
  }

  static fromRatchet(ratchet: RatchetSession, state?: Partial<ChainLockSessionState>): ChainLockSession {
    return new ChainLockSession(ratchet, state);
  }

  getRemoteUserId(): string {
    return this.ratchet.getRemoteUserId();
  }

  getState(): ChainLockSessionState {
    return {
      ...this.state,
      receiveByChain: new Map(this.state.receiveByChain),
    };
  }

  restoreState(state: Partial<ChainLockSessionState>): void {
    this.state = {
      chainTag: state.chainTag ?? this.state.chainTag,
      messageIndex: state.messageIndex ?? this.state.messageIndex,
      messagesSinceRootRotation: state.messagesSinceRootRotation ?? this.state.messagesSinceRootRotation,
      rootKeyRotatedAt: state.rootKeyRotatedAt ?? this.state.rootKeyRotatedAt,
      receiveByChain: state.receiveByChain ?? this.state.receiveByChain,
    };
  }

  /** Encrypt plaintext, wrap in ChainLock protobuf, pad to bucket. */
  async encrypt(plaintext: Uint8Array, now = Date.now()): Promise<Uint8Array> {
    this.maybeRotateRootKey(now);

    const inner = encodeChainLockPayload({ innerPlaintext: plaintext, exactTimestamp: now });
    const ratchetCipher = await this.ratchet.encrypt(inner);

    if (ratchetCipher.type === CiphertextMessageType.PreKey) {
      this.bumpChainTag();
    }

    const packet = encodeChainLockPacket({
      chainTag: this.state.chainTag,
      messageIndex: this.state.messageIndex,
      ratchetType: ratchetCipher.type,
      ratchetBody: ratchetCipher.body,
      serverTimestamp: roundTimestampForServer(now),
    });

    this.state.messageIndex += 1;
    this.state.messagesSinceRootRotation += 1;

    return padToBucket(packet, selectBucket(packet.length));
  }

  /** Unpad, decode protobuf, enforce skip limit, decrypt via Double Ratchet. */
  async decrypt(padded: Uint8Array): Promise<ChainLockDecryptResult> {
    const packetBytes = unpadFromBucket(padded);
    const packet = decodeChainLockPacket(packetBytes);
    this.enforceSkipLimit(packet);

    const ratchetPlain = await this.ratchet.decrypt({
      type: packet.ratchetType,
      body: packet.ratchetBody,
    });

    if (packet.ratchetType === CiphertextMessageType.PreKey) {
      this.bumpChainTag();
    }

    const payload = decodeChainLockPayload(ratchetPlain);
    this.recordReceivedIndex(packet.chainTag, packet.messageIndex);

    return {
      plaintext: payload.innerPlaintext,
      exactTimestamp: payload.exactTimestamp,
      serverTimestamp: packet.serverTimestamp,
      chainTag: packet.chainTag,
      messageIndex: packet.messageIndex,
    };
  }

  /** Raw encrypt for file key wrapping (returns unpadded protobuf packet). */
  async encryptRaw(plaintext: Uint8Array, now = Date.now()): Promise<Uint8Array> {
    this.maybeRotateRootKey(now);
    const inner = encodeChainLockPayload({ innerPlaintext: plaintext, exactTimestamp: now });
    const ratchetCipher = await this.ratchet.encrypt(inner);
    if (ratchetCipher.type === CiphertextMessageType.PreKey) this.bumpChainTag();

    const packet = encodeChainLockPacket({
      chainTag: this.state.chainTag,
      messageIndex: this.state.messageIndex,
      ratchetType: ratchetCipher.type,
      ratchetBody: ratchetCipher.body,
      serverTimestamp: roundTimestampForServer(now),
    });
    this.state.messageIndex += 1;
    this.state.messagesSinceRootRotation += 1;
    return packet;
  }

  async decryptRaw(packetBytes: Uint8Array): Promise<Uint8Array> {
    const packet = decodeChainLockPacket(packetBytes);
    this.enforceSkipLimit(packet);
    const ratchetPlain = await this.ratchet.decrypt({
      type: packet.ratchetType,
      body: packet.ratchetBody,
    });
    if (packet.ratchetType === CiphertextMessageType.PreKey) this.bumpChainTag();
    const payload = decodeChainLockPayload(ratchetPlain);
    this.recordReceivedIndex(packet.chainTag, packet.messageIndex);
    return payload.innerPlaintext;
  }

  private bumpChainTag(): void {
    this.state.chainTag = (this.state.chainTag + 1) >>> 0;
    this.state.messageIndex = 0;
    this.state.receiveByChain.delete(this.state.chainTag - 1);
  }

  private maybeRotateRootKey(now: number): void {
    const age = now - this.state.rootKeyRotatedAt;
    if (
      this.state.messagesSinceRootRotation >= ROOT_KEY_ROTATION_MESSAGE_LIMIT ||
      age >= ROOT_KEY_ROTATION_MS
    ) {
      this.bumpChainTag();
      this.state.messagesSinceRootRotation = 0;
      this.state.rootKeyRotatedAt = now;
    }
  }

  private enforceSkipLimit(packet: ChainLockPacketFields): void {
    const chainState = this.state.receiveByChain.get(packet.chainTag) ?? {
      highestIndex: packet.messageIndex > 0 ? packet.messageIndex - 1 : 0,
      skippedCount: 0,
    };

    if (packet.messageIndex > chainState.highestIndex + 1) {
      chainState.skippedCount += packet.messageIndex - chainState.highestIndex - 1;
    }
    if (chainState.skippedCount > SKIP_LIMIT) {
      throw new Error(`ChainLock skip limit exceeded (${SKIP_LIMIT})`);
    }
  }

  private recordReceivedIndex(chainTag: number, messageIndex: number): void {
    const chainState = this.state.receiveByChain.get(chainTag) ?? {
      highestIndex: messageIndex > 0 ? messageIndex - 1 : 0,
      skippedCount: 0,
    };
    if (messageIndex > chainState.highestIndex + 1) {
      chainState.skippedCount += messageIndex - chainState.highestIndex - 1;
    }
    chainState.highestIndex = Math.max(chainState.highestIndex, messageIndex);
    this.state.receiveByChain.set(chainTag, chainState);
  }
}

export interface PublishedPreKeyBundle {
  data: PreKeyBundleData;
  publishedAt: number;
  oneTimeRemaining: number;
}

/** Identity + prekey rotation policy for ChainLock v1. */
export class ChainLockIdentity {
  readonly bundleData: PreKeyBundleData;
  readonly stores: ProtocolStores;
  private signedPreKeyCreatedAt: number;
  private oneTimePreKeyIds: number[];

  constructor(bundleData: PreKeyBundleData, oneTimeCount = ONE_TIME_PREKEY_BATCH) {
    this.bundleData = bundleData;
    this.stores = createProtocolStores(bundleData);
    this.signedPreKeyCreatedAt = Date.now();
    this.oneTimePreKeyIds = Array.from({ length: oneTimeCount }, (_, i) => i + 2);
  }

  static generate(): ChainLockIdentity {
    return new ChainLockIdentity(generatePreKeyBundleData());
  }

  needsSignedPreKeyRotation(now = Date.now()): boolean {
    return now - this.signedPreKeyCreatedAt >= SIGNED_PREKEY_ROTATION_MS;
  }

  needsOneTimePrekeyReplenish(): boolean {
    return this.oneTimePreKeyIds.length < ONE_TIME_PREKEY_REPLENISH_THRESHOLD;
  }

  rotateSignedPreKey(now = Date.now()): void {
    const next = generatePreKeyBundleData();
    this.bundleData.signedPreKeyId = next.signedPreKeyId;
    this.bundleData.signedPreKeyPublic = next.signedPreKeyPublic;
    this.bundleData.signedPreKeyPrivate = next.signedPreKeyPrivate;
    this.bundleData.signedPreKeySignature = next.signedPreKeySignature;
    this.signedPreKeyCreatedAt = now;
  }

  replenishOneTimePrekeys(): void {
    const start = this.oneTimePreKeyIds.at(-1) ?? 1;
    for (let i = 1; i <= ONE_TIME_PREKEY_BATCH; i += 1) {
      this.oneTimePreKeyIds.push(start + i);
    }
  }

  toPublishProto(): Uint8Array {
    const msg = PreKeyBundlePublish.create({
      registrationId: this.bundleData.registrationId,
      deviceId: this.bundleData.deviceId,
      preKeyId: this.bundleData.preKeyId,
      preKeyPublic: this.bundleData.preKeyPublic,
      signedPreKeyId: this.bundleData.signedPreKeyId,
      signedPreKeyPublic: this.bundleData.signedPreKeyPublic,
      signedPreKeySignature: this.bundleData.signedPreKeySignature,
      identityKeyPublic: this.bundleData.identityKeyPublic,
      signedPreKeyCreatedAt: this.signedPreKeyCreatedAt,
    });
    return Uint8Array.from(PreKeyBundlePublish.encode(msg).finish());
  }
}

export {
  createProtocolStores,
  generatePreKeyBundleData,
  toLibsignalBundle,
  RatchetSession,
  type PreKeyBundleData,
  type ProtocolStores,
  type RatchetCiphertext,
};
