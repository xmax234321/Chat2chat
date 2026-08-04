/**
 * CLI demo: text + photo + video via separate blob channel.
 *
 * Usage: pnpm demo
 * Relay: CHAT2CHAT_SERVER (default wss://api.chat2chat.org/ws)
 */
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateIdentity, formatFingerprint, utf8ToBytes } from '@chat2chat/crypto';
import { encodeContent } from '@chat2chat/protocol';
import { EncryptedStore } from '@chat2chat/storage';
import { TransportClient, MediaClient, httpBaseFromWsUrl } from '@chat2chat/transport';

const SERVER_URL = process.env.CHAT2CHAT_SERVER ?? 'wss://api.chat2chat.org/ws';
const HTTP_BASE = httpBaseFromWsUrl(SERVER_URL);

/** Minimal valid 1x1 PNG */
function tinyPng(): Uint8Array {
  return new Uint8Array(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    ),
  );
}

/** Minimal valid MP4 (ftyp box only — for transport demo) */
function tinyMp4(): Uint8Array {
  // 8-byte ftyp box: size=24, type=ftyp, brand=isom
  const buf = Buffer.alloc(24);
  buf.writeUInt32BE(24, 0);
  buf.write('ftyp', 4);
  buf.write('isom', 8);
  buf.writeUInt32BE(0x200, 12);
  buf.write('isom', 16);
  buf.write('iso2', 20);
  return new Uint8Array(buf);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  console.log('=== Chat2Chat Demo (text + photo + video) ===\n');

  const alice = generateIdentity(12);
  const bob = generateIdentity(12);

  console.log('Alice ID:', alice.userId.slice(0, 40) + '...');
  console.log('Bob ID:', bob.userId.slice(0, 40) + '...\n');

  const dataDir = join(tmpdir(), 'chat2chat-demo-' + Date.now());
  const mediaDir = join(dataDir, 'media');
  mkdirSync(mediaDir, { recursive: true });

  const aliceStore = EncryptedStore.open(join(dataDir, 'alice.db'), 'alice-device-pass');
  const bobStore = EncryptedStore.open(join(dataDir, 'bob.db'), 'bob-device-pass');

  aliceStore.saveIdentity(alice);
  bobStore.saveIdentity(bob);

  aliceStore.addContact({
    userId: bob.userId,
    fingerprint: bob.fingerprint,
    alias: 'Bob',
    verified: false,
    createdAt: Date.now(),
  });

  bobStore.addContact({
    userId: alice.userId,
    fingerprint: alice.fingerprint,
    alias: 'Alice',
    verified: false,
    createdAt: Date.now(),
  });

  const received: Array<{ kind: string; fileName?: string; size: number }> = [];

  const bobTransport = new TransportClient({
    serverUrl: SERVER_URL,
    userId: bob.userId,
    autoAck: false,
    onMessage: async (env, plaintext) => {
      const text = new TextDecoder().decode(plaintext);
      console.log(`Bob received text: "${text}"`);
      received.push({ kind: 'text', size: plaintext.length });
      bobStore.saveMessage({
        id: env.messageId,
        contactId: alice.userId,
        direction: 'in',
        ciphertext: plaintext,
        contentKind: 'text',
        timestamp: Date.now(),
        delivered: true,
      });
      await bobTransport.ackDelivery(env.messageId);
    },
    onAttachment: async (env, bucket) => {
      const bobMedia = new MediaClient({
        transport: bobTransport,
        userId: bob.userId,
        httpBaseUrl: HTTP_BASE,
      });
      const media = await bobMedia.handleIncoming(env.messageId, bucket);
      if (!media) return;

      const outPath = join(mediaDir, `bob_${media.content.fileName}`);
      bobMedia.saveToFile(media.data, outPath);

      const digest = createHash('sha256').update(media.data).digest('hex');
      if (digest !== media.content.digest) {
        throw new Error('Media digest mismatch');
      }

      console.log(
        `Bob received ${media.content.kind}: ${media.content.fileName} (${media.data.length} bytes) → ${outPath}`,
      );
      received.push({ kind: media.content.kind, fileName: media.content.fileName, size: media.data.length });

      bobStore.saveMessage({
        id: env.messageId,
        contactId: alice.userId,
        direction: 'in',
        ciphertext: encodeContent(media.content),
        contentKind: media.content.kind,
        mimeType: media.content.mime,
        blobId: media.content.blobId,
        fileName: media.content.fileName,
        mediaPath: outPath,
        timestamp: Date.now(),
        delivered: true,
      });

      bobMedia.ackBlob(media.content.blobId);
      await bobTransport.ackDelivery(env.messageId);
    },
  });

  await bobTransport.connect();
  console.log('Bob connected.');

  const aliceTransport = new TransportClient({
    serverUrl: SERVER_URL,
    userId: alice.userId,
  });
  await aliceTransport.connect();
  console.log('Alice connected.\n');

  const aliceMedia = new MediaClient({
    transport: aliceTransport,
    userId: alice.userId,
    httpBaseUrl: HTTP_BASE,
  });

  // --- 1. Text message ---
  const textId = randomBytes(8).toString('hex');
  aliceTransport.sendPlaintext(
    bob.userId,
    textId,
    utf8ToBytes('Привет! Это текстовое сообщение.'),
  );
  aliceStore.saveMessage({
    id: textId,
    contactId: bob.userId,
    direction: 'out',
    ciphertext: utf8ToBytes('Привет! Это текстовое сообщение.'),
    contentKind: 'text',
    timestamp: Date.now(),
    delivered: false,
  });

  await sleep(300);

  // --- 2. Photo ---
  const photoData = tinyPng();
  const photoId = randomBytes(8).toString('hex');
  const photoBlobId = MediaClient.generateBlobId();
  const photoMeta = await aliceMedia.sendMedia({
    recipientId: bob.userId,
    messageId: photoId,
    blobId: photoBlobId,
    data: photoData,
    mime: 'image/png',
    fileName: 'photo.png',
  });
  aliceStore.saveMessage({
    id: photoId,
    contactId: bob.userId,
    direction: 'out',
    ciphertext: encodeContent(photoMeta),
    contentKind: 'image',
    mimeType: 'image/png',
    blobId: photoBlobId,
    fileName: 'photo.png',
    timestamp: Date.now(),
    delivered: false,
  });
  console.log('Alice sent photo.png');

  await sleep(300);

  // --- 3. Video ---
  const videoData = tinyMp4();
  const videoId = randomBytes(8).toString('hex');
  const videoBlobId = MediaClient.generateBlobId();
  const videoMeta = await aliceMedia.sendMedia({
    recipientId: bob.userId,
    messageId: videoId,
    blobId: videoBlobId,
    data: videoData,
    mime: 'video/mp4',
    fileName: 'clip.mp4',
  });
  aliceStore.saveMessage({
    id: videoId,
    contactId: bob.userId,
    direction: 'out',
    ciphertext: encodeContent(videoMeta),
    contentKind: 'video',
    mimeType: 'video/mp4',
    blobId: videoBlobId,
    fileName: 'clip.mp4',
    timestamp: Date.now(),
    delivered: false,
  });
  console.log('Alice sent clip.mp4\n');

  await sleep(500);

  const expected = 3;
  if (received.length < expected) {
    console.error(`FAIL: expected ${expected} items, got ${received.length}`);
    process.exit(1);
  }

  const bobMessages = bobStore.getMessages(alice.userId);
  console.log(`Bob local DB: ${bobMessages.length} messages`);
  console.log('Received:', received);
  console.log('\nDemo complete. Blobs deleted from server after ACK.');

  aliceTransport.disconnect();
  bobTransport.disconnect();
  aliceStore.close();
  bobStore.close();
  rmSync(dataDir, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
