import type { ClientVersionInfo } from './client-version';
import type { Contact, MessageContent } from './types';
import { contactDisplayName } from './types';
import type { Group, GroupDeletePolicy, GroupInvite } from './group-types';

export type GroupControlKind =
  | 'group_create'
  | 'group_invite'
  | 'group_invite_accept'
  | 'group_invite_decline'
  | 'group_kick'
  | 'group_admin_transfer'
  | 'group_settings_update'
  | 'group_message_view'
  | 'group_delete';

export type GroupControlPayload =
  | { kind: 'group_create'; group: Group; from: string }
  | { kind: 'group_invite'; invite: GroupInvite; from: string }
  | { kind: 'group_invite_accept'; groupId: string; userId: string; userAlias: string; from: string }
  | { kind: 'group_invite_decline'; inviteId: string; groupId: string; from: string }
  | { kind: 'group_kick'; groupId: string; userId: string; from: string }
  | { kind: 'group_admin_transfer'; groupId: string; newAdminId: string; from: string }
  | { kind: 'group_settings_update'; groupId: string; deletePolicy: GroupDeletePolicy; from: string }
  | { kind: 'group_message_view'; groupId: string; messageId: string; from: string }
  | { kind: 'group_delete'; groupId: string; from: string };

const GROUP_CONTROL_KINDS = new Set<string>([
  'group_create',
  'group_invite',
  'group_invite_accept',
  'group_invite_decline',
  'group_kick',
  'group_admin_transfer',
  'group_settings_update',
  'group_message_view',
  'group_delete',
]);

export function isGroupControl(value: unknown): value is GroupControlPayload {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as { kind?: string }).kind;
  return typeof kind === 'string' && GROUP_CONTROL_KINDS.has(kind);
}

export function encodeGroupControl(control: GroupControlPayload): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(control));
}

export function decodeGroupControl(bytes: Uint8Array): GroupControlPayload | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return isGroupControl(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function encodeGroupMessagePayload(
  content: MessageContent,
  opts: {
    from: string;
    senderAlias: string;
    groupId: string;
    client?: ClientVersionInfo | null;
    replyTo?: import('./message-reply').MessageReplyRef;
  },
): Uint8Array {
  const clientFields = opts.client
    ? { appVersion: opts.client.version, appBuild: opts.client.build }
    : {};
  const base = {
    ...content,
    from: opts.from,
    senderAlias: opts.senderAlias,
    groupId: opts.groupId,
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    ...clientFields,
  };
  return new TextEncoder().encode(JSON.stringify(base));
}

export function decodeMessagePayload(bytes: Uint8Array): (MessageContent & {
  from?: string;
  senderAlias?: string;
  groupId?: string;
  appVersion?: string;
  appBuild?: string;
}) | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as MessageContent & {
      from?: string;
      senderAlias?: string;
      groupId?: string;
      appVersion?: string;
      appBuild?: string;
      replyTo?: import('./message-reply').MessageReplyRef;
    };
    if (parsed.kind) return parsed;
  } catch {
    /* fall through */
  }
  return null;
}

export function resolveMemberAlias(userId: string, contacts: Contact[]): string {
  return displayMemberName(userId, contacts);
}

/** Contact alias when saved; otherwise their profile name or the full user id. */
export function displayMemberName(userId: string, contacts: Contact[]): string {
  const contact = contacts.find((c) => c.userId === userId);
  if (contact) return contactDisplayName(contact);
  return userId;
}

export function ownSenderAlias(contacts: Contact[], selfUserId: string): string {
  return resolveMemberAlias(selfUserId, contacts);
}
