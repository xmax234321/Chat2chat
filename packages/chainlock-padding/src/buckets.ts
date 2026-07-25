/** ChainLock v1 padding buckets (bytes). */
export const PADDING_BUCKETS = [256, 1024, 16 * 1024, 256 * 1024] as const;

export type PaddingBucket = (typeof PADDING_BUCKETS)[number];

/** Pick smallest bucket that fits payload + 2-byte length prefix. */
export function selectBucket(payloadLength: number): PaddingBucket {
  const needed = payloadLength + 2;
  for (const bucket of PADDING_BUCKETS) {
    if (needed <= bucket) return bucket;
  }
  throw new Error(`Payload exceeds max ChainLock bucket (${PADDING_BUCKETS.at(-1)} bytes)`);
}

/** Pad payload to fixed bucket with 2-byte big-endian length prefix. */
export function padToBucket(plaintext: Uint8Array, bucketSize?: PaddingBucket): Uint8Array {
  const bucket = bucketSize ?? selectBucket(plaintext.length);
  if (plaintext.length > bucket - 2) {
    throw new Error(`Message exceeds bucket size ${bucket}`);
  }
  const padded = new Uint8Array(bucket);
  padded[0] = (plaintext.length >> 8) & 0xff;
  padded[1] = plaintext.length & 0xff;
  padded.set(plaintext, 2);
  return padded;
}

/** Remove padding and return original payload. */
export function unpadFromBucket(padded: Uint8Array): Uint8Array {
  if (padded.length < 2) throw new Error('Invalid padded payload');
  const length = (padded[0]! << 8) | padded[1]!;
  if (length > padded.length - 2) throw new Error('Invalid padded length');
  return padded.subarray(2, 2 + length);
}
