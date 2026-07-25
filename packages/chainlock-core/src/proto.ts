import protobuf from 'protobufjs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const protoPath = join(dirname(fileURLToPath(import.meta.url)), '../proto/chainlock.proto');
const root = protobuf.parse(readFileSync(protoPath, 'utf8')).root;

export const ChainLockPacket = root.lookupType('chainlock.ChainLockPacket');
export const ChainLockPayload = root.lookupType('chainlock.ChainLockPayload');
export const PreKeyBundlePublish = root.lookupType('chainlock.PreKeyBundlePublish');

export interface ChainLockPacketFields {
  chainTag: number;
  messageIndex: number;
  ratchetType: number;
  ratchetBody: Uint8Array;
  serverTimestamp: number;
}

export interface ChainLockPayloadFields {
  innerPlaintext: Uint8Array;
  exactTimestamp: number;
}

export function encodeChainLockPacket(fields: ChainLockPacketFields): Uint8Array {
  const msg = ChainLockPacket.create({
    chainTag: fields.chainTag,
    messageIndex: fields.messageIndex,
    ratchetType: fields.ratchetType,
    ratchetBody: fields.ratchetBody,
    serverTimestamp: fields.serverTimestamp,
  });
  return Uint8Array.from(ChainLockPacket.encode(msg).finish());
}

export function decodeChainLockPacket(bytes: Uint8Array): ChainLockPacketFields {
  const decoded = ChainLockPacket.decode(bytes) as protobuf.Message;
  const obj = ChainLockPacket.toObject(decoded, { bytes: Uint8Array }) as {
    chainTag: number;
    messageIndex: number;
    ratchetType: number;
    ratchetBody: Uint8Array;
    serverTimestamp: number;
  };
  return {
    chainTag: obj.chainTag >>> 0,
    messageIndex: obj.messageIndex >>> 0,
    ratchetType: obj.ratchetType >>> 0,
    ratchetBody: obj.ratchetBody,
    serverTimestamp: Number(obj.serverTimestamp),
  };
}

export function encodeChainLockPayload(fields: ChainLockPayloadFields): Uint8Array {
  const msg = ChainLockPayload.create({
    innerPlaintext: fields.innerPlaintext,
    exactTimestamp: fields.exactTimestamp,
  });
  return Uint8Array.from(ChainLockPayload.encode(msg).finish());
}

export function decodeChainLockPayload(bytes: Uint8Array): ChainLockPayloadFields {
  const decoded = ChainLockPayload.decode(bytes) as protobuf.Message;
  const obj = ChainLockPayload.toObject(decoded, { bytes: Uint8Array }) as {
    innerPlaintext: Uint8Array;
    exactTimestamp: number;
  };
  return {
    innerPlaintext: obj.innerPlaintext,
    exactTimestamp: Number(obj.exactTimestamp),
  };
}
