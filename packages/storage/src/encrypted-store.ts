import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  decryptWithPassword,
  encryptWithPassword,
  exportIdentitySecrets,
  identityFromSecrets,
  type Identity,
} from '@chat2chat/crypto';

export type ContentKind = 'text' | 'image' | 'video';

export interface StoredMessage {
  id: string;
  contactId: string;
  direction: 'in' | 'out';
  /** Serialized MessageContent JSON or raw text bytes */
  ciphertext: Uint8Array;
  contentKind: ContentKind;
  mimeType?: string;
  blobId?: string;
  fileName?: string;
  /** Local path to decrypted media file */
  mediaPath?: string;
  timestamp: number;
  delivered: boolean;
}

export interface ContactRecord {
  userId: string;
  fingerprint: string;
  alias: string | null;
  verified: boolean;
  createdAt: number;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value BLOB NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  user_id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  alias TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('in', 'out')),
  ciphertext BLOB NOT NULL,
  timestamp INTEGER NOT NULL,
  delivered INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (contact_id) REFERENCES contacts(user_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id, timestamp);
`;

const MIGRATIONS = [
  `ALTER TABLE messages ADD COLUMN content_kind TEXT NOT NULL DEFAULT 'text'`,
  `ALTER TABLE messages ADD COLUMN mime_type TEXT`,
  `ALTER TABLE messages ADD COLUMN blob_id TEXT`,
  `ALTER TABLE messages ADD COLUMN file_name TEXT`,
  `ALTER TABLE messages ADD COLUMN media_path TEXT`,
];

function runMigrations(db: Database.Database): void {
  for (const sql of MIGRATIONS) {
    try {
      db.exec(sql);
    } catch {
      // column already exists
    }
  }
}

/**
 * Encrypted local database.
 * The SQLite file is encrypted at the application layer — each value in `meta`
 * and message bodies are AES-256-GCM blobs keyed by the user's device password.
 */
export class EncryptedStore {
  private db: Database.Database;
  private password: string;
  private unlocked = false;

  private constructor(db: Database.Database, password: string) {
    this.db = db;
    this.password = password;
    this.db.exec(SCHEMA);
    runMigrations(this.db);
  }

  static open(dbPath: string, password: string): EncryptedStore {
    mkdirSync(dirname(dbPath), { recursive: true });
    const db = new Database(dbPath);
    return new EncryptedStore(db, password);
  }

  static openInMemory(password: string): EncryptedStore {
    const db = new Database(':memory:');
    return new EncryptedStore(db, password);
  }

  private seal(value: Uint8Array): Buffer {
    const blob = encryptWithPassword(this.password, value);
    const packed = JSON.stringify({
      s: Buffer.from(blob.salt).toString('base64'),
      n: Buffer.from(blob.nonce).toString('base64'),
      c: Buffer.from(blob.ciphertext).toString('base64'),
    });
    return Buffer.from(packed);
  }

  private openSealed(data: Buffer): Uint8Array {
    const parsed = JSON.parse(data.toString()) as { s: string; n: string; c: string };
    return decryptWithPassword(this.password, {
      salt: new Uint8Array(Buffer.from(parsed.s, 'base64')),
      nonce: new Uint8Array(Buffer.from(parsed.n, 'base64')),
      ciphertext: new Uint8Array(Buffer.from(parsed.c, 'base64')),
    });
  }

  /** Persist identity secrets (never stores mnemonic) */
  saveIdentity(identity: Identity): void {
    const secrets = exportIdentitySecrets(identity);
    const payload = JSON.stringify({
      userId: secrets.userId,
      signingPrivateKey: Buffer.from(secrets.signingPrivateKey).toString('base64'),
      dhPrivateKey: Buffer.from(secrets.dhPrivateKey).toString('base64'),
      fingerprint: secrets.fingerprint,
    });
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
    );
    stmt.run('identity', this.seal(new TextEncoder().encode(payload)));
    this.unlocked = true;
  }

  loadIdentity(): Identity | null {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get('identity') as
      | { value: Buffer }
      | undefined;
    if (!row) return null;
    const json = new TextDecoder().decode(this.openSealed(row.value));
    const parsed = JSON.parse(json) as {
      userId: string;
      signingPrivateKey: string;
      dhPrivateKey: string;
    };
    return identityFromSecrets({
      userId: parsed.userId,
      signingPrivateKey: new Uint8Array(Buffer.from(parsed.signingPrivateKey, 'base64')),
      dhPrivateKey: new Uint8Array(Buffer.from(parsed.dhPrivateKey, 'base64')),
    });
  }

  hasIdentity(): boolean {
    const row = this.db.prepare('SELECT 1 FROM meta WHERE key = ?').get('identity');
    return !!row;
  }

  addContact(contact: ContactRecord): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO contacts (user_id, fingerprint, alias, verified, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(contact.userId, contact.fingerprint, contact.alias, contact.verified ? 1 : 0, contact.createdAt);
  }

  listContacts(): ContactRecord[] {
    const rows = this.db
      .prepare('SELECT user_id, fingerprint, alias, verified, created_at FROM contacts')
      .all() as Array<{
      user_id: string;
      fingerprint: string;
      alias: string | null;
      verified: number;
      created_at: number;
    }>;
    return rows.map((r) => ({
      userId: r.user_id,
      fingerprint: r.fingerprint,
      alias: r.alias,
      verified: r.verified === 1,
      createdAt: r.created_at,
    }));
  }

  saveMessage(message: StoredMessage): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO messages
         (id, contact_id, direction, ciphertext, content_kind, mime_type, blob_id, file_name, media_path, timestamp, delivered)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        message.id,
        message.contactId,
        message.direction,
        this.seal(message.ciphertext),
        message.contentKind,
        message.mimeType ?? null,
        message.blobId ?? null,
        message.fileName ?? null,
        message.mediaPath ?? null,
        message.timestamp,
        message.delivered ? 1 : 0,
      );
  }

  getMessages(contactId: string, limit = 100): StoredMessage[] {
    const rows = this.db
      .prepare(
        `SELECT id, contact_id, direction, ciphertext, content_kind, mime_type, blob_id, file_name, media_path, timestamp, delivered
         FROM messages WHERE contact_id = ? ORDER BY timestamp DESC LIMIT ?`,
      )
      .all(contactId, limit) as Array<{
      id: string;
      contact_id: string;
      direction: string;
      ciphertext: Buffer;
      content_kind: string;
      mime_type: string | null;
      blob_id: string | null;
      file_name: string | null;
      media_path: string | null;
      timestamp: number;
      delivered: number;
    }>;
    return rows.map((r) => ({
      id: r.id,
      contactId: r.contact_id,
      direction: r.direction as 'in' | 'out',
      ciphertext: this.openSealed(r.ciphertext),
      contentKind: (r.content_kind ?? 'text') as ContentKind,
      mimeType: r.mime_type ?? undefined,
      blobId: r.blob_id ?? undefined,
      fileName: r.file_name ?? undefined,
      mediaPath: r.media_path ?? undefined,
      timestamp: r.timestamp,
      delivered: r.delivered === 1,
    }));
  }

  close(): void {
    this.db.close();
    this.unlocked = false;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }
}
