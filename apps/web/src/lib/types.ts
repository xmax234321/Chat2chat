import type { AttachmentContent, TextContent } from '@chat2chat/protocol';
import type { EphemeralMedia } from './ephemeral-media';
import type { MessageReplyRef } from './message-reply';
import type { CallRecord } from './calls';
import type { AppNotification, Group, GroupInvite, GroupInviteStatus } from './group-types';
export type { AppNotification, Group, GroupDeletePolicy, GroupInvite, GroupInviteStatus } from './group-types';
export type { EphemeralMedia } from './ephemeral-media';
export type { MessageReplyRef } from './message-reply';
export { isGroupId, generateGroupId, viewThreshold, DEFAULT_GROUP_DELETE_POLICY, normalizeGroup, acceptedMemberCount } from './group-types';

export interface Contact {
  userId: string;
  fingerprint: string;
  alias: string;
  verified: boolean;
  avatar: string;
  /** Auto-added from an incoming message — user has not named them yet. */
  isUnknown?: boolean;
  /** Last reported app version from this contact's messages. */
  appVersion?: string;
  appBuild?: string;
  /** Private note visible only on this device. */
  note?: string;
  /** Blocked contacts cannot message you and you cannot message them. */
  blocked?: boolean;
  /** When set, this contact cannot export or back up this chat on their device. */
  exportBlockForPeerAt?: number;
  /** Peer requested that this chat must not be exported or backed up on this device. */
  exportBlockedByPeer?: boolean;
  /** When the peer enabled export block (wire timestamp). */
  exportBlockedByPeerAt?: number;
  /** Telegram-style notes-to-self chat pinned at the top of the list. */
  isSavedMessages?: boolean;
  /** Display name they chose in their profile (shown until you name them). */
  peerAlias?: string;
}

export const UNKNOWN_CONTACT_ALIAS = 'Unknown';

export type MediaGroupFields = {
  mediaGroupId: string;
  mediaGroupIndex: number;
  mediaGroupTotal: number;
};

type VisualAttachmentFields = {
  blobId: string;
  mime: string;
  fileName: string;
  size: number;
  fileKey: string;
  digest: string;
  previewUrl?: string;
  uploading?: boolean;
  uploadProgress?: number;
  ephemeral?: EphemeralMedia;
  /** Local-only ghost after a viewed disappearing message. */
  expiredPlaceholder?: boolean;
  /** Caption shown below the media. */
  caption?: string;
};

export type VisualMediaMessageContent = ({ kind: 'image' | 'video' } & VisualAttachmentFields &
  Partial<MediaGroupFields>) |
  ({ kind: 'file' } & VisualAttachmentFields);

export type AlbumMediaContent = { kind: 'image' | 'video' } & VisualAttachmentFields & MediaGroupFields;

export type MessageContent =
  | { kind: 'text'; body: string }
  | VisualMediaMessageContent
  | ({
      kind: 'voice';
      blobId: string;
      mime: string;
      fileName: string;
      size: number;
      fileKey: string;
      digest: string;
      durationMs?: number;
      previewUrl?: string;
      uploading?: boolean;
      uploadProgress?: number;
      ephemeral?: EphemeralMedia;
    } & Partial<MediaGroupFields>)
  | {
      kind: 'group_invite';
      inviteId: string;
      groupId: string;
      groupName: string;
      status: GroupInviteStatus;
      fromUserId: string;
      fromAlias: string;
    }
  | {
      kind: 'export_block_notice';
      byUserId: string;
      byAlias: string;
    };

export interface ChatMessage {
  id: string;
  contactId: string;
  direction: 'in' | 'out';
  content: MessageContent;
  timestamp: number;
  /** Group message sender user id */
  senderId?: string;
  /** Display name for group message sender */
  senderAlias?: string;
  replyTo?: MessageReplyRef;
  /** Outgoing message not yet delivered to server (offline queue). */
  pendingDelivery?: boolean;
  /** WhatsApp-style delivery state for outgoing messages. */
  deliveryStatus?: MessageDeliveryStatus;
}

export type MessageDeliveryStatus = 'failed' | 'pending' | 'sent' | 'delivered' | 'read';

export interface ChatPreview {
  contactId: string;
  lastMessage: string;
  timestamp: number;
  unread: number;
}

