import type { Contact } from './types';
import { isExportBlockForPeerActive } from './export-block-lock';

export type ChatPrivacyControlKind = 'chat_export_block' | 'chat_export_allow';

export type ChatPrivacyControlPayload =
  | { kind: 'chat_export_block'; from: string; at: number }
  | { kind: 'chat_export_allow'; from: string };

const CHAT_PRIVACY_CONTROL_KINDS = new Set<string>(['chat_export_block', 'chat_export_allow']);

export function isChatPrivacyControl(value: unknown): value is ChatPrivacyControlPayload {
  if (!value || typeof value !== 'object') return false;
  const obj = value as { kind?: string; from?: string; at?: number };
  if (typeof obj.kind !== 'string' || typeof obj.from !== 'string') return false;
  if (obj.kind === 'chat_export_block') {
    return CHAT_PRIVACY_CONTROL_KINDS.has(obj.kind) && typeof obj.at === 'number';
  }
  return obj.kind === 'chat_export_allow';
}

export function encodeChatPrivacyControl(control: ChatPrivacyControlPayload): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(control));
}

export function decodeChatPrivacyControl(bytes: Uint8Array): ChatPrivacyControlPayload | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as { kind?: string; from?: string; at?: number };
    if (obj.kind === 'chat_export_block' && typeof obj.from === 'string') {
      return {
        kind: 'chat_export_block',
        from: obj.from,
        at: typeof obj.at === 'number' ? obj.at : Date.now(),
      };
    }
    if (obj.kind === 'chat_export_allow' && typeof obj.from === 'string') {
      return { kind: 'chat_export_allow', from: obj.from };
    }
    return null;
  } catch {
    return null;
  }
}

export function isContactExportBlocked(
  contact: Pick<Contact, 'exportBlockedByPeer' | 'exportBlockForPeerAt'>,
): boolean {
  return Boolean(contact.exportBlockedByPeer) || isExportBlockForPeerActive(contact);
}
