/**
 * Double Ratchet via @signalapp/libsignal-client (Signal protocol).
 * Uses processPreKeyBundle / signalEncrypt / signalDecrypt — no custom ratchet.
 */
import {
  CiphertextMessageType,
  Direction,
  IdentityKeyPair,
  IdentityKeyStore,
  KyberPreKeyRecord,
  KyberPreKeyStore,
  PreKeyBundle,
  PreKeyRecord,
  PreKeySignalMessage,
  PreKeyStore,
  PrivateKey,
  ProtocolAddress,
  PublicKey,
  SessionRecord,
  SessionStore,
  SignalMessage,
  SignedPreKeyRecord,
  SignedPreKeyStore,
  processPreKeyBundle,
  signalDecrypt,
  signalDecryptPreKey,
  signalEncrypt,
} from '@signalapp/libsignal-client';
import { parseUserId } from './identity.js';

export interface RatchetCiphertext {
  type: number;
  body: Uint8Array;
}

export interface ProtocolStores {
  session: InMemorySessionStore;
  identity: InMemoryIdentityStore;
  preKey: InMemoryPreKeyStore;
  signedPreKey: InMemorySignedPreKeyStore;
  kyberPreKey: InMemoryKyberPreKeyStore;
}

export class InMemorySessionStore extends SessionStore {
  private sessions = new Map<string, SessionRecord>();

  private key(name: ProtocolAddress): string {
    return `${name.name()}:${name.deviceId()}`;
  }

  async saveSession(name: ProtocolAddress, record: SessionRecord): Promise<void> {
    this.sessions.set(this.key(name), record);
  }

  async getSession(name: ProtocolAddress): Promise<SessionRecord | null> {
    return this.sessions.get(this.key(name)) ?? null;
  }

  async getExistingSessions(addresses: ProtocolAddress[]): Promise<SessionRecord[]> {
    const result: SessionRecord[] = [];
    for (const addr of addresses) {
      const session = await this.getSession(addr);
      if (session) result.push(session);
    }
    return result;
  }
}

export class InMemoryIdentityStore extends IdentityKeyStore {
  private trusted = new Map<string, PublicKey>();

  constructor(
    private readonly identityKeyPair: IdentityKeyPair,
    private readonly registrationId: number,
  ) {
    super();
  }

  async getIdentityKey(): Promise<PrivateKey> {
    return this.identityKeyPair.privateKey;
  }

  async getLocalRegistrationId(): Promise<number> {
    return this.registrationId;
  }

  async saveIdentity(name: ProtocolAddress, key: PublicKey): Promise<boolean> {
    const id = `${name.name()}:${name.deviceId()}`;
    const existing = this.trusted.get(id);
    this.trusted.set(id, key);
    return !existing || existing.serialize().compare(key.serialize()) !== 0;
  }

  async isTrustedIdentity(
    name: ProtocolAddress,
    key: PublicKey,
    _direction: Direction,
  ): Promise<boolean> {
    const id = `${name.name()}:${name.deviceId()}`;
    const trusted = this.trusted.get(id);
    if (!trusted) return true;
    return trusted.serialize().compare(key.serialize()) === 0;
  }

  async getIdentity(name: ProtocolAddress): Promise<PublicKey | null> {
    return this.trusted.get(`${name.name()}:${name.deviceId()}`) ?? null;
  }
}

export class InMemoryPreKeyStore extends PreKeyStore {
  private keys = new Map<number, PreKeyRecord>();

  async savePreKey(id: number, record: PreKeyRecord): Promise<void> {
    this.keys.set(id, record);
  }

  async getPreKey(id: number): Promise<PreKeyRecord> {
    const key = this.keys.get(id);
    if (!key) throw new Error(`PreKey ${id} not found`);
    return key;
  }

  async removePreKey(id: number): Promise<void> {
    this.keys.delete(id);
  }
}

export class InMemorySignedPreKeyStore extends SignedPreKeyStore {
  private keys = new Map<number, SignedPreKeyRecord>();

  async saveSignedPreKey(id: number, record: SignedPreKeyRecord): Promise<void> {
    this.keys.set(id, record);
  }

  async getSignedPreKey(id: number): Promise<SignedPreKeyRecord> {
    const key = this.keys.get(id);
    if (!key) throw new Error(`SignedPreKey ${id} not found`);
    return key;
  }
}

export class InMemoryKyberPreKeyStore extends KyberPreKeyStore {
  private keys = new Map<number, KyberPreKeyRecord>();

  async saveKyberPreKey(kyberPreKeyId: number, record: KyberPreKeyRecord): Promise<void> {
    this.keys.set(kyberPreKeyId, record);
  }

  async getKyberPreKey(kyberPreKeyId: number): Promise<KyberPreKeyRecord> {
    const key = this.keys.get(kyberPreKeyId);
    if (!key) throw new Error(`KyberPreKey ${kyberPreKeyId} not found`);
    return key;
  }

  async markKyberPreKeyUsed(_kyberPreKeyId: number): Promise<void> {
    // no-op for in-memory dev store
  }
}

export interface PreKeyBundleData {
  registrationId: number;
  deviceId: number;
  preKeyId: number;
  preKeyPublic: Uint8Array;
  preKeyPrivate: Uint8Array;
  signedPreKeyId: number;
  signedPreKeyPublic: Uint8Array;
  signedPreKeyPrivate: Uint8Array;
  signedPreKeySignature: Uint8Array;
  identityKeyPublic: Uint8Array;
  identityKeyPrivate: Uint8Array;
}

