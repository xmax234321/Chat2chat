export type MessageReceiptKind = 'delivery_receipt' | 'read_receipt';

export type MessageReceiptPayload =
  | { kind: 'delivery_receipt'; from: string; messageId: string; at: number }
  | { kind: 'read_receipt'; from: string; messageId: string; at: number };

const RECEIPT_KINDS = new Set<string>(['delivery_receipt', 'read_receipt']);

export function isMessageReceipt(value: unknown): value is MessageReceiptPayload {
  if (!value || typeof value !== 'object') return false;
  const obj = value as { kind?: string; from?: string; messageId?: string; at?: number };
  if (!RECEIPT_KINDS.has(obj.kind ?? '') || typeof obj.from !== 'string' || typeof obj.messageId !== 'string') {
    return false;
  }
  return typeof obj.at === 'number';
}

export function encodeMessageReceipt(receipt: MessageReceiptPayload): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(receipt));
}

export function decodeMessageReceipt(bytes: Uint8Array): MessageReceiptPayload | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!isMessageReceipt(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}