export interface AppSettings {
  notificationsEnabled: boolean;
  appearance: 'dark' | 'light';
  lastBackupAt: number | null;
  desktopLinked: boolean;
  phoneOnline: boolean;
  desktopLinkHost?: string;
  desktopLinkPort?: number;
  desktopLinkToken?: string;
  preferredDevice: 'phone' | 'computer' | null;
  deviceChosen: boolean;
  backupNotificationsEnabled?: boolean;
  lastSeenVersion?: string;
}

export interface UserProfile {
  displayName: string;
  /** Avatar accent colour (0–359). */
  avatarHue: number;
  /** Optional 1–2 letter label override. */
  avatarLetters?: string;
  /** Optional photo data URL. */
  avatarImage?: string;
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  displayName: '',
  avatarHue: 212,
};

export const DEFAULT_SETTINGS: AppSettings = {
  notificationsEnabled: true,
  appearance: 'dark',
  lastBackupAt: null,
  desktopLinked: false,
  phoneOnline: false,
  preferredDevice: null,
  deviceChosen: false,
};

export interface AppState {
  identity?: { mnemonic?: string };
  onboardingDone?: boolean;
  contacts?: Contact[];
  messages?: ChatMessage[];
  groups?: Group[];
  groupInvites?: GroupInvite[];
  notifications?: AppNotification[];
  chatReadCursors?: Record<string, number>;
  settings?: Partial<AppSettings>;
  serverUrl?: string;
  appLock?: { salt: string; verifier: string; pinLength?: 4 | 6; passcodeType?: '4' | '6' | 'alphanumeric' };
  appLockPrefs?: { faceIdEnabled?: boolean; autoLockSeconds?: number; entryAnimationEnabled?: boolean };
  userProfile?: UserProfile;
  /** Local account creation timestamp (ms). */
  accountCreatedAt?: number;
  callHistory?: CallRecord[];
}

export function homePath(isDesktop: boolean): string {
  return isDesktop ? '/app' : '/chats';
}

export function homePathForDevice(device: 'phone' | 'computer'): string {
  return device === 'computer' ? '/app' : '/chats';
}

export function chatPath(isDesktop: boolean, contactId: string): string {
  const base = isDesktop ? '/app' : '/chat';
  return `${base}/${encodeURIComponent(contactId)}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const diff = now.getTime() - d.getTime();
  if (diff < 7 * 86400000) {
    return d.toLocaleDateString([], { weekday: 'short' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatMediaViewerSubtitle(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Today at ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
  return d.toLocaleString([], {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatFingerprintGroups(fp: string): string {
  return fp.match(/.{1,5}/g)?.join(' ') ?? fp;
}

/** Split a 60-char fingerprint into 4 display rows. */
export function fingerprintRows(fp: string): string[] {
  const groups = fp.match(/.{1,5}/g) ?? [fp];
  const rows: string[] = [];
  for (let i = 0; i < groups.length; i += 3) {
    rows.push(groups.slice(i, i + 3).join(' '));
  }
  while (rows.length < 4) rows.push('');
  return rows.slice(0, 4);
}

export function contactDisplayName(contact: Contact): string {
  const local = contact.alias?.trim() ?? '';
  const isDefaultName =
    contact.isUnknown ||
    local === UNKNOWN_CONTACT_ALIAS ||
    local === 'New contact';
  if (!isDefaultName && local) return local;
  const peer = contact.peerAlias?.trim();
  if (peer) return peer;
  return local || UNKNOWN_CONTACT_ALIAS;
}

export { previewText, buildMessageListPreview, type MessageListPreview, type PreviewKind } from './message-preview';

export function toProtocolContent(c: MessageContent): TextContent | AttachmentContent {
  if (c.kind === 'text') return { kind: 'text', body: c.body };
  if (c.kind === 'group_invite') {
    return { kind: 'text', body: `Group invite: ${c.groupName}` };
  }
  if (c.kind === 'export_block_notice') {
    return { kind: 'text', body: `Chat export was blocked by ${c.byAlias}` };
  }
  const base = {
    kind: c.kind,
    blobId: c.blobId,
    mime: c.mime,
    fileName: c.fileName,
    size: c.size,
    fileKey: c.fileKey,
    digest: c.digest,
  };
  if (c.kind === 'voice' && c.durationMs != null) {
    return { ...base, durationMs: c.durationMs };
  }
  if ((c.kind === 'image' || c.kind === 'video') && c.mediaGroupId) {
    return {
      ...base,
      mediaGroupId: c.mediaGroupId,
      mediaGroupIndex: c.mediaGroupIndex,
      mediaGroupTotal: c.mediaGroupTotal,
    } as AttachmentContent;
  }
  return base;
}

export { loadState, saveState } from './state-storage';