/** Generate libsignal prekey bundle for publishing to contacts */
export function generatePreKeyBundleData(): PreKeyBundleData {
  const identityKeyPair = IdentityKeyPair.generate();
  const registrationId = Math.floor(Math.random() * 16380) + 1;
  const preKeyId = 1;
  const signedPreKeyId = 1;
  const preKeyPrivate = PrivateKey.generate();
  const signedPreKeyPrivate = PrivateKey.generate();
  const signedPreKeyPublic = signedPreKeyPrivate.getPublicKey();
  const signature = identityKeyPair.privateKey.sign(signedPreKeyPublic.serialize());

  return {
    registrationId,
    deviceId: 1,
    preKeyId,
    preKeyPublic: new Uint8Array(preKeyPrivate.getPublicKey().serialize()),
    preKeyPrivate: new Uint8Array(preKeyPrivate.serialize()),
    signedPreKeyId,
    signedPreKeyPublic: new Uint8Array(signedPreKeyPublic.serialize()),
    signedPreKeyPrivate: new Uint8Array(signedPreKeyPrivate.serialize()),
    signedPreKeySignature: new Uint8Array(signature),
    identityKeyPublic: new Uint8Array(identityKeyPair.publicKey.serialize()),
    identityKeyPrivate: new Uint8Array(identityKeyPair.privateKey.serialize()),
  };
}

export function createProtocolStores(bundleData: PreKeyBundleData): ProtocolStores {
  const identityKeyPair = new IdentityKeyPair(
    PublicKey.deserialize(Buffer.from(bundleData.identityKeyPublic)),
    PrivateKey.deserialize(Buffer.from(bundleData.identityKeyPrivate)),
  );

  const preKey = new InMemoryPreKeyStore();
  const signedPreKey = new InMemorySignedPreKeyStore();

  preKey.savePreKey(
    bundleData.preKeyId,
    PreKeyRecord.new(
      bundleData.preKeyId,
      PublicKey.deserialize(Buffer.from(bundleData.preKeyPublic)),
      PrivateKey.deserialize(Buffer.from(bundleData.preKeyPrivate)),
    ),
  );

  signedPreKey.saveSignedPreKey(
    bundleData.signedPreKeyId,
    SignedPreKeyRecord.new(
      bundleData.signedPreKeyId,
      Date.now(),
      PublicKey.deserialize(Buffer.from(bundleData.signedPreKeyPublic)),
      PrivateKey.deserialize(Buffer.from(bundleData.signedPreKeyPrivate)),
      Buffer.from(bundleData.signedPreKeySignature),
    ),
  );

  return {
    session: new InMemorySessionStore(),
    identity: new InMemoryIdentityStore(identityKeyPair, bundleData.registrationId),
    preKey,
    signedPreKey,
    kyberPreKey: new InMemoryKyberPreKeyStore(),
  };
}

export function toLibsignalBundle(data: PreKeyBundleData): PreKeyBundle {
  return PreKeyBundle.new(
    data.registrationId,
    data.deviceId,
    data.preKeyId,
    PublicKey.deserialize(Buffer.from(data.preKeyPublic)),
    data.signedPreKeyId,
    PublicKey.deserialize(Buffer.from(data.signedPreKeyPublic)),
    Buffer.from(data.signedPreKeySignature),
    PublicKey.deserialize(Buffer.from(data.identityKeyPublic)),
  );
}

/**
 * Double Ratchet session between two protocol addresses.
 */
export class RatchetSession {
  private constructor(
    private readonly stores: ProtocolStores,
    private readonly remoteAddress: ProtocolAddress,
  ) {}

  static async establishOutbound(
    localStores: ProtocolStores,
    remoteUserId: string,
    remoteBundle: PreKeyBundle,
  ): Promise<RatchetSession> {
    const address = ProtocolAddress.new(remoteUserId, 1);
    await processPreKeyBundle(remoteBundle, address, localStores.session, localStores.identity);
    return new RatchetSession(localStores, address);
  }

  static fromStores(stores: ProtocolStores, remoteUserId: string): RatchetSession {
    return new RatchetSession(stores, ProtocolAddress.new(remoteUserId, 1));
  }

  async encrypt(plaintext: Uint8Array): Promise<RatchetCiphertext> {
    const result = await signalEncrypt(
      Buffer.from(plaintext),
      this.remoteAddress,
      this.stores.session,
      this.stores.identity,
    );
    return { type: result.type(), body: new Uint8Array(result.serialize()) };
  }

  async decrypt(ciphertext: RatchetCiphertext): Promise<Uint8Array> {
    const buf = Buffer.from(ciphertext.body);
    if (ciphertext.type === CiphertextMessageType.PreKey) {
      const message = PreKeySignalMessage.deserialize(buf);
      const plain = await signalDecryptPreKey(
        message,
        this.remoteAddress,
        this.stores.session,
        this.stores.identity,
        this.stores.preKey,
        this.stores.signedPreKey,
        this.stores.kyberPreKey,
      );
      return new Uint8Array(plain);
    }
    const message = SignalMessage.deserialize(buf);
    const plain = await signalDecrypt(
      message,
      this.remoteAddress,
      this.stores.session,
      this.stores.identity,
    );
    return new Uint8Array(plain);
  }

  getRemoteUserId(): string {
    return this.remoteAddress.name();
  }
}

/** Extract DH public key bytes from user ID */
export function dhPublicKeyFromUserId(userId: string): Uint8Array {
  return parseUserId(userId).dhPublicKey;
}
