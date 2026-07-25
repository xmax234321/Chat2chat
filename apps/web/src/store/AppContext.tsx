import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { decodeContent } from '@chat2chat/protocol';
import {
  generateIdentity,
  identityFromMnemonic,
  computeFingerprint,
  parseUserId,
  formatFingerprint,
  type Identity,
} from '@chat2chat/crypto/browser';
import { isCapacitor, isDesktopShell, isNativeMobile, isIosCapacitor } from '../lib/platform';
import { authenticateBiometric } from '../lib/biometric';
import { BrowserTransport, UpgradeRequiredError } from '../lib/transport';
import { WebMedia } from '../lib/web-media';
import { defaultRelayHttpUrl, defaultRelayWsUrl, pickRelayUrls, preferredRelayEndpoints } from '../lib/server-url';
import type {
  AppNotification,
  ChatMessage,
  Contact,
  Group,
  GroupDeletePolicy,
  GroupInvite,
  GroupInviteStatus,
  MessageContent,
  AppSettings,
} from '../lib/types';
import {
  loadState,
  saveState,
  previewText,
  buildMessageListPreview,
  DEFAULT_SETTINGS,
  initials,
  UNKNOWN_CONTACT_ALIAS,
  isGroupId,
  generateGroupId,
  DEFAULT_GROUP_DELETE_POLICY,
  normalizeGroup,
  contactDisplayName,
} from '../lib/types';
import {
  unlockStateStorage,
  unlockStorageAfterBiometricAuth,
  lockStateStorage,
  isStateStorageLocked,
  clearAllStateStorage,
  loadIdentityMnemonic,
  enablePinStateEncryption,
  disablePinStateEncryption,
  rekeyStateStorage,
  storeBiometricUnlockKey,
  clearBiometricUnlockKey,
} from '../lib/state-storage';
import {
  decodeGroupControl,
  encodeGroupControl,
  encodeGroupMessagePayload,
  decodeMessagePayload,
  ownSenderAlias,
  resolveMemberAlias,
  type GroupControlPayload,
} from '../lib/group-protocol';
import { dedupePendingGroupInviteMessages } from '../lib/group-invite-messages';
import { truncateUserId } from '../lib/chat-shared-content';
import { applyAppearance } from '../lib/theme';
import { NativeAppIcon } from '../lib/native-app-icon';
import { checkForAppUpdate, compareVersions, type UpdateCheckResult } from '../lib/app-updates';
import { getClientVersion, type ClientVersionInfo } from '../lib/client-version';
import {
  clearBackup,
  hasBackup,
} from '../lib/safe-mode-vault';
import { getUploadSpeedKbps } from '../lib/connection-metrics';
import { notifyMessage, notifyToast } from '../lib/notify';
import { createFullImageBlobUrl, createMediaPreviewUrl, createVideoBubbleThumbUrl, createVideoBubbleThumbFromUrl, createInstantVideoThumbUrl, isVideoFramePreview } from '../lib/media-thumbnail';
import { enrichOutgoingPreview, quickPreviewForSend } from '../lib/quick-media-preview';
import {
  cacheDecryptedMedia,
  cacheMediaBlob,
  deleteCachedMediaBlobs,
  clearAllMediaCache,
  migrateMediaCacheToNativeFs,
  persistOutgoingMedia,
  readCachedMediaBytes,
  readCachedNativeRef,
} from '../lib/media-cache';
import { createNativeVideoThumbFromMessage } from '../lib/native-video-thumb';
import { deleteCachedVideoThumbs, persistVideoThumbPreview } from '../lib/video-thumb-cache';
import type { PickedMedia } from '../lib/pick-media';
import { mediaGroupWireFields, mediaGroupWireFieldsFromPick } from '../lib/media-group';
import { isVideoPick, isFilePick, isVoicePick, prepareImageForSend, prepareVideoForSend, prepareFileForSend } from '../lib/prepare-media-for-send';
import {
  buildBackupPayload,
  encryptBackupPayload,
  parseBackupFile,
  decryptBackupPayload,
  saveBackupFile,
  prepareBackupShare,
  sharePreparedBackup,
  buildAndPrepareMobileZipBackup,
  importBackupMediaToCache,
  messagesForRestore,
  type BackupSaveResult,
  type PreparedBackupShare,
  type PickedBackup,
} from '../lib/backup';
import {
  clearAppLock,
  isAppLockConfigured,
  loadStoredAppLock,
  saveAppLockPassword,
  validateAppLockPasscode,
  verifyAppLockPassword,
  loadAppLockPasscodeType,
  type AppLockPasscodeType,
} from '../lib/app-lock';
import { loadAppLockPreferences } from '../lib/app-lock-settings';
import { pruneNonEssentialAppFolderFiles } from '../lib/app-backups-folder';
import type { MessageReplyRef } from '../lib/message-reply';
import type { DesktopLinkOffer } from '../lib/desktop-link/protocol';
import { pairPhoneWithDesktop, onDesktopLinkMessage, sendMessageToDesktop, disconnectPhoneBle, reconnectPhoneToDesktop, setPhoneLinkEndpoint, notifyPhoneLinkOffline } from '../lib/desktop-link/phone';
import {
  bindDesktopLinkHandlers,
  sendRelayViaPhone,
  startDesktopLinkSession,
  saveDesktopLinkToken,
  loadDesktopLinkToken,
  clearDesktopLinkToken,
  stopDesktopLinkAdvertising,
} from '../lib/desktop-link/desktop';
import { DESKTOP_LINK_DEFAULT_PORT, DESKTOP_LINK_SERVICE_UUID } from '../lib/desktop-link/protocol';
import {
  encodeCallSignal,
  isCallSignal,
  type CallSignal,
  type CallSignalPayload,
} from '../lib/call-signaling';
import {
  encodeChatPrivacyControl,
  decodeChatPrivacyControl,
  type ChatPrivacyControlPayload,
} from '../lib/chat-privacy-protocol';
import { canDisableExportBlockForPeer } from '../lib/export-block-lock';
import { ensureSavedMessagesContact, isSavedMessagesContact, isSavedMessagesId, migrateSavedMessagesState } from '../lib/saved-messages';
import { ephemeralSendAllowed } from '../lib/ephemeral-send-policy';
import { ensureAccountCreatedAt } from '../lib/account-created';
import { loadUserProfile, resolveDisplayName } from '../lib/user-profile';
import {
  decryptIncomingMessage,
  encryptOutgoingMessage,
} from '../lib/message-crypto';
import {
  decodeMessageReceipt,
  encodeMessageReceipt,
  type MessageReceiptPayload,
} from '../lib/message-receipt-protocol';
import { deliveryMetaForSend } from '../lib/message-delivery';
import {
  exportBlocksFromContacts,
  fetchUserVault,
  uploadUserVault,
} from '../lib/user-vault';

function ownSenderDisplayName(): string {
  return resolveDisplayName(loadUserProfile().displayName);
}

interface SavedIdentity {
  mnemonic: string;
}

type ConnectionSnapshot = {
  connected: boolean;
  connecting: boolean;
  connectionPingMs: number | null;
  desktopBleConnected: boolean;
};

interface AppContextValue {
  identity: Identity | null;
  contacts: Contact[];
  messages: ChatMessage[];
  connected: boolean;
  connecting: boolean;
  connectionPingMs: number | null;
  connectionSnapshot: ConnectionSnapshot;
  setConnectionStatusLive: (live: boolean) => void;
  uploadSpeedKbps: number | null;
  settings: AppSettings;
  createAccount: () => Identity;
  recoverAccount: (mnemonic: string) => Identity;
  finishOnboarding: () => void;
  addContact: (userId: string, alias: string) => boolean;
  renameContact: (userId: string, alias: string) => void;
  setContactAvatar: (userId: string, avatar: string) => void;
  deleteMessage: (messageId: string) => void;
  skipContactNaming: (userId: string) => void;
  deleteChat: (contactId: string) => void;
  clearChatMessages: (contactId: string) => void;
  setContactNote: (userId: string, note: string) => void;
  blockContact: (userId: string) => void;
  unblockContact: (userId: string) => void;
  setContactExportBlocked: (userId: string, exportBlocked: boolean) => boolean;
  verifyContact: (userId: string) => void;
  sendText: (contactId: string, body: string, replyTo?: MessageReplyRef) => Promise<void>;
  sendCallSignal: (contactId: string, signal: CallSignalPayload) => Promise<void>;
  setCallSignalHandler: (handler: ((from: string, signal: CallSignal) => void) | null) => void;
  sendMedia: (contactId: string, picked: PickedMedia) => Promise<void>;
  cancelUpload: (messageId: string) => void;
  getContact: (id: string) => Contact | undefined;
  getThread: (contactId: string) => ChatMessage[];
  copyToClipboard: (text: string) => Promise<void>;
  logout: () => void;
  toggleNotifications: () => void;
  setAppearance: (mode: 'dark' | 'light') => void;
  checkForUpdates: () => Promise<UpdateCheckResult>;
  upgradeRequiredMessage: string | null;
  dismissUpgradeRequired: () => void;
  prepareBackup: (password: string) => Promise<PreparedBackupShare>;
  saveBackupDesktop: (password: string) => Promise<BackupSaveResult>;
  shareBackup: (prepared: PreparedBackupShare) => Promise<void>;
  restoreBackup: (password: string, input: string | PickedBackup) => Promise<void>;
  toggleBackupNotifications: () => void;
  linkDesktop: () => void;
  pairDesktopFromPhone: (offer: DesktopLinkOffer) => Promise<void>;
  desktopBleConnected: boolean;
  setPhoneOnline: (online: boolean) => void;
  setPreferredDevice: (device: 'phone' | 'computer') => void;
  importContactFromUrl: (userId: string) => void;
  setActiveChatContact: (contactId: string | null) => void;
  groups: Group[];
  groupInvites: GroupInvite[];
  notifications: AppNotification[];
  unreadNotificationCount: number;
  getGroup: (id: string) => Group | undefined;
  createGroup: (name: string, memberIds: string[]) => Promise<void>;
  inviteToGroup: (groupId: string, userId: string) => Promise<void>;
  acceptGroupInvite: (inviteId: string) => Promise<void>;
  declineGroupInvite: (inviteId: string) => Promise<void>;
  kickFromGroup: (groupId: string, userId: string) => Promise<void>;
  transferGroupAdmin: (groupId: string, newAdminId: string) => Promise<void>;
  updateGroupDeletePolicy: (groupId: string, policy: GroupDeletePolicy) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  markNotificationsRead: () => void;
  sendGroupText: (groupId: string, body: string, replyTo?: MessageReplyRef) => Promise<void>;
  markGroupMessageViewed: (groupId: string, messageId: string) => void;
  markEphemeralClosed: (messageId: string) => void;
  dismissNotification: (id: string) => void;
  chatReadCursors: Record<string, number>;
  flashMediaGroupId: string | null;
  signalMediaGroupSent: (mediaGroupId: string) => void;
  appLockEnabled: boolean;
  appUnlocked: boolean;
  unlockApp: (password: string, viaBiometric?: boolean) => Promise<boolean>;
  enableAppLock: (password: string, passcodeType?: AppLockPasscodeType) => Promise<void>;
  changeAppLockPassword: (current: string, next: string, passcodeType?: AppLockPasscodeType) => Promise<void>;
  disableAppLock: (password: string) => Promise<boolean>;
  lockApp: () => void;
  resetAppLockViaBackupRecovery: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function randomId(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function encodePayload(
  content: MessageContent & {
    from?: string;
    senderAlias?: string;
    groupId?: string;
    replyTo?: MessageReplyRef;
  },
  client?: ClientVersionInfo | null,
): Uint8Array {
  if (content.groupId && content.from && content.senderAlias) {
    return encodeGroupMessagePayload(content, {
      from: content.from,
      senderAlias: content.senderAlias,
      groupId: content.groupId,
      client,
      replyTo: content.replyTo,
    });
  }
  const clientFields = client
    ? { appVersion: client.version, appBuild: client.build }
    : {};
  if (content.kind === 'text') {
    return new TextEncoder().encode(
      JSON.stringify({
        kind: 'text',
        body: content.body,
        from: content.from,
        ...(content.senderAlias ? { senderAlias: content.senderAlias } : {}),
        ...(content.replyTo ? { replyTo: content.replyTo } : {}),
        ...clientFields,
      }),
    );
  }
  return new TextEncoder().encode(JSON.stringify({ ...content, from: content.from, ...clientFields }));
}

function incomingReply(parsed: { replyTo?: MessageReplyRef }): MessageReplyRef | undefined {
  const reply = parsed.replyTo;
  if (!reply?.id || !reply.preview) return undefined;
  return reply;
}

function decodePayload(
  bytes: Uint8Array,
): MessageContent & {
  from?: string;
  senderAlias?: string;
  groupId?: string;
  appVersion?: string;
  appBuild?: string;
} {
  const parsed = decodeMessagePayload(bytes);
  if (parsed) return parsed;
  return decodeContent(bytes);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function groupInviteMessageContent(inv: GroupInvite): Extract<MessageContent, { kind: 'group_invite' }> {
  return {
    kind: 'group_invite',
    inviteId: inv.id,
    groupId: inv.groupId,
    groupName: inv.groupName,
    status: inv.status,
    fromUserId: inv.fromUserId,
    fromAlias: inv.fromAlias,
  };
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function buildContact(userId: string, alias: string, isUnknown = false): Contact | null {
  try {
    const keys = parseUserId(userId);
    return {
      userId,
      fingerprint: computeFingerprint(keys.signingPublicKey, keys.dhPublicKey),
      alias,
      verified: false,
      isUnknown,
      avatar: isUnknown ? '?' : initials(alias),
    };
  } catch {
    return null;
  }
}

const activeChatContactIdRef = { current: null as string | null };

function decodeRouteContactId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function activeChatContactIdFromUrl(): string | null {
  const hash = window.location.hash.replace(/^#/, '');
  const hashMatch = hash.match(/^\/(?:chat|app)\/([^/?#]+)/);
  if (hashMatch?.[1]) return decodeRouteContactId(hashMatch[1]);

  const path = window.location.pathname;
  const pathMatch = path.match(/\/(?:chat|app)\/([^/]+)$/);
  if (pathMatch?.[1]) return decodeRouteContactId(pathMatch[1]);

  return null;
}

function isViewingContact(contactId: string): boolean {
  if (activeChatContactIdRef.current === contactId) return true;
  return activeChatContactIdFromUrl() === contactId;
}

function contactNotificationTitle(contacts: Contact[], senderId: string): string {
  const contact = contacts.find((c) => c.userId === senderId);
  if (!contact) return UNKNOWN_CONTACT_ALIAS;
  return contactDisplayName(contact);
}

function trySystemNotification(title: string, body: string, tag: string): void {
  if (!('Notification' in window) || document.visibilityState === 'visible') return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, tag });
  } catch {
    /* unsupported */
  }
}

function notifyIncoming(contacts: Contact[], senderId: string, preview: string): void {
  if (isViewingContact(senderId)) return;
  const title = contactNotificationTitle(contacts, senderId);
  const body = preview.slice(0, 140);
  notifyMessage(title, body);
  trySystemNotification(title, body, senderId);
}

function loadSettings(): AppSettings {
  const state = loadState();
  const raw = (state.settings ?? {}) as Partial<AppSettings> & { encryptionMode?: string };
  const { encryptionMode: _legacyEncryption, ...s } = raw;
  const base = { ...DEFAULT_SETTINGS, ...s };
  if (base.appearance === 'light') base.appearance = 'dark';
  if (state.onboardingDone && !base.deviceChosen) {
    return { ...base, deviceChosen: true };
  }
  return base;
}

const EMPTY_THREAD: ChatMessage[] = [];

export function AppProvider({ children }: { children: ReactNode }) {
  const saved = loadState();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [contacts, setContacts] = useState<Contact[]>(saved.contacts ?? []);
  const [groups, setGroups] = useState<Group[]>(() => (saved.groups ?? []).map(normalizeGroup));
  const [groupInvites, setGroupInvites] = useState<GroupInvite[]>(saved.groupInvites ?? []);
  const groupInvitesRef = useRef(groupInvites);
  const [notifications, setNotifications] = useState<AppNotification[]>(saved.notifications ?? []);
  const [chatReadCursors, setChatReadCursors] = useState<Record<string, number>>(
    () => saved.chatReadCursors ?? {},
  );
  const [flashMediaGroupId, setFlashMediaGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(saved.messages ?? []);
  const messagesByContact = useMemo(() => {
    const map = new Map<string, ChatMessage[]>();
    for (const message of messages) {
      const bucket = map.get(message.contactId);
      if (bucket) bucket.push(message);
      else map.set(message.contactId, [message]);
    }
    return map;
  }, [messages]);
  const getThread = useCallback(
    (contactId: string) => messagesByContact.get(contactId) ?? EMPTY_THREAD,
    [messagesByContact],
  );
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionPingMs, setConnectionPingMs] = useState<number | null>(null);
  const [uploadSpeedKbps, setUploadSpeedKbps] = useState<number | null>(null);
  const [desktopBleConnected, setDesktopBleConnected] = useState(false);
  const connectionStatusLiveRef = useRef(false);
  const [connectionSnapshot, setConnectionSnapshot] = useState<ConnectionSnapshot>({
    connected: false,
    connecting: false,
    connectionPingMs: null,
    desktopBleConnected: false,
  });
  const desktopBleConnectedRef = useRef(false);
  const [appLockEnabled, setAppLockEnabled] = useState(isAppLockConfigured);
  const [appUnlocked, setAppUnlocked] = useState(() => !isAppLockConfigured());
  const [upgradeRequiredMessage, setUpgradeRequiredMessage] = useState<string | null>(null);
  const transportRef = useRef<BrowserTransport | null>(null);
  const mediaRef = useRef<WebMedia | null>(null);
  const activeUploadsRef = useRef(new Map<string, { aborted: boolean }>());
  const identityRef = useRef<Identity | null>(null);
  const settingsRef = useRef(settings);
  const contactsRef = useRef(contacts);
  const groupsRef = useRef(groups);
  const messagesRef = useRef(messages);
  const chatReadCursorsRef = useRef(chatReadCursors);
  const readReceiptsSentRef = useRef<Set<string>>(new Set());
  const vaultVersionRef = useRef(1);
  const processedEnvelopeIdsRef = useRef<Set<string>>(new Set());
  const callSignalHandlerRef = useRef<((from: string, signal: CallSignal) => void) | null>(null);
  const clientVersionRef = useRef<ClientVersionInfo | null>(null);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    desktopBleConnectedRef.current = desktopBleConnected;
  }, [desktopBleConnected]);

  const refreshConnectionSnapshot = useCallback(() => {
    setConnectionSnapshot({
      connected,
      connecting,
      connectionPingMs,
      desktopBleConnected,
    });
  }, [connected, connecting, connectionPingMs, desktopBleConnected]);

  const setConnectionStatusLive = useCallback(
    (live: boolean) => {
      connectionStatusLiveRef.current = live;
      if (live) {
        refreshConnectionSnapshot();
      }
    },
    [refreshConnectionSnapshot],
  );

  useEffect(() => {
    if (connectionStatusLiveRef.current) {
      refreshConnectionSnapshot();
    }
  }, [connected, connecting, connectionPingMs, desktopBleConnected, refreshConnectionSnapshot]);

  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  useEffect(() => {
    if (!identity) return;
    setContacts((prev) => {
      const migrated = migrateSavedMessagesState(identity, prev, messagesRef.current);
      if (migrated.contacts === prev && migrated.messages === messagesRef.current) {
        const ensured = ensureSavedMessagesContact(prev);
        if (ensured === prev) return prev;
        persist({ contacts: ensured });
        return ensured;
      }
      if (migrated.messages !== messagesRef.current) {
        setMessages(migrated.messages);
        persist({ messages: migrated.messages });
      }
      persist({ contacts: migrated.contacts });
      return migrated.contacts;
    });
  }, [identity?.userId]);

  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  useEffect(() => {
    groupInvitesRef.current = groupInvites;
  }, [groupInvites]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    chatReadCursorsRef.current = chatReadCursors;
  }, [chatReadCursors]);

  const sendMessageReceipt = useCallback(async (contactId: string, receipt: MessageReceiptPayload) => {
    const id = identityRef.current ?? identity;
    if (!id || isGroupId(contactId)) return;
    const messageId = randomId();
    const bytes = encodeMessageReceipt(receipt);

    if (isDesktopShell() && settingsRef.current.desktopLinked) {
      await sendRelayViaPhone(contactId, messageId, bytesToBase64(bytes));
      return;
    }

    let transport = transportRef.current;
    if (!transport?.isConnected()) {
      try {
        const relay = await pickRelayUrls(relayRef.current);
        relayRef.current = relay;
        connectTransport(id, relay);
        transport = transportRef.current;
        await transport?.connect();
      } catch {
        return;
      }
    }
    if (transport?.isConnected()) {
      const wire = await encryptOutgoingMessage(contactId, bytes);
      transport.sendRaw(contactId, messageId, wire);
    }
  }, [identity]);

  const handleIncomingReceipt = useCallback((receipt: MessageReceiptPayload) => {
    setMessages((prev) => {
      const next = prev.map((m) => {
        if (m.id !== receipt.messageId || m.direction !== 'out') return m;
        return {
          ...m,
          pendingDelivery: false,
          deliveryStatus: receipt.kind === 'read_receipt' ? ('read' as const) : ('delivered' as const),
        };
      });
      saveState({ messages: next });
      return next;
    });
  }, []);

  const markChatRead = useCallback((contactId: string) => {
    const thread = messagesByContact.get(contactId) ?? EMPTY_THREAD;
    const latest = thread.length ? thread[thread.length - 1]!.timestamp : 0;
    const at = Math.max(latest, Date.now());
    setChatReadCursors((prev) => {
      if ((prev[contactId] ?? 0) >= at) return prev;
      const next = { ...prev, [contactId]: at };
      persist({ chatReadCursors: next });
      return next;
    });
    setNotifications((prev) => {
      if (!prev.some((n) => !n.read && n.groupId === contactId)) return prev;
      const next = prev.map((n) =>
        !n.read && n.groupId === contactId ? { ...n, read: true } : n,
      );
      persist({ notifications: next });
      return next;
    });

    const selfId = identityRef.current?.userId;
    if (!selfId || isGroupId(contactId)) return;
    for (const msg of thread) {
      if (msg.direction !== 'in' || readReceiptsSentRef.current.has(msg.id)) continue;
      readReceiptsSentRef.current.add(msg.id);
      void sendMessageReceipt(contactId, {
        kind: 'read_receipt',
        from: selfId,
        messageId: msg.id,
        at: Date.now(),
      });
    }
  }, [messagesByContact, sendMessageReceipt]);

  const setActiveChatContact = useCallback(
    (contactId: string | null) => {
      activeChatContactIdRef.current = contactId;
      if (contactId) markChatRead(contactId);
    },
    [markChatRead],
  );

  const persist = (patch: Parameters<typeof saveState>[0]) => saveState(patch);

  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persist({ settings: next });
      return next;
    });
  };

  const pushMessage = (msg: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;

      if (msg.content.kind === 'group_invite' && msg.content.status === 'pending') {
        const inviteContent = msg.content;
        const existingIdx = prev.findIndex(
          (m) =>
            m.contactId === msg.contactId &&
            m.content.kind === 'group_invite' &&
            m.content.groupId === inviteContent.groupId &&
            m.content.status === 'pending',
        );
        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = {
            ...next[existingIdx]!,
            id: msg.id,
            content: msg.content,
            timestamp: msg.timestamp,
            direction: msg.direction,
          };
          persist({ messages: next });
          return next;
        }
      }

      const next = [...prev, msg];
      persist({ messages: next });
      return next;
    });
    if (msg.direction === 'in' && isViewingContact(msg.contactId)) {
      markChatRead(msg.contactId);
    }
    if (isCapacitor() && settingsRef.current.desktopLinked) {
      void sendMessageToDesktop(msg).catch(() => {});
    }
  };

  const updateGroupInviteMessageStatus = useCallback((inviteId: string, status: GroupInviteStatus) => {
    setMessages((prev) => {
      let changed = false;
      const next = prev.map((m): ChatMessage => {
        if (m.content.kind !== 'group_invite' || m.content.inviteId !== inviteId) return m;
        changed = true;
        return { ...m, content: { ...m.content, status } };
      });
      if (!changed) return prev;
      persist({ messages: next });
      return next;
    });
  }, []);

  const updateOutgoingInviteStatusForPeer = useCallback(
    (groupId: string, peerUserId: string, status: GroupInviteStatus) => {
      setMessages((prev) => {
        let changed = false;
        const next = prev.map((m): ChatMessage => {
          if (
            m.contactId !== peerUserId ||
            m.direction !== 'out' ||
            m.content.kind !== 'group_invite' ||
            m.content.groupId !== groupId
          ) {
            return m;
          }
          changed = true;
          return { ...m, content: { ...m.content, status } };
        });
        if (!changed) return prev;
        persist({ messages: next });
        return next;
      });
    },
    [],
  );

  const purgeMessage = useCallback((messageId: string) => {
    setMessages((prev) => {
      const next = prev.filter((m) => m.id !== messageId);
      if (next.length === prev.length) return prev;
      persist({ messages: next });
      return next;
    });
  }, []);

  const updateMessageMeta = useCallback((messageId: string, patch: Partial<ChatMessage>) => {
    setMessages((prev) => {
      const next = prev.map((m) => {
        if (m.id !== messageId) return m;
        const merged = { ...m, ...patch };
        if (patch.pendingDelivery === true) {
          merged.deliveryStatus = 'pending';
        } else if (
          patch.pendingDelivery === false &&
          merged.direction === 'out' &&
          !patch.deliveryStatus &&
          merged.deliveryStatus !== 'delivered' &&
          merged.deliveryStatus !== 'read'
        ) {
          merged.deliveryStatus = 'sent';
        }
        return merged;
      });
      persist({ messages: next });
      return next;
    });
  }, []);

  const signalMediaGroupSent = useCallback((mediaGroupId: string) => {
    setFlashMediaGroupId(mediaGroupId);
    window.setTimeout(() => {
      setFlashMediaGroupId((current) => (current === mediaGroupId ? null : current));
    }, 700);
  }, []);

  const syncExportBlockVault = useCallback(async () => {
    const id = identityRef.current ?? identity;
    if (!id) return;
    const mnemonic = id.mnemonic ?? (await loadIdentityMnemonic());
    if (!mnemonic) return;
    const exportBlocks = exportBlocksFromContacts(contactsRef.current);
    const version = vaultVersionRef.current + 1;
    vaultVersionRef.current = version;
    try {
      await uploadUserVault(id.userId, mnemonic, { version, exportBlocks });
    } catch {
      /* offline */
    }
  }, [identity]);

  const mergeVaultExportBlocks = useCallback(async () => {
    const id = identityRef.current ?? identity;
    if (!id) return;
    const mnemonic = id.mnemonic ?? (await loadIdentityMnemonic());
    if (!mnemonic) return;
    const remote = await fetchUserVault(id.userId, mnemonic);
    if (!remote?.exportBlocks) return;
    vaultVersionRef.current = Math.max(vaultVersionRef.current, remote.version);
    setContacts((prev) => {
      let changed = false;
      const next = prev.map((c) => {
        const remoteAt = remote.exportBlocks[c.userId];
        if (!remoteAt) return c;
        const localAt = c.exportBlockForPeerAt ?? 0;
        if (remoteAt <= localAt) return c;
        changed = true;
        return { ...c, exportBlockForPeerAt: remoteAt };
      });
      if (changed) persist({ contacts: next });
      return changed ? next : prev;
    });
  }, [identity]);

  const patchMessage = (
    id: string,
    content: Partial<Extract<MessageContent, { kind: 'image' | 'video' | 'file' | 'voice' }>>,
    options?: { persist?: boolean },
  ) => {
    setMessages((prev) => {
      const next = prev.map((m) => {
        if (m.id !== id || m.content.kind === 'text' || m.content.kind === 'group_invite' || m.content.kind === 'export_block_notice') return m;
        return { ...m, content: { ...m.content, ...content } };
      });
      if (options?.persist !== false) persist({ messages: next });
      return next;
    });
  };

  const notePeerAlias = useCallback((userId: string, peerAlias?: string) => {
    const name = peerAlias?.trim();
    if (!name) return;
    setContacts((prev) => {
      const idx = prev.findIndex((c) => c.userId === userId);
      if (idx < 0) {
        const contact = buildContact(userId, UNKNOWN_CONTACT_ALIAS, true);
        if (!contact) return prev;
        const next = [...prev, { ...contact, peerAlias: name }];
        persist({ contacts: next });
        return next;
      }
      const current = prev[idx]!;
      if (current.peerAlias === name) return prev;
      const next = [...prev];
      next[idx] = { ...current, peerAlias: name };
      persist({ contacts: next });
      return next;
    });
  }, []);

  const ensureContact = useCallback((userId: string) => {
    if (!userId.startsWith('c2c_')) return;
    setContacts((prev) => {
      if (prev.some((c) => c.userId === userId)) return prev;
      const contact = buildContact(userId, UNKNOWN_CONTACT_ALIAS, true);
      if (!contact) return prev;
      const next = [...prev, contact];
      persist({ contacts: next });
      return next;
    });
  }, []);

  const noteContactClientVersion = useCallback((userId: string, appVersion?: string, appBuild?: string) => {
    if (!appVersion) return;
    setContacts((prev) => {
      const idx = prev.findIndex((c) => c.userId === userId);
      if (idx < 0) return prev;
      const current = prev[idx]!;
      if (current.appVersion === appVersion && current.appBuild === appBuild) return prev;
      const next = [...prev];
      next[idx] = { ...current, appVersion, appBuild };
      persist({ contacts: next });
      return next;
    });
  }, []);

  const pushNotification = useCallback((notification: AppNotification) => {
    setNotifications((prev) => {
      if (prev.some((n) => n.id === notification.id)) return prev;
      const next = [notification, ...prev];
      persist({ notifications: next });
      return next;
    });
  }, []);

  const ensureTransportReady = useCallback(async () => {
    const id = identityRef.current ?? identity;
    if (!id) return null;
    let transport = transportRef.current;
    if (transport?.isConnected()) return transport;
    if (transport?.isConnecting()) {
      try {
        await transport.connect();
      } catch {
        /* retry below */
      }
      if (transport.isConnected()) return transport;
    }
    try {
      const relay = await pickRelayUrls(relayRef.current);
      relayRef.current = relay;
      if (!transport) {
        connectTransport(id, relay);
        transport = transportRef.current;
      }
      await transport?.connect();
    } catch {
      /* relay offline */
    }
    return transportRef.current;
  }, [identity]);

  const fanOutPlaintext = useCallback(
    async (memberIds: string[], selfId: string, buildBytes: (messageId: string) => Uint8Array) => {
      const transport = await ensureTransportReady();
      if (!transport?.isConnected()) return;
      for (const memberId of memberIds) {
        if (memberId === selfId) continue;
        const messageId = randomId();
        transport.sendPlaintext(memberId, messageId, buildBytes(messageId));
      }
    },
    [ensureTransportReady],
  );

  const fanOutControl = useCallback(
    async (memberIds: string[], selfId: string, control: GroupControlPayload) => {
      const bytes = encodeGroupControl(control);
      await fanOutPlaintext(memberIds, selfId, () => bytes);
    },
    [fanOutPlaintext],
  );

  const handleIncomingGroupControl = useCallback(
    (control: GroupControlPayload, selfId: string) => {
      switch (control.kind) {
        case 'group_create': {
          const g = normalizeGroup(control.group);
          setGroups((prev) => {
            if (prev.some((x) => x.id === g.id)) return prev;
            const next = [...prev, g];
            persist({ groups: next });
            return next;
          });
          break;
        }
        case 'group_invite': {
          const inv = control.invite;
          if (inv.fromUserId === selfId) break;
          ensureContact(inv.fromUserId);
          setGroupInvites((prev) => {
            if (prev.some((x) => x.id === inv.id)) return prev;
            const next = [...prev, inv];
            persist({ groupInvites: next });
            return next;
          });
          pushMessage({
            id: inv.id,
            contactId: inv.fromUserId,
            direction: 'in',
            content: groupInviteMessageContent(inv),
            timestamp: inv.timestamp,
          });
          pushNotification({
            id: `notif_inv_${inv.id}`,
            kind: 'group_invite',
            inviteId: inv.id,
            groupId: inv.groupId,
            groupName: inv.groupName,
            fromUserId: inv.fromUserId,
            fromAlias: inv.fromAlias,
            timestamp: inv.timestamp,
            read: false,
          });
          break;
        }
        case 'group_invite_accept': {
          updateOutgoingInviteStatusForPeer(control.groupId, control.userId, 'accepted');
          setGroups((prev) => {
            const idx = prev.findIndex((g) => g.id === control.groupId);
            if (idx < 0) return prev;
            const g = prev[idx]!;
            if (g.memberIds.includes(control.userId)) {
              const invitedIds = g.invitedIds.filter((id) => id !== control.userId);
              if (invitedIds.length === g.invitedIds.length) return prev;
              const next = [...prev];
              next[idx] = { ...g, invitedIds };
              persist({ groups: next });
              return next;
            }
            const next = [...prev];
            next[idx] = {
              ...g,
              memberIds: [...g.memberIds, control.userId],
              invitedIds: g.invitedIds.filter((id) => id !== control.userId),
            };
            persist({ groups: next });
            return next;
          });
          setGroupInvites((prev) => {
            const next = prev.map((inv) =>
              inv.groupId === control.groupId && inv.status === 'pending'
                ? { ...inv, status: 'accepted' as const }
                : inv,
            );
            persist({ groupInvites: next });
            return next;
          });
          break;
        }
        case 'group_invite_decline': {
          updateOutgoingInviteStatusForPeer(control.groupId, control.from, 'declined');
          setGroups((prev) => {
            const idx = prev.findIndex((g) => g.id === control.groupId);
            if (idx < 0) return prev;
            const g = prev[idx]!;
            const next = [...prev];
            next[idx] = {
              ...g,
              invitedIds: g.invitedIds.filter((uid) => uid !== control.from),
            };
            persist({ groups: next });
            return next;
          });
          setGroupInvites((prev) => {
            const next = prev.map((inv) =>
              inv.id === control.inviteId ? { ...inv, status: 'declined' as const } : inv,
            );
            persist({ groupInvites: next });
            return next;
          });
          break;
        }
        case 'group_kick': {
          if (control.userId === selfId) {
            setGroups((prev) => {
              const g = prev.find((x) => x.id === control.groupId);
              if (!g) return prev;
              const next = prev.filter((x) => x.id !== control.groupId);
              persist({ groups: next });
              return next;
            });
            pushNotification({
              id: `notif_kick_${control.groupId}_${Date.now()}`,
              kind: 'group_kick',
              groupId: control.groupId,
              groupName: groupsRef.current.find((g) => g.id === control.groupId)?.name ?? 'Group',
              timestamp: Date.now(),
              read: false,
            });
          } else {
            setGroups((prev) => {
              const idx = prev.findIndex((g) => g.id === control.groupId);
              if (idx < 0) return prev;
              const g = prev[idx]!;
              const next = [...prev];
              next[idx] = { ...g, memberIds: g.memberIds.filter((id) => id !== control.userId) };
              persist({ groups: next });
              return next;
            });
          }
          break;
        }
        case 'group_delete': {
          setGroups((prev) => {
            const next = prev.filter((x) => x.id !== control.groupId);
            persist({ groups: next });
            return next;
          });
          setMessages((prev) => {
            const next = prev.filter((m) => m.contactId !== control.groupId);
            persist({ messages: next });
            return next;
          });
          setGroupInvites((prev) => {
            const next = prev.filter((inv) => inv.groupId !== control.groupId);
            persist({ groupInvites: next });
            return next;
          });
          break;
        }
        case 'group_admin_transfer': {
          setGroups((prev) => {
            const idx = prev.findIndex((g) => g.id === control.groupId);
            if (idx < 0) return prev;
            const g = prev[idx]!;
            const next = [...prev];
            next[idx] = { ...g, adminId: control.newAdminId };
            persist({ groups: next });
            return next;
          });
          if (control.newAdminId === selfId) {
            const g = groupsRef.current.find((x) => x.id === control.groupId);
            pushNotification({
              id: `notif_admin_${control.groupId}_${Date.now()}`,
              kind: 'admin_transfer',
              groupId: control.groupId,
              groupName: g?.name ?? 'Group',
              fromUserId: control.from,
              timestamp: Date.now(),
              read: false,
            });
          }
          break;
        }
        case 'group_settings_update': {
          setGroups((prev) => {
            const idx = prev.findIndex((g) => g.id === control.groupId);
            if (idx < 0) return prev;
            const g = prev[idx]!;
            const next = [...prev];
            next[idx] = { ...g, deletePolicy: control.deletePolicy };
            persist({ groups: next });
            return next;
          });
          break;
        }
        case 'group_message_view':
          break;
        default:
          break;
      }
    },
    [pushNotification, updateOutgoingInviteStatusForPeer],
  );

  const pushExportBlockNotice = useCallback((contactId: string, byUserId: string, byAlias: string, direction: 'in' | 'out') => {
    const alreadyNoticed = messagesRef.current.some(
      (m) => m.contactId === contactId && m.content.kind === 'export_block_notice',
    );
    if (alreadyNoticed) return;
    pushMessage({
      id: randomId(),
      contactId,
      direction,
      content: { kind: 'export_block_notice', byUserId, byAlias },
      timestamp: Date.now(),
    });
  }, []);

  const handleIncomingChatPrivacy = useCallback((control: ChatPrivacyControlPayload) => {
    const senderId = control.from;
    const senderAlias = resolveMemberAlias(senderId, contactsRef.current);

    setContacts((prev) => {
      const next = prev.map((c) => {
        if (c.userId !== senderId) return c;
        if (control.kind === 'chat_export_block') {
          return {
            ...c,
            exportBlockedByPeer: true,
            exportBlockedByPeerAt: control.at,
          };
        }
        return {
          ...c,
          exportBlockedByPeer: undefined,
          exportBlockedByPeerAt: undefined,
        };
      });
      persist({ contacts: next });
      return next;
    });

    if (control.kind === 'chat_export_block') {
      pushExportBlockNotice(senderId, senderId, senderAlias, 'in');
    }
  }, [pushExportBlockNotice]);

  const relayRef = useRef(preferredRelayEndpoints());

  const claimEnvelope = useCallback((messageId: string): boolean => {
    if (processedEnvelopeIdsRef.current.has(messageId)) return false;
    if (messagesRef.current.some((m) => m.id === messageId)) {
      processedEnvelopeIdsRef.current.add(messageId);
      return false;
    }
    processedEnvelopeIdsRef.current.add(messageId);
    return true;
  }, []);

  const connectTransport = (id: Identity, relay = relayRef.current) => {
    identityRef.current = id;
    for (const msg of messagesRef.current) {
      processedEnvelopeIdsRef.current.add(msg.id);
    }
    const existing = transportRef.current;
    if (existing && activeUploadsRef.current.size > 0) {
      if (!existing.isConnected() && !existing.isConnecting()) {
        void existing.connect();
      }
      return;
    }
    existing?.disconnect();
    const httpBase = relay.http || defaultRelayHttpUrl();
    const clientInfo = clientVersionRef.current;
    const transport = new BrowserTransport({
      serverUrl: relay.ws || defaultRelayWsUrl(),
      userId: id.userId,
      appVersion: clientInfo?.version,
      appBuild: clientInfo?.build,
      autoAck: false,
      reconnect: true,
      onConnectingChange: (active) => setConnecting(active),
      onConnectionChange: (online) => {
        setConnected(online);
        if (online) setConnecting(false);
      },
      onError: (err) => {
        if (err instanceof UpgradeRequiredError) {
          setUpgradeRequiredMessage(err.message);
          setConnecting(false);
          setConnected(false);
        }
      },
      onMessage: async (env, bytes) => {
        const ackDuplicate = async () => {
          await transport.ackDelivery(env.messageId);
        };

        if (!claimEnvelope(env.messageId)) {
          await ackDuplicate();
          return;
        }

        try {
          try {
            const maybeCall = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
            if (isCallSignal(maybeCall)) {
              const senderId = maybeCall.from;
              if (!senderId.startsWith('c2c_')) return;
              ensureContact(senderId);
              callSignalHandlerRef.current?.(senderId, maybeCall);
              await transport.ackDelivery(env.messageId);
              return;
            }
          } catch {
            /* not a call signal */
          }

          const control = decodeGroupControl(bytes);
        if (control) {
          const selfId = identityRef.current?.userId ?? '';
          handleIncomingGroupControl(control, selfId);
          await transport.ackDelivery(env.messageId);
          return;
        }

        let plaintext = bytes;
        try {
          plaintext = await decryptIncomingMessage(env.recipientId ?? '', bytes);
        } catch {
          /* keep raw bytes for legacy peers */
        }

        const privacy = decodeChatPrivacyControl(plaintext);
        if (privacy) {
          const senderId = privacy.from;
          if (!senderId?.startsWith('c2c_')) return;
          ensureContact(senderId);
          handleIncomingChatPrivacy(privacy);
          await transport.ackDelivery(env.messageId);
          return;
        }

        const receipt = decodeMessageReceipt(plaintext);
        if (receipt) {
          if (receipt.from?.startsWith('c2c_')) {
            handleIncomingReceipt(receipt);
          }
          await transport.ackDelivery(env.messageId);
          return;
        }

        const parsed = decodePayload(plaintext);
        const senderId = parsed.from;
        if (!senderId?.startsWith('c2c_')) return;

        if (parsed.groupId && isGroupId(parsed.groupId)) {
          ensureContact(senderId);
          noteContactClientVersion(senderId, parsed.appVersion, parsed.appBuild);
          const selfId = identityRef.current?.userId ?? '';
          const direction = senderId === selfId ? 'out' : 'in';
          pushMessage({
            id: env.messageId,
            contactId: parsed.groupId,
            direction,
            senderId,
            senderAlias: parsed.senderAlias ?? resolveMemberAlias(senderId, contactsRef.current),
            content: parsed.kind === 'text' ? { kind: 'text', body: parsed.body } : parsed,
            replyTo: incomingReply(parsed as { replyTo?: MessageReplyRef }),
            timestamp: Date.now(),
          });
          if (direction === 'in' && settingsRef.current.notificationsEnabled) {
            const group = groupsRef.current.find((g) => g.id === parsed.groupId);
            notifyIncoming(
              contactsRef.current,
              senderId,
              `${group?.name ?? 'Group'}: ${parsed.kind === 'text' ? parsed.body : previewText(parsed)}`,
            );
          }
          await transport.ackDelivery(env.messageId);
          if (isViewingContact(parsed.groupId)) {
            const group = groupsRef.current.find((g) => g.id === parsed.groupId);
            if (group) {
              transport.sendViewAck({
                messageId: env.messageId,
                groupId: parsed.groupId,
                memberCount: group.memberIds.length,
                policy: group.deletePolicy,
              });
            }
          }
          return;
        }

        ensureContact(senderId);
        noteContactClientVersion(senderId, parsed.appVersion, parsed.appBuild);
        notePeerAlias(senderId, parsed.senderAlias);
        if (isContactBlocked(senderId)) {
          await transport.ackDelivery(env.messageId);
          return;
        }
        pushMessage({
          id: env.messageId,
          contactId: senderId,
          direction: 'in',
          content: parsed.kind === 'text' ? { kind: 'text', body: parsed.body } : parsed,
          replyTo: incomingReply(parsed as { replyTo?: MessageReplyRef }),
          timestamp: Date.now(),
        });
        if (settingsRef.current.notificationsEnabled) {
          notifyIncoming(
            contactsRef.current,
            senderId,
            parsed.kind === 'text' ? parsed.body : previewText(parsed),
          );
        }
        await transport.ackDelivery(env.messageId);
        const selfId = identityRef.current?.userId;
        if (selfId) {
          void sendMessageReceipt(senderId, {
            kind: 'delivery_receipt',
            from: selfId,
            messageId: env.messageId,
            at: Date.now(),
          });
        }
        } catch (e) {
          processedEnvelopeIdsRef.current.delete(env.messageId);
          throw e;
        }
      },
      onAttachment: async (env, bucket) => {
        const ackDuplicate = async () => {
          await transport.ackDelivery(env.messageId);
        };

        if (!claimEnvelope(env.messageId)) {
          await ackDuplicate();
          return;
        }

        const media = mediaRef.current;
        if (!media) return;
        try {
          const received = await media.handleIncoming(env.messageId, bucket);
          if (!received) return;
          const senderId = received.from;
          if (!senderId?.startsWith('c2c_')) return;
          ensureContact(senderId);
          noteContactClientVersion(senderId, received.appVersion, received.appBuild);
          const displayMime =
            received.content.mime === 'video/quicktime' ? 'video/mp4' : received.content.mime;
          const isFile = received.content.kind === 'file';
          const isVoice = received.content.kind === 'voice';
          const isVideo = received.content.kind === 'video';
          const isImage = received.content.kind === 'image';
          const groupId = (received as { groupId?: string }).groupId;
          const senderAlias = (received as { senderAlias?: string }).senderAlias;
          notePeerAlias(senderId, senderAlias);
          const contactId = groupId && isGroupId(groupId) ? groupId : senderId;
          const selfId = identityRef.current?.userId ?? '';
          const direction = senderId === selfId ? 'out' : 'in';

          if (!groupId && direction === 'in' && isContactBlocked(senderId)) {
            await transport.ackDelivery(env.messageId);
            return;
          }

          let previewUrl: string | undefined;
          if (received.content.kind === 'image') {
            previewUrl = createFullImageBlobUrl(received.data, displayMime);
          } else if (isVideo) {
            previewUrl = createInstantVideoThumbUrl(received.content.fileName);
          } else if (isVoice) {
            previewUrl = URL.createObjectURL(
              new Blob([received.data.slice()], { type: displayMime }),
            );
          }

          const ephemeral =
            'ephemeral' in received.content
              ? (received.content as { ephemeral?: import('../lib/ephemeral-media').EphemeralMedia }).ephemeral
              : undefined;
          const mediaGroup =
            'mediaGroupId' in received.content &&
            typeof (received.content as { mediaGroupId?: string }).mediaGroupId === 'string'
              ? {
                  mediaGroupId: (received.content as { mediaGroupId: string }).mediaGroupId,
                  mediaGroupIndex: (received.content as { mediaGroupIndex?: number }).mediaGroupIndex ?? 0,
                  mediaGroupTotal: (received.content as { mediaGroupTotal?: number }).mediaGroupTotal ?? 1,
                }
              : undefined;

          const wireSentAt =
            'sentAt' in received.content && typeof (received.content as { sentAt?: number }).sentAt === 'number'
              ? (received.content as { sentAt: number }).sentAt
              : undefined;
          const caption =
            'caption' in received.content &&
            typeof (received.content as { caption?: string }).caption === 'string'
              ? (received.content as { caption: string }).caption
              : undefined;

          pushMessage({
            id: env.messageId,
            contactId,
            direction,
            senderId,
            senderAlias: senderAlias ?? resolveMemberAlias(senderId, contactsRef.current),
            content: {
              kind: received.content.kind,
              blobId: received.content.blobId,
              mime: received.content.mime,
              fileName: received.content.fileName,
              size: received.content.size,
              fileKey: received.content.fileKey,
              digest: received.content.digest,
              ...(isVoice && received.content.durationMs != null
                ? { durationMs: received.content.durationMs }
                : {}),
              ...(ephemeral ? { ephemeral } : {}),
              ...(mediaGroup && mediaGroup.mediaGroupTotal > 1 ? mediaGroup : {}),
              ...(caption ? { caption } : {}),
              previewUrl: previewUrl ?? undefined,
            },
            timestamp: wireSentAt ?? Date.now(),
          });

          void (async () => {
            try {
              if (isImage || isVideo) {
                await cacheDecryptedMedia(env.messageId, received.data, received.content.mime);
              } else {
                await cacheMediaBlob(env.messageId, received.data, received.content.mime);
              }
            } catch {
              /* message already visible */
            }
            if (isVideo) {
              let thumb = await createNativeVideoThumbFromMessage(env.messageId);
              if (!thumb || !isVideoFramePreview(thumb)) {
                thumb = await createVideoBubbleThumbUrl(
                  received.data,
                  displayMime,
                  received.content.fileName,
                );
              }
              if (!thumb || !isVideoFramePreview(thumb)) {
                const fromBlob = await createVideoBubbleThumbFromUrl(
                  URL.createObjectURL(new Blob([received.data.slice()], { type: displayMime })),
                  received.content.fileName,
                );
                if (fromBlob && isVideoFramePreview(fromBlob)) {
                  void persistVideoThumbPreview(env.messageId, fromBlob);
                  setMessages((prev) => {
                    const next = prev.map((m) =>
                      m.id === env.messageId && m.content.kind === 'video'
                        ? { ...m, content: { ...m.content, previewUrl: fromBlob } }
                        : m,
                    );
                    persist({ messages: next });
                    return next;
                  });
                  return;
                }
              }
              if (thumb) {
                void persistVideoThumbPreview(env.messageId, thumb);
                setMessages((prev) => {
                  const next = prev.map((m) =>
                    m.id === env.messageId && m.content.kind !== 'text'
                      ? { ...m, content: { ...m.content, previewUrl: thumb } }
                      : m,
                  );
                  persist({ messages: next });
                  return next;
                });
              }
            } else if (isFile) {
              const art = await createMediaPreviewUrl(
                received.data,
                received.content.mime,
                received.content.fileName,
              );
              if (art) {
                setMessages((prev) => {
                  const next = prev.map((m) =>
                    m.id === env.messageId && m.content.kind !== 'text'
                      ? { ...m, content: { ...m.content, previewUrl: art } }
                      : m,
                  );
                  persist({ messages: next });
                  return next;
                });
              }
            }
          })();

          if (settingsRef.current.notificationsEnabled && direction === 'in') {
            const group = groupId ? groupsRef.current.find((g) => g.id === groupId) : undefined;
            const preview = previewText({
              kind: received.content.kind,
              blobId: received.content.blobId,
              mime: received.content.mime,
              fileName: received.content.fileName,
              size: received.content.size,
              fileKey: received.content.fileKey,
              digest: received.content.digest,
              ...(isVoice && received.content.durationMs != null
                ? { durationMs: received.content.durationMs }
                : {}),
              previewUrl: previewUrl ?? undefined,
            });
            notifyIncoming(
              contactsRef.current,
              senderId,
              group ? `${group.name}: ${preview}` : preview,
            );
          }
          media.ackBlob(received.content.blobId);
          await transport.ackDelivery(env.messageId);
          if (!groupId && direction === 'in' && selfId) {
            void sendMessageReceipt(senderId, {
              kind: 'delivery_receipt',
              from: selfId,
              messageId: env.messageId,
              at: Date.now(),
            });
          }
          if (groupId && isGroupId(groupId) && isViewingContact(groupId)) {
            const group = groupsRef.current.find((g) => g.id === groupId);
            if (group) {
              transport.sendViewAck({
                messageId: env.messageId,
                groupId,
                memberCount: group.memberIds.length,
                policy: group.deletePolicy,
              });
            }
          }
        } catch (e) {
          processedEnvelopeIdsRef.current.delete(env.messageId);
          notifyToast(e instanceof Error ? e.message : 'Failed to download media');
        }
      },
    });
    mediaRef.current = new WebMedia({
      transport,
      userId: id.userId,
      httpBaseUrl: httpBase,
      getClientInfo: () => clientVersionRef.current,
    });
    transport
      .connect()
      .catch(() => {
        setConnecting(false);
        setConnected(false);
      });
    transportRef.current = transport;
  };

  const connectWithBestRelay = async (id: Identity) => {
    if (!clientVersionRef.current) {
      clientVersionRef.current = await getClientVersion();
    }
    const relay = await pickRelayUrls(preferredRelayEndpoints());
    relayRef.current = relay;
    connectTransport(id, relay);
  };

  useEffect(() => {
    const initial = loadSettings();
    applyAppearance(initial.appearance);
    if (isIosCapacitor()) {
      void NativeAppIcon.setAlternateIcon({ style: 'mono-dark' }).catch(() => {});
      void migrateMediaCacheToNativeFs().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (appLockEnabled && !appUnlocked) return;
    void (async () => {
      const mnemonic =
        (await loadIdentityMnemonic()) ?? (saved.identity as SavedIdentity | undefined)?.mnemonic;
      if (mnemonic && saved.onboardingDone) {
        try {
          const id = identityFromMnemonic(mnemonic);
          setIdentity(id);
          const linkedDesktop = isDesktopShell() && Boolean(saved.settings?.desktopLinked);
          if (!linkedDesktop) void connectWithBestRelay(id);
        } catch {
          /* invalid */
        }
      }
    })();
    const params = new URLSearchParams(window.location.search);
    const addId = params.get('add');
    if (addId?.startsWith('c2c_')) {
      sessionStorage.setItem('pending-add-contact', addId);
    }
    return () => transportRef.current?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!identity) {
      clientVersionRef.current = null;
      return;
    }
    void getClientVersion().then((info) => {
      clientVersionRef.current = info;
    });
  }, [identity]);

  useEffect(() => {
    if (!identity) return;
    void (async () => {
      if (!isCapacitor()) return;
      const { App } = await import('@capacitor/app');
      const info = await App.getInfo();
      const lastSeen = settingsRef.current.lastSeenVersion;
      if (lastSeen && compareVersions(info.version, lastSeen) > 0 && hasBackup()) {
        clearBackup();
      }
      if (!lastSeen || compareVersions(info.version, lastSeen) > 0) {
        updateSettings({ lastSeenVersion: info.version });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);

  useEffect(() => {
    if (!identity) return;
    setMessages((prev) => {
      let next = dedupePendingGroupInviteMessages(prev);
      const additions: ChatMessage[] = [];
      for (const inv of groupInvitesRef.current) {
        if (next.some((m) => m.id === inv.id)) continue;
        if (inv.fromUserId === identity.userId) continue;
        if (
          next.some(
            (m) =>
              m.content.kind === 'group_invite' &&
              m.content.groupId === inv.groupId &&
              m.contactId === inv.fromUserId &&
              m.content.status === 'pending',
          )
        ) {
          continue;
        }
        additions.push({
          id: inv.id,
          contactId: inv.fromUserId,
          direction: 'in',
          content: groupInviteMessageContent(inv),
          timestamp: inv.timestamp,
        });
      }
      if (!additions.length && next.length === prev.length) return prev;
      if (additions.length) next = [...next, ...additions];
      persist({ messages: next });
      return next;
    });
  }, [identity]);

  useEffect(() => {
    if (!connected) {
      setConnectionPingMs(null);
      return;
    }

    let cancelled = false;
    const measurePing = async () => {
      const transport = transportRef.current;
      if (!transport?.isConnected()) {
        if (!cancelled) setConnectionPingMs(null);
        return;
      }
      try {
        const ms = await transport.ping();
        if (!cancelled) setConnectionPingMs(ms);
      } catch {
        if (!cancelled) setConnectionPingMs(null);
      }
    };

    void measurePing();
    const pingTimer = window.setInterval(() => {
      void measurePing();
    }, 5000);
    const speedTimer = window.setInterval(() => {
      setUploadSpeedKbps(getUploadSpeedKbps());
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(pingTimer);
      window.clearInterval(speedTimer);
    };
  }, [connected]);

  useEffect(() => {
    if (!appLockEnabled) return;

    let lockTimer: number | null = null;
    const lock = () => {
      if (activeUploadsRef.current.size > 0) return;
      setAppUnlocked(false);
    };

    const onVisibility = () => {
      if (lockTimer) {
        window.clearTimeout(lockTimer);
        lockTimer = null;
      }
      if (document.visibilityState === 'hidden') {
        const delayMs = loadAppLockPreferences().autoLockSeconds * 1000;
        if (delayMs <= 0) lock();
        else lockTimer = window.setTimeout(lock, delayMs);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onPageHide = () => {
      const delayMs = loadAppLockPreferences().autoLockSeconds * 1000;
      if (delayMs <= 0) lock();
      else {
        if (lockTimer) window.clearTimeout(lockTimer);
        lockTimer = window.setTimeout(lock, delayMs);
      }
    };
    window.addEventListener('pagehide', onPageHide);

    return () => {
      if (lockTimer) window.clearTimeout(lockTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [appLockEnabled]);

  const backupReminderShownRef = useRef(false);
  useEffect(() => {
    if (!settings.backupNotificationsEnabled) return;
    if (settings.lastBackupAt && Date.now() - settings.lastBackupAt < 7 * 86400000) return;
    if (messages.length < 100) return;
    if (backupReminderShownRef.current) return;
    backupReminderShownRef.current = true;
    notifyToast('You have many messages — create a backup in Settings');
  }, [messages.length, settings.backupNotificationsEnabled, settings.lastBackupAt]);

  const hydrateFromStorage = useCallback(() => {
    const state = loadState();
    if (state.contacts) setContacts(state.contacts);
    if (state.groups) setGroups(state.groups.map(normalizeGroup));
    if (state.groupInvites) setGroupInvites(state.groupInvites);
    if (state.notifications) setNotifications(state.notifications);
    if (state.chatReadCursors) setChatReadCursors(state.chatReadCursors);
    if (state.messages) setMessages(state.messages);
    if (state.settings) {
      setSettings((prev) => ({ ...prev, ...state.settings }));
    }
    void (async () => {
      const mnemonic = (await loadIdentityMnemonic()) ?? state.identity?.mnemonic;
      if (mnemonic && state.onboardingDone) {
        try {
          const id = identityFromMnemonic(mnemonic);
          setIdentity(id);
          identityRef.current = id;
          const linkedDesktop = isDesktopShell() && Boolean(state.settings?.desktopLinked);
          if (!linkedDesktop) void connectWithBestRelay(id);
        } catch {
          /* invalid */
        }
      }
    })();
  }, []);

  const unlockApp = useCallback(async (password: string, viaBiometric = false) => {
    if (!appLockEnabled) {
      setAppUnlocked(true);
      return true;
    }
    if (viaBiometric) {
      if (!isCapacitor()) return false;
      const auth = await authenticateBiometric('Unlock Chat2Chat', 'unlock');
      if (!auth.success) return false;
      const unlocked = await unlockStorageAfterBiometricAuth();
      if (!unlocked && isStateStorageLocked()) return false;
      hydrateFromStorage();
      setAppUnlocked(true);
      return true;
    }
    const ok = verifyAppLockPassword(password);
    if (!ok) return false;

    if (!isStateStorageLocked()) {
      setAppUnlocked(true);
      return true;
    }

    setAppUnlocked(true);
    const unlocked = await unlockStateStorage(password);
    if (!unlocked) {
      setAppUnlocked(false);
      return false;
    }
    hydrateFromStorage();
    if (loadAppLockPreferences().faceIdEnabled) {
      void storeBiometricUnlockKey();
    }
    return true;
  }, [appLockEnabled, hydrateFromStorage]);

  const enableAppLock = useCallback(async (password: string, passcodeType: AppLockPasscodeType = '4') => {
    const err = validateAppLockPasscode(password, passcodeType);
    if (err) throw new Error(err);
    saveAppLockPassword(password, passcodeType);
    const stored = loadStoredAppLock();
    if (stored) await enablePinStateEncryption(password, stored.salt);
    if (loadAppLockPreferences().faceIdEnabled) {
      await storeBiometricUnlockKey();
    }
    setAppLockEnabled(true);
    setAppUnlocked(true);
  }, []);

  const changeAppLockPassword = useCallback(async (current: string, next: string, passcodeType?: AppLockPasscodeType) => {
    if (!verifyAppLockPassword(current)) throw new Error('Wrong PIN');
    const type = passcodeType ?? loadAppLockPasscodeType();
    const err = validateAppLockPasscode(next, type);
    if (err) throw new Error(err);
    saveAppLockPassword(next, type);
    const stored = loadStoredAppLock();
    if (stored) await rekeyStateStorage(next, stored.salt);
    if (loadAppLockPreferences().faceIdEnabled) {
      await storeBiometricUnlockKey();
    }
    setAppUnlocked(true);
  }, []);

  const disableAppLock = useCallback(async (password: string) => {
    if (!verifyAppLockPassword(password)) return false;
    await clearBiometricUnlockKey();
    await disablePinStateEncryption();
    clearAppLock();
    setAppLockEnabled(false);
    setAppUnlocked(true);
    return true;
  }, []);

  const lockApp = useCallback(() => {
    if (appLockEnabled) {
      lockStateStorage();
      setAppUnlocked(false);
    }
  }, [appLockEnabled]);

  const resetAppLockViaBackupRecovery = useCallback(async () => {
    await clearBiometricUnlockKey();
    await disablePinStateEncryption();
    clearAppLock();
    setAppLockEnabled(false);
    setAppUnlocked(true);
  }, []);

  const storeIdentity = (id: Identity) => {
    setIdentity(id);
    identityRef.current = id;
    if (id.mnemonic) persist({ identity: { mnemonic: id.mnemonic } });
  };

  const createAccount = useCallback(() => {
    if (isDesktopShell()) {
      throw new Error('Create account is only available on phone');
    }
    const id = generateIdentity(12);
    ensureAccountCreatedAt();
    storeIdentity(id);
    return id;
  }, []);

  const recoverAccount = useCallback((mnemonic: string) => {
    const id = identityFromMnemonic(mnemonic.trim().toLowerCase());
    storeIdentity(id);
    return id;
  }, []);

  const addContact = useCallback((userId: string, alias: string): boolean => {
    if (!userId.startsWith('c2c_')) return false;
    const selfId = identityRef.current?.userId;
    if (selfId && userId === selfId) return false;
    if (isSavedMessagesId(userId)) return false;
    const trimmed = alias.trim();
    const isUnknown = !trimmed;
    const contact = buildContact(userId, trimmed || UNKNOWN_CONTACT_ALIAS, isUnknown);
    if (!contact) return false;
    let added = false;
    setContacts((prev) => {
      if (prev.some((x) => x.userId === userId)) return prev;
      added = true;
      const next = [...prev, contact];
      persist({ contacts: next });
      return next;
    });
    return added;
  }, []);

  const renameContact = useCallback((userId: string, alias: string) => {
    const trimmed = alias.trim();
    if (!trimmed) return;
    if (isSavedMessagesId(userId)) return;
    setContacts((prev) => {
      const target = prev.find((c) => c.userId === userId);
      if (target && isSavedMessagesContact(target)) return prev;
      const next = prev.map((c) =>
        c.userId === userId
          ? { ...c, alias: trimmed, isUnknown: false, avatar: initials(trimmed) }
          : c,
      );
      persist({ contacts: next });
      return next;
    });
  }, []);

  const skipContactNaming = useCallback((userId: string) => {
    setContacts((prev) => {
      const next = prev.map((c) =>
        c.userId === userId
          ? { ...c, isUnknown: false, alias: truncateUserId(userId), avatar: '?' }
          : c,
      );
      persist({ contacts: next });
      return next;
    });
  }, []);

  const finishOnboarding = useCallback(() => {
    persist({ onboardingDone: true });
    ensureAccountCreatedAt();
    const id = identityRef.current ?? identity;
    if (id) void connectWithBestRelay(id);
    const pending = sessionStorage.getItem('pending-add-contact');
    if (pending?.startsWith('c2c_')) {
      sessionStorage.removeItem('pending-add-contact');
      addContact(pending, 'New contact');
    }
  }, [identity, addContact]);

  const importContactFromUrl = useCallback(
    (userId: string) => {
      addContact(userId, 'New contact');
    },
    [addContact],
  );

  const verifyContact = useCallback((userId: string) => {
    setContacts((prev) => {
      const next = prev.map((c) => (c.userId === userId ? { ...c, verified: true } : c));
      persist({ contacts: next });
      return next;
    });
  }, []);

  const deleteChat = useCallback((contactId: string) => {
    if (isSavedMessagesId(contactId)) return;

    let removedIds: string[] = [];
    setMessages((prev) => {
      removedIds = prev.filter((m) => m.contactId === contactId).map((m) => m.id);
      const next = prev.filter((m) => m.contactId !== contactId);
      persist({ messages: next });
      return next;
    });
    if (!isGroupId(contactId)) {
      setContacts((prev) => {
        const next = prev.filter((c) => c.userId !== contactId);
        persist({ contacts: next });
        return next;
      });
    } else {
      setGroups((prev) => {
        const next = prev.filter((g) => g.id !== contactId);
        persist({ groups: next });
        return next;
      });
    }
    if (removedIds.length) {
      void deleteCachedMediaBlobs(removedIds);
      void deleteCachedVideoThumbs(removedIds);
    }
    if (activeChatContactIdRef.current === contactId) {
      activeChatContactIdRef.current = null;
    }
  }, []);

  const clearChatMessages = useCallback((contactId: string) => {
    let removedIds: string[] = [];
    setMessages((prev) => {
      removedIds = prev.filter((m) => m.contactId === contactId).map((m) => m.id);
      const next = prev.filter((m) => m.contactId !== contactId);
      persist({ messages: next });
      return next;
    });
    if (removedIds.length) {
      void deleteCachedMediaBlobs(removedIds);
      void deleteCachedVideoThumbs(removedIds);
    }
  }, []);

  const setContactNote = useCallback((userId: string, note: string) => {
    const trimmed = note.trim();
    setContacts((prev) => {
      const next = prev.map((c) =>
        c.userId === userId ? { ...c, note: trimmed || undefined } : c,
      );
      persist({ contacts: next });
      return next;
    });
  }, []);

  const setContactAvatar = useCallback((userId: string, avatar: string) => {
    const nextAvatar = avatar.trim();
    if (!nextAvatar || isSavedMessagesId(userId) || isGroupId(userId)) return;
    setContacts((prev) => {
      const next = prev.map((c) => (c.userId === userId ? { ...c, avatar: nextAvatar } : c));
      persist({ contacts: next });
      return next;
    });
  }, []);

  const deleteMessage = useCallback((messageId: string) => {
    const target = messagesRef.current.find((m) => m.id === messageId);
    if (!target || !isSavedMessagesId(target.contactId)) return;
    setMessages((prev) => {
      const next = prev.filter((m) => m.id !== messageId);
      persist({ messages: next });
      return next;
    });
    void deleteCachedMediaBlobs([messageId]);
    void deleteCachedVideoThumbs([messageId]);
  }, []);

  const blockContact = useCallback((userId: string) => {
    setContacts((prev) => {
      const next = prev.map((c) => (c.userId === userId ? { ...c, blocked: true } : c));
      persist({ contacts: next });
      return next;
    });
  }, []);

  const unblockContact = useCallback((userId: string) => {
    setContacts((prev) => {
      const next = prev.map((c) => (c.userId === userId ? { ...c, blocked: false } : c));
      persist({ contacts: next });
      return next;
    });
  }, []);

  const sendChatPrivacyControl = useCallback(async (contactId: string, blocked: boolean, at?: number) => {
    const id = identityRef.current ?? identity;
    if (!id || isGroupId(contactId)) return;
    const messageId = randomId();
    const control: ChatPrivacyControlPayload = blocked
      ? { kind: 'chat_export_block', from: id.userId, at: at ?? Date.now() }
      : { kind: 'chat_export_allow', from: id.userId };
    const bytes = encodeChatPrivacyControl(control);

    if (isDesktopShell() && settingsRef.current.desktopLinked) {
      await sendRelayViaPhone(contactId, messageId, bytesToBase64(bytes));
      return;
    }

    let transport = transportRef.current;
    if (!transport?.isConnected()) {
      try {
        const relay = await pickRelayUrls(relayRef.current);
        relayRef.current = relay;
        connectTransport(id, relay);
        transport = transportRef.current;
        await transport?.connect();
      } catch {
        /* relay offline */
      }
    }
    if (transport?.isConnected()) {
      const wire = await encryptOutgoingMessage(contactId, bytes);
      transport.sendRaw(contactId, messageId, wire);
    }
  }, [identity]);

  const setContactExportBlocked = useCallback((userId: string, exportBlocked: boolean): boolean => {
    const id = identityRef.current ?? identity;
    if (!id || isGroupId(userId)) return false;

    if (exportBlocked) {
      const at = Date.now();
      const byAlias = ownSenderAlias(contactsRef.current, id.userId);
      setContacts((prev) => {
        const next = prev.map((c) =>
          c.userId === userId ? { ...c, exportBlockForPeerAt: at } : c,
        );
        persist({ contacts: next });
        return next;
      });
      void sendChatPrivacyControl(userId, true, at);
      pushExportBlockNotice(userId, id.userId, byAlias, 'out');
      void syncExportBlockVault();
      return true;
    }

    const contact = contactsRef.current.find((c) => c.userId === userId);
    if (!contact?.exportBlockForPeerAt) return false;
    if (!canDisableExportBlockForPeer(contact.exportBlockForPeerAt)) return false;

    setContacts((prev) => {
      const next = prev.map((c) =>
        c.userId === userId ? { ...c, exportBlockForPeerAt: undefined } : c,
      );
      persist({ contacts: next });
      return next;
    });
    void sendChatPrivacyControl(userId, false);
    void syncExportBlockVault();
    return true;
  }, [identity, pushExportBlockNotice, sendChatPrivacyControl, syncExportBlockVault]);

  const isContactBlocked = useCallback((userId: string) => {
    return contactsRef.current.some((c) => c.userId === userId && c.blocked);
  }, []);

  const getGroup = useCallback(
    (id: string) => groups.find((g) => g.id === id),
    [groups],
  );

  const createGroup = useCallback(
    async (name: string, memberIds: string[]) => {
      const id = identityRef.current ?? identity;
      if (!id) return;
      const groupId = generateGroupId();
      const trimmed = name.trim();
      const invited = memberIds.filter((m) => m !== id.userId);
      const group: Group = {
        id: groupId,
        name: trimmed,
        avatar: initials(trimmed),
        adminId: id.userId,
        memberIds: [id.userId],
        invitedIds: invited,
        createdAt: Date.now(),
        deletePolicy: DEFAULT_GROUP_DELETE_POLICY,
      };
      setGroups((prev) => {
        const next = [...prev, group];
        persist({ groups: next });
        return next;
      });

      const senderAlias = ownSenderDisplayName();
      for (const memberId of invited) {
        const invite: GroupInvite = {
          id: randomId(),
          groupId,
          groupName: trimmed,
          fromUserId: id.userId,
          fromAlias: senderAlias,
          timestamp: Date.now(),
          status: 'pending',
        };
        setGroupInvites((prev) => {
          const next = [...prev, invite];
          persist({ groupInvites: next });
          return next;
        });
        await fanOutControl([memberId], id.userId, {
          kind: 'group_invite',
          invite,
          from: id.userId,
        });
        pushMessage({
          id: invite.id,
          contactId: memberId,
          direction: 'out',
          content: groupInviteMessageContent(invite),
          timestamp: invite.timestamp,
        });
      }
    },
    [fanOutControl, identity],
  );

  const inviteToGroup = useCallback(
    async (groupId: string, userId: string) => {
      const id = identityRef.current ?? identity;
      const group = groupsRef.current.find((g) => g.id === groupId);
      if (!id || !group || group.adminId !== id.userId) return;
      if (group.memberIds.includes(userId) || group.invitedIds.includes(userId)) return;
      const invite: GroupInvite = {
        id: randomId(),
        groupId,
        groupName: group.name,
        fromUserId: id.userId,
        fromAlias: ownSenderAlias(contactsRef.current, id.userId),
        timestamp: Date.now(),
        status: 'pending',
      };
      setGroups((prev) => {
        const idx = prev.findIndex((g) => g.id === groupId);
        if (idx < 0) return prev;
        const g = prev[idx]!;
        const next = [...prev];
        next[idx] = { ...g, invitedIds: [...g.invitedIds, userId] };
        persist({ groups: next });
        return next;
      });
      setGroupInvites((prev) => {
        const next = [...prev, invite];
        persist({ groupInvites: next });
        return next;
      });
      await fanOutControl([userId], id.userId, {
        kind: 'group_invite',
        invite,
        from: id.userId,
      });
      pushMessage({
        id: invite.id,
        contactId: userId,
        direction: 'out',
        content: groupInviteMessageContent(invite),
        timestamp: invite.timestamp,
      });
    },
    [fanOutControl, identity],
  );

  const acceptGroupInvite = useCallback(
    async (inviteId: string) => {
      const id = identityRef.current ?? identity;
      if (!id) return;
      const invite = groupInvites.find((inv) => inv.id === inviteId);
      if (!invite || invite.status !== 'pending') return;

      updateGroupInviteMessageStatus(inviteId, 'accepted');
      setGroupInvites((prev) => {
        const next = prev.map((inv) =>
          inv.id === inviteId ? { ...inv, status: 'accepted' as const } : inv,
        );
        persist({ groupInvites: next });
        return next;
      });
      setNotifications((prev) => {
        const next = prev.map((n) =>
          n.kind === 'group_invite' && n.inviteId === inviteId ? { ...n, read: true } : n,
        );
        persist({ notifications: next });
        return next;
      });

      let membersToNotify: string[] = [invite.fromUserId];
      const existing = groupsRef.current.find((g) => g.id === invite.groupId);
      if (!existing) {
        const created: Group = {
          id: invite.groupId,
          name: invite.groupName,
          avatar: initials(invite.groupName),
          adminId: invite.fromUserId,
          memberIds: [invite.fromUserId, id.userId],
          invitedIds: [],
          createdAt: Date.now(),
          deletePolicy: DEFAULT_GROUP_DELETE_POLICY,
        };
        setGroups((prev) => {
          const next = [...prev, created];
          groupsRef.current = next;
          persist({ groups: next });
          membersToNotify = [invite.fromUserId];
          return next;
        });
      } else if (!existing.memberIds.includes(id.userId)) {
        setGroups((prev) => {
          const idx = prev.findIndex((g) => g.id === invite.groupId);
          if (idx < 0) return prev;
          const g = prev[idx]!;
          const next = [...prev];
          next[idx] = { ...g, memberIds: [...g.memberIds, id.userId] };
          groupsRef.current = next;
          persist({ groups: next });
          membersToNotify = next[idx]!.memberIds.filter((memberId) => memberId !== id.userId);
          return next;
        });
      } else {
        membersToNotify = existing.memberIds.filter((memberId) => memberId !== id.userId);
      }

      await fanOutControl(membersToNotify, id.userId, {
        kind: 'group_invite_accept',
        groupId: invite.groupId,
        userId: id.userId,
        userAlias: resolveMemberAlias(id.userId, contactsRef.current),
        from: id.userId,
      });
    },
    [fanOutControl, groupInvites, identity, updateGroupInviteMessageStatus],
  );

  const declineGroupInvite = useCallback(
    async (inviteId: string) => {
      const id = identityRef.current ?? identity;
      if (!id) return;
      const invite = groupInvites.find((inv) => inv.id === inviteId);
      if (!invite) return;
      updateGroupInviteMessageStatus(inviteId, 'declined');
      setGroupInvites((prev) => {
        const next = prev.map((inv) =>
          inv.id === inviteId ? { ...inv, status: 'declined' as const } : inv,
        );
        persist({ groupInvites: next });
        return next;
      });
      setNotifications((prev) => {
        const next = prev.map((n) =>
          n.kind === 'group_invite' && n.inviteId === inviteId ? { ...n, read: true } : n,
        );
        persist({ notifications: next });
        return next;
      });
      await fanOutControl([invite.fromUserId], id.userId, {
        kind: 'group_invite_decline',
        inviteId,
        groupId: invite.groupId,
        from: id.userId,
      });
    },
    [fanOutControl, groupInvites, identity, updateGroupInviteMessageStatus],
  );

  const kickFromGroup = useCallback(
    async (groupId: string, userId: string) => {
      const id = identityRef.current ?? identity;
      const group = groupsRef.current.find((g) => g.id === groupId);
      if (!id || !group || group.adminId !== id.userId || userId === id.userId) return;
      setGroups((prev) => {
        const idx = prev.findIndex((g) => g.id === groupId);
        if (idx < 0) return prev;
        const g = prev[idx]!;
        const next = [...prev];
        next[idx] = {
          ...g,
          memberIds: g.memberIds.filter((m) => m !== userId),
          invitedIds: g.invitedIds.filter((m) => m !== userId),
        };
        persist({ groups: next });
        return next;
      });
      const updated = groupsRef.current.find((g) => g.id === groupId);
      if (updated) {
        await fanOutControl([...updated.memberIds, userId], id.userId, {
          kind: 'group_kick',
          groupId,
          userId,
          from: id.userId,
        });
      }
    },
    [fanOutControl, identity],
  );

  const transferGroupAdmin = useCallback(
    async (groupId: string, newAdminId: string) => {
      const id = identityRef.current ?? identity;
      const group = groupsRef.current.find((g) => g.id === groupId);
      if (!id || !group || group.adminId !== id.userId) return;
      setGroups((prev) => {
        const idx = prev.findIndex((g) => g.id === groupId);
        if (idx < 0) return prev;
        const g = prev[idx]!;
        const next = [...prev];
        next[idx] = { ...g, adminId: newAdminId };
        persist({ groups: next });
        return next;
      });
      const updated = groupsRef.current.find((g) => g.id === groupId);
      if (updated) {
        await fanOutControl(updated.memberIds, id.userId, {
          kind: 'group_admin_transfer',
          groupId,
          newAdminId,
          from: id.userId,
        });
      }
    },
    [fanOutControl, identity],
  );

  const updateGroupDeletePolicy = useCallback(
    async (groupId: string, policy: GroupDeletePolicy) => {
      const id = identityRef.current ?? identity;
      const group = groupsRef.current.find((g) => g.id === groupId);
      if (!id || !group || group.adminId !== id.userId) return;
      setGroups((prev) => {
        const idx = prev.findIndex((g) => g.id === groupId);
        if (idx < 0) return prev;
        const g = prev[idx]!;
        const next = [...prev];
        next[idx] = { ...g, deletePolicy: policy };
        persist({ groups: next });
        return next;
      });
      const updated = groupsRef.current.find((g) => g.id === groupId);
      if (updated) {
        await fanOutControl(updated.memberIds, id.userId, {
          kind: 'group_settings_update',
          groupId,
          deletePolicy: policy,
          from: id.userId,
        });
      }
    },
    [fanOutControl, identity],
  );

  const leaveGroup = useCallback(
    async (groupId: string) => {
      const id = identityRef.current ?? identity;
      const group = groupsRef.current.find((g) => g.id === groupId);
      if (!id || !group || group.adminId === id.userId) return;
      setGroups((prev) => {
        const next = prev.filter((g) => g.id !== groupId);
        persist({ groups: next });
        return next;
      });
      setMessages((prev) => {
        const next = prev.filter((m) => m.contactId !== groupId);
        persist({ messages: next });
        return next;
      });
      await fanOutControl(group.memberIds, id.userId, {
        kind: 'group_kick',
        groupId,
        userId: id.userId,
        from: id.userId,
      });
    },
    [fanOutControl, identity],
  );

  const deleteGroup = useCallback(
    async (groupId: string) => {
      const id = identityRef.current ?? identity;
      const group = groupsRef.current.find((g) => g.id === groupId);
      if (!id || !group || group.adminId !== id.userId) return;

      const recipients = [...new Set([...group.memberIds, ...(group.invitedIds ?? [])])].filter(
        (memberId) => memberId !== id.userId,
      );
      if (recipients.length > 0) {
        await fanOutControl(recipients, id.userId, {
          kind: 'group_delete',
          groupId,
          from: id.userId,
        });
      }

      setGroups((prev) => {
        const next = prev.filter((g) => g.id !== groupId);
        groupsRef.current = next;
        persist({ groups: next });
        return next;
      });
      setMessages((prev) => {
        const next = prev.filter((m) => m.contactId !== groupId);
        persist({ messages: next });
        return next;
      });
      setGroupInvites((prev) => {
        const next = prev.filter((inv) => inv.groupId !== groupId);
        persist({ groupInvites: next });
        return next;
      });
      setNotifications((prev) => {
        const next = prev.filter((n) => n.groupId !== groupId);
        persist({ notifications: next });
        return next;
      });
      setChatReadCursors((prev) => {
        if (!(groupId in prev)) return prev;
        const next = { ...prev };
        delete next[groupId];
        persist({ chatReadCursors: next });
        return next;
      });
    },
    [fanOutControl, identity],
  );

  const markGroupMessageViewed = useCallback((groupId: string, messageId: string) => {
    const group = groupsRef.current.find((g) => g.id === groupId);
    const transport = transportRef.current;
    if (!group || !transport?.isConnected()) return;
    transport.sendViewAck({
      messageId,
      groupId,
      memberCount: group.memberIds.length,
      policy: group.deletePolicy,
    });
  }, []);

  const markEphemeralClosed = useCallback(
    (messageId: string) => {
      const message = messagesRef.current.find((m) => m.id === messageId);
      if (!message) return;

      const ids = new Set<string>([messageId]);
      const content = message.content;
      if ((content.kind === 'image' || content.kind === 'video') && content.mediaGroupId) {
        for (const m of messagesRef.current) {
          if (m.contactId !== message.contactId) continue;
          const c = m.content;
          if (
            (c.kind === 'image' || c.kind === 'video') &&
            c.mediaGroupId === content.mediaGroupId &&
            !c.expiredPlaceholder
          ) {
            ids.add(m.id);
          }
        }
      }

      for (const id of ids) {
        const msg = messagesRef.current.find((m) => m.id === id);
        if (!msg || msg.direction !== 'in') continue;
        const c = msg.content;
        if (c.kind !== 'image' && c.kind !== 'video') continue;
        if (!c.ephemeral || c.ephemeral.mode !== 'after_view') continue;
        if (c.expiredPlaceholder) continue;
        void deleteCachedMediaBlobs([id]);
        void deleteCachedVideoThumbs([id]);
        patchMessage(id, {
          expiredPlaceholder: true,
          previewUrl: undefined,
          ephemeral: undefined,
        });
      }
    },
    [patchMessage],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      for (const message of messagesRef.current) {
        if (message.direction !== 'in' && message.direction !== 'out') continue;
        const content = message.content;
        if (content.kind !== 'image' && content.kind !== 'video') continue;
        if (!content.ephemeral || content.ephemeral.mode !== 'timer') continue;
        if (now - message.timestamp >= content.ephemeral.ttlSec * 1000) {
          purgeMessage(message.id);
        }
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [purgeMessage]);

  const dismissNotification = useCallback((notifId: string) => {
    setNotifications((prev) => {
      const next = prev.filter((n) => n.id !== notifId);
      persist({ notifications: next });
      return next;
    });
  }, []);

  const markNotificationsRead = useCallback(() => {
    setNotifications((prev) => {
      if (!prev.some((n) => !n.read)) return prev;
      const next = prev.map((n) => (n.read ? n : { ...n, read: true }));
      persist({ notifications: next });
      return next;
    });
  }, []);

  const sendGroupText = useCallback(
    async (groupId: string, body: string, replyTo?: MessageReplyRef) => {
      const id = identityRef.current ?? identity;
      const group = groupsRef.current.find((g) => g.id === groupId);
      if (!id || !group || !group.memberIds.includes(id.userId)) return;

      const messageId = randomId();
      const senderAlias = ownSenderDisplayName();
      const bytes = encodeGroupMessagePayload(
        { kind: 'text', body },
        { from: id.userId, senderAlias, groupId, client: clientVersionRef.current, replyTo },
      );

      pushMessage({
        id: messageId,
        contactId: groupId,
        direction: 'out',
        senderId: id.userId,
        senderAlias,
        content: { kind: 'text', body },
        replyTo,
        timestamp: Date.now(),
        pendingDelivery: false,
      });

      let delivered = false;
      if (isDesktopShell() && settingsRef.current.desktopLinked) {
        for (const memberId of group.memberIds) {
          if (memberId === id.userId) continue;
          await sendRelayViaPhone(memberId, randomId(), bytesToBase64(bytes));
        }
        delivered = true;
      } else {
        const transport = await ensureTransportReady();
        if (transport?.isConnected()) {
          for (const memberId of group.memberIds) {
            if (memberId === id.userId) continue;
            const memberMessageId = randomId();
            const wire = await encryptOutgoingMessage(memberId, bytes);
            transport.sendRaw(memberId, memberMessageId, wire);
          }
          delivered = true;
        }
      }

      if (!delivered) {
        updateMessageMeta(messageId, { pendingDelivery: true });
      }
    },
    [ensureTransportReady, identity, updateMessageMeta],
  );

  const setCallSignalHandler = useCallback(
    (handler: ((from: string, signal: CallSignal) => void) | null) => {
      callSignalHandlerRef.current = handler;
    },
    [],
  );

  const sendCallSignal = useCallback(async (contactId: string, signal: CallSignalPayload) => {
    const id = identityRef.current ?? identity;
    if (!id) return;
    const messageId = randomId();
    const payload: CallSignal = { kind: 'call', from: id.userId, ...signal };
    const bytes = encodeCallSignal(payload);

    if (isDesktopShell() && settingsRef.current.desktopLinked) {
      await sendRelayViaPhone(contactId, messageId, bytesToBase64(bytes));
      return;
    }

    let transport = transportRef.current;
    if (!transport?.isConnected()) {
      try {
        const relay = await pickRelayUrls(relayRef.current);
        relayRef.current = relay;
        connectTransport(id, relay);
        transport = transportRef.current;
        await transport?.connect();
      } catch {
        /* relay offline */
      }
    }
    if (transport?.isConnected()) {
      transport.sendPlaintext(contactId, messageId, bytes);
    }
  }, [identity]);

  const sendText = useCallback(async (contactId: string, body: string, replyTo?: MessageReplyRef) => {
    if (isGroupId(contactId)) {
      await sendGroupText(contactId, body, replyTo);
      return;
    }
    const id = identityRef.current ?? identity;
    if (!id) return;
    if (contactId === id.userId) {
      notifyToast("You can't message yourself");
      return;
    }
    if (isContactBlocked(contactId)) {
      notifyToast('Unblock this contact to send messages');
      return;
    }
    const messageId = randomId();
    if (isSavedMessagesId(contactId)) {
      pushMessage({
        id: messageId,
        contactId,
        direction: 'out',
        content: { kind: 'text', body },
        replyTo,
        timestamp: Date.now(),
      });
      return;
    }

    if (isDesktopShell() && settingsRef.current.desktopLinked) {
      const bytes = encodePayload(
        { kind: 'text', body, from: id.userId, senderAlias: ownSenderDisplayName(), replyTo },
        clientVersionRef.current,
      );
      await sendRelayViaPhone(contactId, messageId, bytesToBase64(bytes));
      pushMessage({
        id: messageId,
        contactId,
        direction: 'out',
        content: { kind: 'text', body },
        replyTo,
        timestamp: Date.now(),
      });
      return;
    }

    let transport = transportRef.current;
    if (!transport?.isConnected()) {
      try {
        const relay = await pickRelayUrls(relayRef.current);
        relayRef.current = relay;
        connectTransport(id, relay);
        transport = transportRef.current;
        await transport?.connect();
      } catch {
        /* relay offline */
      }
    }
    let delivered = false;
    if (transport?.isConnected()) {
      const payload = encodePayload(
        { kind: 'text', body, from: id.userId, senderAlias: ownSenderDisplayName(), replyTo },
        clientVersionRef.current,
      );
      const wire = await encryptOutgoingMessage(contactId, payload);
      transport.sendRaw(contactId, messageId, wire);
      delivered = true;
    }
    pushMessage({
      id: messageId,
      contactId,
      direction: 'out',
      content: { kind: 'text', body },
      replyTo,
      timestamp: Date.now(),
      ...deliveryMetaForSend(delivered),
    });
  }, [identity, sendGroupText, isContactBlocked]);

  const cancelUpload = useCallback((messageId: string) => {
    const entry = activeUploadsRef.current.get(messageId);
    if (entry) entry.aborted = true;
    else activeUploadsRef.current.set(messageId, { aborted: true });
    setMessages((prev) => {
      const next = prev.filter((m) => m.id !== messageId);
      persist({ messages: next });
      return next;
    });
  }, []);

  const sendMedia = useCallback(async (contactId: string, picked: PickedMedia) => {
    const id = identityRef.current ?? identity;
    if (!id) {
      notifyToast('Sign in to send media');
      return;
    }
    if (!isGroupId(contactId) && isContactBlocked(contactId)) {
      notifyToast('Unblock this contact to send messages');
      return;
    }

    const isFile = isFilePick(picked);
    const isVideo = isVideoPick(picked);
    const isVoice = isVoicePick(picked);
    const messageId = randomId();
    const previewUrl = quickPreviewForSend(picked, isFile, isVideo, isVoice);
    let ephemeral = picked.ephemeral ?? undefined;
    if (ephemeral && !ephemeralSendAllowed(contactId)) {
      ephemeral = undefined;
    }
    const caption = picked.caption?.trim() || undefined;
    const mediaGroup = mediaGroupWireFieldsFromPick(picked);
    const group = isGroupId(contactId) ? groupsRef.current.find((g) => g.id === contactId) : undefined;
    const senderAlias = group
      ? ownSenderAlias(contactsRef.current, id.userId)
      : ownSenderDisplayName();

    if (ephemeral?.mode === 'timer') {
      let online = transportRef.current?.isConnected() ?? false;
      if (!online) {
        try {
          const transport = await ensureTransportReady();
          online = transport?.isConnected() ?? false;
        } catch {
          online = false;
        }
      }
      if (!online) {
        notifyToast('Timer videos require an internet connection');
        return;
      }
    }

    if (!previewUrl && !isFile && !isVoice) {
      notifyToast('Could not show media');
      return;
    }

    const placeholderName =
      picked.file.name?.trim() ||
      (isFile ? 'file.bin' : isVoice ? 'voice.m4a' : isVideo ? 'video.mp4' : 'photo.jpg');

    const sentAt = Date.now();
    activeUploadsRef.current.set(messageId, { aborted: false });

    if (picked.nativePath && isCapacitor() && (isFile || isVideo)) {
      void persistOutgoingMedia({
        messageId,
        mime: picked.mime,
        nativePath: picked.nativePath,
        expectedSize: picked.nativeSize,
      }).catch(() => {
        /* full bytes cached after prepare */
      });
    }

    pushMessage({
      id: messageId,
      contactId,
      direction: 'out',
      ...(group ? { senderId: id.userId, senderAlias } : {}),
      content: isVoice
        ? {
            kind: 'voice',
            blobId: 'local',
            mime: picked.mime,
            fileName: placeholderName,
            size: picked.data?.length ?? picked.nativeSize ?? 0,
            fileKey: '',
            digest: '',
            durationMs: picked.durationMs,
            previewUrl,
            uploading: true,
            ...(ephemeral ? { ephemeral } : {}),
            ...(mediaGroup ?? {}),
            ...(caption ? { caption } : {}),
          }
        : {
            kind: isFile ? 'file' : isVideo ? 'video' : 'image',
            blobId: 'local',
            mime: picked.mime,
            fileName: placeholderName,
            size: picked.data?.length ?? picked.nativeSize ?? 0,
            fileKey: '',
            digest: '',
            previewUrl,
            uploading: true,
            ...(ephemeral ? { ephemeral } : {}),
            ...(mediaGroup ?? {}),
            ...(caption ? { caption } : {}),
          },
      timestamp: sentAt,
      deliveryStatus: 'pending',
    });

    const isAborted = () => activeUploadsRef.current.get(messageId)?.aborted === true;

    if (!isVoice) {
      void enrichOutgoingPreview(picked, isFile, isVideo).then((enriched) => {
        if (isAborted()) return;
        if (enriched && isVideoFramePreview(enriched)) {
          void persistVideoThumbPreview(messageId, enriched);
          patchMessage(messageId, { previewUrl: enriched });
        }
      });
    }

    const reportPrepareProgress = (pct: number) => {
      if (isAborted()) return;
      patchMessage(messageId, { uploadProgress: pct }, { persist: false });
    };

    try {
      const preparePayload = async () => {
        if (isVoice) {
          if (!picked.data?.length) throw new Error('Could not read voice message');
          return {
            data: picked.data,
            mime: picked.mime,
            fileName: placeholderName,
            durationMs: picked.durationMs,
          };
        }
        if (isFile) {
          return prepareFileForSend(picked, reportPrepareProgress);
        }
        if (isVideo) {
          return prepareVideoForSend(picked, reportPrepareProgress, picked.sendQuality ?? 'compressed');
        }
        return prepareImageForSend(picked, picked.sendQuality ?? 'compressed');
      };

      const ensureTransport = async () => {
        let transport = transportRef.current;
        if (transport?.isConnected()) return transport;
        try {
          const relay = await pickRelayUrls(relayRef.current);
          relayRef.current = relay;
          if (!transport) {
            connectTransport(id, relay);
            transport = transportRef.current;
          }
          await transport?.connect();
        } catch {
          /* relay offline */
        }
        return transportRef.current;
      };

      const [{ data, mime, fileName }, transport] = await Promise.all([
        preparePayload(),
        ensureTransport(),
      ]);

      if (isAborted()) {
        activeUploadsRef.current.delete(messageId);
        return;
      }

      patchMessage(messageId, { mime, fileName, size: data.length, uploadProgress: 8 }, { persist: false });

      if (!isVoice) {
        try {
          if (picked.nativePath && isCapacitor() && (isFile || isVideo)) {
            await persistOutgoingMedia({
              messageId,
              mime,
              data,
              nativePath: picked.nativePath,
              expectedSize: data.length,
            });
          } else {
            await cacheDecryptedMedia(messageId, data, mime);
          }
        } catch {
          /* still try to send */
        }
      }

      const media = mediaRef.current;
      if (!media || !transport?.isConnected()) {
        await cacheMediaBlob(messageId, data, mime);
        if (isAborted()) {
          activeUploadsRef.current.delete(messageId);
          return;
        }
        patchMessage(messageId, { uploading: false });
        updateMessageMeta(messageId, { pendingDelivery: true });
        notifyToast('No connection — will send when online');
        activeUploadsRef.current.delete(messageId);
        return;
      }

      let lastProgress = -1;
      const setProgress = (pct: number) => {
        const rounded = Math.min(99, Math.max(0, Math.round(pct)));
        if (rounded === lastProgress) return;
        lastProgress = rounded;
        patchMessage(messageId, { uploadProgress: rounded }, { persist: false });
      };

      setProgress(12);

      const blobId = WebMedia.blobId();
      const sendParams = {
        messageId,
        blobId,
        data,
        mime,
        fileName,
        sentAt,
        ...(isVoice && picked.durationMs != null ? { durationMs: picked.durationMs } : {}),
        ...(group ? { groupId: contactId } : {}),
        ...(senderAlias ? { senderAlias } : {}),
        ...(ephemeral ? { ephemeral } : {}),
        ...(mediaGroup ?? {}),
        ...(caption ? { caption } : {}),
        onPhase: (phase: 'encrypt' | 'upload', percent: number) => {
          if (phase === 'encrypt') {
            setProgress(5 + (percent / 100) * 25);
            return;
          }
          setProgress(30 + (percent / 100) * 65);
        },
      };

      let meta;
      if (group) {
        let first = true;
        for (const memberId of group.memberIds) {
          if (memberId === id.userId) continue;
          meta = await media.send({
            recipientId: memberId,
            ...sendParams,
            messageId: first ? messageId : randomId(),
          });
          first = false;
        }
        if (!meta) throw new Error('No group members to send to');
      } else {
        meta = await media.send({
          recipientId: contactId,
          ...sendParams,
        });
      }
      setProgress(98);

      patchMessage(messageId, {
        kind: meta.kind,
        blobId: meta.blobId,
        mime: meta.mime,
        fileName: meta.fileName,
        size: meta.size,
        fileKey: meta.fileKey,
        digest: meta.digest,
        ...(meta.durationMs != null ? { durationMs: meta.durationMs } : {}),
        ...(ephemeral ? { ephemeral } : {}),
        ...(mediaGroup ?? {}),
        ...(caption ? { caption } : {}),
        uploading: false,
        uploadProgress: undefined,
      });
      updateMessageMeta(messageId, { pendingDelivery: false });
      activeUploadsRef.current.delete(messageId);

      if (isVideo) {
        void (async () => {
          let thumb = await createVideoBubbleThumbUrl(data, mime, fileName);
          if (!thumb || !isVideoFramePreview(thumb)) {
            const native = await readCachedNativeRef(messageId);
            if (native?.uri && isIosCapacitor()) {
              const { Capacitor } = await import('@capacitor/core');
              thumb = await createVideoBubbleThumbFromUrl(
                Capacitor.convertFileSrc(native.uri),
                fileName,
              );
            }
          }
          if (thumb && isVideoFramePreview(thumb) && !isAborted()) {
            void persistVideoThumbPreview(messageId, thumb);
            patchMessage(messageId, { previewUrl: thumb });
          }
        })();
      } else if (!isFile && !isVoice) {
        patchMessage(messageId, { previewUrl: createFullImageBlobUrl(data, mime) });
      } else if (isFile) {
        void enrichOutgoingPreview({ ...picked, data }, true, false).then((preview) => {
          if (preview && !isAborted()) patchMessage(messageId, { previewUrl: preview });
        });
      }
    } catch (e) {
      if (isAborted()) {
        activeUploadsRef.current.delete(messageId);
        return;
      }
      activeUploadsRef.current.delete(messageId);

      const cached = await readCachedMediaBytes(messageId).catch(() => null);
      if (cached?.data.length) {
        patchMessage(messageId, { uploading: false, uploadProgress: undefined });
        updateMessageMeta(messageId, { pendingDelivery: true });
        const msg = e instanceof Error ? e.message : 'Failed to send media';
        if (/413/.test(msg)) {
          notifyToast('Upload failed: file too large (server limit)');
        } else {
          notifyToast('Will retry send when connection is stable');
        }
        return;
      }

      void deleteCachedMediaBlobs([messageId]);
      void deleteCachedVideoThumbs([messageId]);
      purgeMessage(messageId);
      const msg = e instanceof Error ? e.message : 'Failed to send media';
      if (/413/.test(msg)) {
        notifyToast('Upload failed: file too large (server limit)');
      } else {
        notifyToast(msg.length > 140 ? msg.slice(0, 140) + '…' : msg);
      }
    }
  }, [identity, isContactBlocked, purgeMessage, updateMessageMeta, ensureTransportReady]);

  const deliverPendingText = useCallback(
    async (msg: ChatMessage) => {
      if (msg.content.kind !== 'text') return;
      const id = identityRef.current ?? identity;
      if (!id) return;
      const transport = transportRef.current;
      if (!transport?.isConnected()) return;

      if (isGroupId(msg.contactId)) {
        const group = groupsRef.current.find((g) => g.id === msg.contactId);
        if (!group) return;
        const bytes = encodeGroupMessagePayload(
          { kind: 'text', body: msg.content.body },
          {
            from: id.userId,
            senderAlias: msg.senderAlias ?? ownSenderAlias(contactsRef.current, id.userId),
            groupId: msg.contactId,
            client: clientVersionRef.current,
            replyTo: msg.replyTo,
          },
        );
        for (const memberId of group.memberIds) {
          if (memberId === id.userId) continue;
          const wire = await encryptOutgoingMessage(memberId, bytes);
          transport.sendRaw(memberId, randomId(), wire);
        }
      } else {
        const payload = encodePayload(
          { kind: 'text', body: msg.content.body, from: id.userId, replyTo: msg.replyTo },
          clientVersionRef.current,
        );
        const wire = await encryptOutgoingMessage(msg.contactId, payload);
        transport.sendRaw(msg.contactId, msg.id, wire);
      }
      updateMessageMeta(msg.id, { pendingDelivery: false });
    },
    [identity, updateMessageMeta],
  );

  const deliverPendingMedia = useCallback(
    async (msg: ChatMessage) => {
      const id = identityRef.current ?? identity;
      if (!id) return;
      const content = msg.content;
      if (
        content.kind !== 'image' &&
        content.kind !== 'video' &&
        content.kind !== 'file' &&
        content.kind !== 'voice'
      ) {
        return;
      }
      if (content.uploading) return;

      const cached = await readCachedMediaBytes(msg.id);
      if (!cached?.data.length) return;

      const transport = await ensureTransportReady();
      if (!transport?.isConnected()) return;

      const media = mediaRef.current;
      if (!media) return;

      const group = isGroupId(msg.contactId)
        ? groupsRef.current.find((g) => g.id === msg.contactId)
        : undefined;
      const senderAlias = group ? ownSenderAlias(contactsRef.current, id.userId) : undefined;

      patchMessage(msg.id, { uploading: true, uploadProgress: 12 }, { persist: false });

      try {
        const data = cached.data;
        const mime = cached.mime || content.mime;
        const fileName = content.fileName;
        const blobId = WebMedia.blobId();
        const ephemeral = 'ephemeral' in content ? content.ephemeral : undefined;
        const mediaGroup = mediaGroupWireFields(content);
        const sendParams = {
          messageId: msg.id,
          blobId,
          data,
          mime,
          fileName,
          sentAt: msg.timestamp,
          ...(content.kind === 'voice' && content.durationMs != null
            ? { durationMs: content.durationMs }
            : {}),
          ...(group ? { groupId: msg.contactId, senderAlias } : {}),
          ...(ephemeral ? { ephemeral } : {}),
          ...(mediaGroup ?? {}),
        };

        let meta;
        if (group) {
          let first = true;
          for (const memberId of group.memberIds) {
            if (memberId === id.userId) continue;
            meta = await media.send({
              recipientId: memberId,
              ...sendParams,
              messageId: first ? msg.id : randomId(),
            });
            first = false;
          }
          if (!meta) throw new Error('Send failed');
        } else {
          meta = await media.send({
            recipientId: msg.contactId,
            ...sendParams,
          });
        }

        patchMessage(msg.id, {
          kind: meta.kind,
          blobId: meta.blobId,
          mime: meta.mime,
          fileName: meta.fileName,
          size: meta.size,
          fileKey: meta.fileKey,
          digest: meta.digest,
          ...(meta.durationMs != null ? { durationMs: meta.durationMs } : {}),
          ...(ephemeral ? { ephemeral } : {}),
          ...(mediaGroup ?? {}),
          uploading: false,
          uploadProgress: undefined,
        });
        updateMessageMeta(msg.id, { pendingDelivery: false });
      } catch {
        patchMessage(msg.id, { uploading: false, uploadProgress: undefined });
      }
    },
    [ensureTransportReady, identity, updateMessageMeta],
  );

  const flushingOutboxRef = useRef(false);
  const flushPendingOutbox = useCallback(async () => {
    if (flushingOutboxRef.current) return;
    const transport = await ensureTransportReady();
    if (!transport?.isConnected()) return;

    const pending = messagesRef.current.filter((m) => m.direction === 'out' && m.pendingDelivery);
    if (!pending.length) return;

    flushingOutboxRef.current = true;
    try {
      for (const msg of pending) {
        if (msg.content.kind === 'text') {
          await deliverPendingText(msg);
        } else {
          await deliverPendingMedia(msg);
        }
      }
    } finally {
      flushingOutboxRef.current = false;
    }
  }, [deliverPendingMedia, deliverPendingText, ensureTransportReady]);

  useEffect(() => {
    if (!connected) return;
    void flushPendingOutbox();
    void mergeVaultExportBlocks();
  }, [connected, flushPendingOutbox, mergeVaultExportBlocks]);

  const toggleNotifications = useCallback(() => {
    const next = !settings.notificationsEnabled;
    if (next && 'Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
    updateSettings({ notificationsEnabled: next });
  }, [settings.notificationsEnabled]);

  const setAppearance = useCallback((_mode: 'dark' | 'light') => {
    updateSettings({ appearance: 'dark' });
    applyAppearance('dark');
  }, []);

  const buildEncryptedBackup = useCallback(
    async (password: string) => {
      const id = identityRef.current ?? identity;
      if (!id?.mnemonic) throw new Error('Sign in to create a backup');

      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      const payload = await buildBackupPayload({
        mnemonic: id.mnemonic,
        userId: id.userId,
        contacts,
        messages,
        groups,
        groupInvites,
        settings,
        httpBaseUrl: relayRef.current.http || defaultRelayHttpUrl(),
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const file = encryptBackupPayload(password, payload, id.userId);
      return { file, exportExcludedChats: payload.exportExcludedChats ?? [] };
    },
    [identity, contacts, messages, groups, groupInvites, settings],
  );

  const checkForUpdates = useCallback(() => checkForAppUpdate(), []);

  const dismissUpgradeRequired = useCallback(() => {
    setUpgradeRequiredMessage(null);
  }, []);

  const prepareBackup = useCallback(
    async (password: string) => {
      if (!isNativeMobile()) {
        throw new Error('Prepare step is only for the mobile app');
      }
      const id = identityRef.current ?? identity;
      if (!id?.mnemonic) throw new Error('Sign in to create a backup');

      if (isIosCapacitor()) {
        return buildAndPrepareMobileZipBackup({
          password,
          mnemonic: id.mnemonic,
          userId: id.userId,
          contacts,
          messages,
          groups,
          groupInvites,
          settings,
          httpBaseUrl: relayRef.current.http || defaultRelayHttpUrl(),
        });
      }

      const file = await buildEncryptedBackup(password);
      return prepareBackupShare(file.file).then((prepared) => ({
        ...prepared,
        exportExcludedChats: file.exportExcludedChats,
      }));
    },
    [buildEncryptedBackup, identity, contacts, messages, groups, groupInvites, settings],
  );

  const saveBackupDesktop = useCallback(
    async (password: string) => {
      const built = await buildEncryptedBackup(password);
      const saveResult = await saveBackupFile(built.file);
      updateSettings({ lastBackupAt: Date.now() });
      return { ...saveResult, exportExcludedChats: built.exportExcludedChats };
    },
    [buildEncryptedBackup],
  );

  const shareBackup = useCallback(async (prepared: PreparedBackupShare) => {
    if (!isNativeMobile()) {
      await sharePreparedBackup(prepared);
    }
    updateSettings({ lastBackupAt: Date.now() });
  }, []);

  const restoreBackup = useCallback(async (password: string, input: string | PickedBackup) => {
    const picked: PickedBackup = typeof input === 'string' ? { content: input } : input;
    const file = parseBackupFile(picked.content);
    const payload = decryptBackupPayload(password, file);
    const id = identityFromMnemonic(payload.mnemonic);
    if (id.userId !== file.userId) {
      throw new Error('Backup file does not match account data');
    }

    transportRef.current?.disconnect();

    const restoredMessages = messagesForRestore(payload.messages);
    const { encryptionMode: _legacyEncryption, ...restSettings } = (payload.settings ?? {}) as Partial<
      AppSettings
    > & { encryptionMode?: string };
    const mergedSettings = { ...DEFAULT_SETTINGS, ...restSettings };

    storeIdentity(id);
    setIdentity(id);
    setContacts(payload.contacts);
    setMessages(restoredMessages);
    setSettings(mergedSettings);
    if (payload.groups?.length) setGroups(payload.groups);
    if (payload.groupInvites?.length) setGroupInvites(payload.groupInvites);

    persist({
      identity: { mnemonic: payload.mnemonic },
      contacts: payload.contacts,
      messages: restoredMessages,
      settings: mergedSettings,
      onboardingDone: true,
      ...(payload.groups?.length ? { groups: payload.groups } : {}),
      ...(payload.groupInvites?.length ? { groupInvites: payload.groupInvites } : {}),
    });

    await importBackupMediaToCache(payload.media ?? [], picked);
    await disablePinStateEncryption();
    clearAppLock();
    setAppLockEnabled(false);
    setAppUnlocked(true);
    await connectWithBestRelay(id);
  }, []);

  const toggleBackupNotifications = useCallback(() => {
    updateSettings({ backupNotificationsEnabled: !settings.backupNotificationsEnabled });
  }, [settings.backupNotificationsEnabled]);

  const linkDesktop = useCallback(() => {
    updateSettings({ desktopLinked: true, phoneOnline: true });
  }, []);

  const pairDesktopFromPhone = useCallback(async (offer: DesktopLinkOffer) => {
    const id = identityRef.current ?? identity;
    if (!id?.mnemonic) throw new Error('Sign in on your phone first');
    await pairPhoneWithDesktop(offer, {
      mnemonic: id.mnemonic,
      contacts,
      messages,
      settings,
    });
    updateSettings({
      desktopLinked: true,
      phoneOnline: true,
      desktopLinkHost: offer.host,
      desktopLinkPort: offer.port,
      desktopLinkToken: offer.token,
    });
    setDesktopBleConnected(true);
  }, [contacts, identity, messages, settings]);

  const setPhoneOnline = useCallback((online: boolean) => {
    updateSettings({ phoneOnline: online });
    setDesktopBleConnected(online);
  }, []);

  const setPreferredDevice = useCallback((device: 'phone' | 'computer') => {
    updateSettings({ preferredDevice: device, deviceChosen: true });
  }, []);

  useEffect(() => {
    if (!isCapacitor() || !settings.desktopLinked) {
      onDesktopLinkMessage(null);
      return;
    }
    onDesktopLinkMessage((frame) => {
      if (frame.type === 'phone_online') {
        setPhoneOnline(frame.online);
        return;
      }
      if (frame.type !== 'send_relay') return;
      void (async () => {
        const id = identityRef.current;
        if (!id) return;
        let transport = transportRef.current;
        if (!transport?.isConnected()) {
          try {
            await connectWithBestRelay(id);
            transport = transportRef.current;
          } catch {
            return;
          }
        }
        if (!transport?.isConnected()) return;
        const payload = base64ToBytes(frame.payload);
        const wire = await encryptOutgoingMessage(frame.recipientId, payload);
        transport.sendRaw(frame.recipientId, frame.messageId, wire);
      })();
    });
    return () => onDesktopLinkMessage(null);
  }, [settings.desktopLinked]);

  useEffect(() => {
    if (!isCapacitor() || !settings.desktopLinked) return;
    const host = settings.desktopLinkHost;
    const token = settings.desktopLinkToken;
    const port = settings.desktopLinkPort ?? DESKTOP_LINK_DEFAULT_PORT;
    if (!host || !token) return;

    const offer: DesktopLinkOffer = {
      version: 1,
      token,
      host,
      port,
      serviceUuid: DESKTOP_LINK_SERVICE_UUID,
      expiresAt: 0,
    };
    setPhoneLinkEndpoint(offer);
    void reconnectPhoneToDesktop(offer)
      .then(() => {
        setPhoneOnline(true);
        setDesktopBleConnected(true);
      })
      .catch(() => {
        setPhoneOnline(false);
        setDesktopBleConnected(false);
      });
  }, [
    settings.desktopLinked,
    settings.desktopLinkHost,
    settings.desktopLinkPort,
    settings.desktopLinkToken,
    setPhoneOnline,
  ]);

  useEffect(() => {
    if (!isCapacitor() || !settings.desktopLinked) return;
    let removeListener: (() => void) | undefined;
    void import('@capacitor/app').then(({ App }) =>
      App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          void notifyPhoneLinkOffline();
          setPhoneOnline(false);
          return;
        }
        const host = settingsRef.current.desktopLinkHost;
        const token = settingsRef.current.desktopLinkToken;
        const port = settingsRef.current.desktopLinkPort ?? DESKTOP_LINK_DEFAULT_PORT;
        if (!host || !token) return;
        const offer: DesktopLinkOffer = {
          version: 1,
          token,
          host,
          port,
          serviceUuid: DESKTOP_LINK_SERVICE_UUID,
          expiresAt: 0,
        };
        void reconnectPhoneToDesktop(offer)
          .then(() => {
            setPhoneOnline(true);
            setDesktopBleConnected(true);
          })
          .catch(() => {
            setPhoneOnline(false);
            setDesktopBleConnected(false);
          });
      }).then((handle) => {
        removeListener = () => void handle.remove();
      }),
    );
    return () => removeListener?.();
  }, [settings.desktopLinked, setPhoneOnline]);

  useEffect(() => {
    if (!isDesktopShell() || !settings.desktopLinked) return;
    setPhoneOnline(false);
    const token = loadDesktopLinkToken() ?? settings.desktopLinkToken;
    if (!token) return;
    const offer: DesktopLinkOffer = {
      version: 1,
      token,
      host: '0.0.0.0',
      port: settings.desktopLinkPort ?? DESKTOP_LINK_DEFAULT_PORT,
      serviceUuid: DESKTOP_LINK_SERVICE_UUID,
      expiresAt: 0,
    };
    void startDesktopLinkSession(offer).catch(() => {});
  }, [settings.desktopLinked, settings.desktopLinkPort, settings.desktopLinkToken]);

  useEffect(() => {
    if (!isDesktopShell()) return;
    return bindDesktopLinkHandlers({
      onPaired: (bundle, token) => {
        const id = identityFromMnemonic(bundle.mnemonic);
        storeIdentity(id);
        saveDesktopLinkToken(token);
        const nextContacts = bundle.contacts as Contact[];
        const nextMessages = bundle.messages as ChatMessage[];
        setContacts(nextContacts);
        setMessages(nextMessages);
        updateSettings({
          ...(bundle.settings as Partial<AppSettings>),
          desktopLinked: true,
          phoneOnline: true,
          desktopLinkToken: token,
        });
        persist({
          identity: { mnemonic: bundle.mnemonic },
          contacts: nextContacts,
          messages: nextMessages,
          onboardingDone: true,
          settings: {
            ...settingsRef.current,
            desktopLinked: true,
            phoneOnline: true,
            desktopLinkToken: token,
          },
        });
        setPhoneOnline(true);
        setDesktopBleConnected(true);
        void startDesktopLinkSession({
          version: 1,
          token,
          host: '0.0.0.0',
          port: settingsRef.current.desktopLinkPort ?? DESKTOP_LINK_DEFAULT_PORT,
          serviceUuid: DESKTOP_LINK_SERVICE_UUID,
          expiresAt: 0,
        })
          .then((started) => {
            updateSettings({
              desktopLinkHost: started.host,
              desktopLinkPort: started.port,
              desktopLinkToken: token,
            });
          })
          .catch(() => {});
      },
      onMessage: (frame) => {
        if (frame.type === 'sync_message') {
          pushMessage(frame.message as ChatMessage);
        }
        if (frame.type === 'sync_contacts') {
          const nextContacts = frame.contacts as Contact[];
          setContacts(nextContacts);
          persist({ contacts: nextContacts });
        }
        if (frame.type === 'phone_online') {
          setPhoneOnline(frame.online);
        }
      },
      onPhoneOnline: (online) => {
        const wasOnline = desktopBleConnectedRef.current;
        setPhoneOnline(online);
        setDesktopBleConnected(online);
        if (!online && wasOnline) {
          notifyMessage('Phone disconnected', 'Reconnect your phone to resume messaging.');
        }
      },
    });
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      identity,
      contacts,
      messages,
      connected,
      connecting,
      connectionPingMs,
      connectionSnapshot,
      setConnectionStatusLive,
      uploadSpeedKbps,
      settings,
      createAccount,
      recoverAccount,
      finishOnboarding,
      addContact,
      renameContact,
      setContactAvatar,
      deleteMessage,
      skipContactNaming,
      deleteChat,
      clearChatMessages,
      setContactNote,
      blockContact,
      unblockContact,
      setContactExportBlocked,
      verifyContact,
      sendText,
      sendCallSignal,
      setCallSignalHandler,
      sendMedia,
      cancelUpload,
      getContact: (id) => contacts.find((c) => c.userId === id),
      getThread,
      copyToClipboard: (t) => navigator.clipboard.writeText(t),
      logout: () => {
        transportRef.current?.disconnect();
        void disconnectPhoneBle();
        void stopDesktopLinkAdvertising({ force: true });
        clearDesktopLinkToken();
        void clearAllMediaCache();
        void pruneNonEssentialAppFolderFiles();
        void clearAllStateStorage();
        window.location.href = '/';
      },
      toggleNotifications,
      setAppearance,
      checkForUpdates,
      upgradeRequiredMessage,
      dismissUpgradeRequired,
      prepareBackup,
      saveBackupDesktop,
      shareBackup,
      restoreBackup,
      toggleBackupNotifications,
      linkDesktop,
      pairDesktopFromPhone,
      desktopBleConnected,
      setPhoneOnline,
      setPreferredDevice,
      importContactFromUrl,
      setActiveChatContact,
      groups,
      groupInvites,
      notifications,
      unreadNotificationCount: notifications.filter((n) => !n.read).length,
      getGroup,
      createGroup,
      inviteToGroup,
      acceptGroupInvite,
      declineGroupInvite,
      kickFromGroup,
      transferGroupAdmin,
      updateGroupDeletePolicy,
      leaveGroup,
      deleteGroup,
      markNotificationsRead,
      sendGroupText,
      markGroupMessageViewed,
      markEphemeralClosed,
      dismissNotification,
      chatReadCursors,
      flashMediaGroupId,
      signalMediaGroupSent,
      appLockEnabled,
      appUnlocked,
      unlockApp,
      enableAppLock,
      changeAppLockPassword,
      disableAppLock,
      lockApp,
      resetAppLockViaBackupRecovery,
    }),
    [
      identity,
      contacts,
      groups,
      groupInvites,
      notifications,
      messages,
      connected,
      connecting,
      connectionPingMs,
      connectionSnapshot,
      setConnectionStatusLive,
      uploadSpeedKbps,
      settings,
      createAccount,
      recoverAccount,
      finishOnboarding,
      addContact,
      renameContact,
      setContactAvatar,
      deleteMessage,
      skipContactNaming,
      deleteChat,
      clearChatMessages,
      setContactNote,
      blockContact,
      unblockContact,
      setContactExportBlocked,
      verifyContact,
      sendText,
      sendCallSignal,
      setCallSignalHandler,
      sendMedia,
      cancelUpload,
      getThread,
      getGroup,
      createGroup,
      inviteToGroup,
      acceptGroupInvite,
      declineGroupInvite,
      kickFromGroup,
      transferGroupAdmin,
      updateGroupDeletePolicy,
      leaveGroup,
      deleteGroup,
      markNotificationsRead,
      sendGroupText,
      markGroupMessageViewed,
      markEphemeralClosed,
      dismissNotification,
      chatReadCursors,
      flashMediaGroupId,
      signalMediaGroupSent,
      toggleNotifications,
      setAppearance,
      checkForUpdates,
      upgradeRequiredMessage,
      dismissUpgradeRequired,
      prepareBackup,
      saveBackupDesktop,
      shareBackup,
      restoreBackup,
      toggleBackupNotifications,
      linkDesktop,
      pairDesktopFromPhone,
      desktopBleConnected,
      setPhoneOnline,
      setPreferredDevice,
      importContactFromUrl,
      setActiveChatContact,
      appLockEnabled,
      appUnlocked,
      unlockApp,
      enableAppLock,
      changeAppLockPassword,
      disableAppLock,
      lockApp,
      resetAppLockViaBackupRecovery,
    ],
  );

  void formatFingerprint;
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp outside provider');
  return ctx;
}

export function useChatPreviews() {
  const { contacts, groups, getThread, chatReadCursors, notifications } = useApp();

  const unreadForChat = (contactId: string, thread: ChatMessage[]) => {
    const readAt = chatReadCursors[contactId] ?? 0;
    const messageUnread = thread.filter((m) => m.direction === 'in' && m.timestamp > readAt).length;
    const inviteUnread = notifications.filter(
      (n) => !n.read && n.kind === 'group_invite' && n.groupId === contactId,
    ).length;
    return Math.min(messageUnread + inviteUnread, 9);
  };

  const contactPreviews = contacts.map((c) => {
    const thread = getThread(c.userId);
    const last = thread[thread.length - 1];
    return {
      contact: c,
      lastMessage: last ? previewText(last.content) : 'No messages yet',
      preview: buildMessageListPreview(last),
      timestamp: last?.timestamp ?? 0,
      unread: unreadForChat(c.userId, thread),
      isGroup: false,
    };
  });

  const groupPreviews = groups.map((g) => {
    const thread = getThread(g.id);
    const last = thread[thread.length - 1];
    return {
      contact: {
        userId: g.id,
        fingerprint: '',
        alias: g.name,
        verified: false,
        avatar: g.avatar,
      },
      lastMessage: last ? previewText(last.content) : 'No messages yet',
      preview: buildMessageListPreview(last),
      timestamp: last?.timestamp ?? g.createdAt,
      unread: unreadForChat(g.id, thread),
      isGroup: true,
    };
  });

  const sorted = [...contactPreviews, ...groupPreviews].sort((a, b) => b.timestamp - a.timestamp);
  const savedIndex = sorted.findIndex((p) => !p.isGroup && isSavedMessagesContact(p.contact));
  if (savedIndex > 0) {
    const [saved] = sorted.splice(savedIndex, 1);
    sorted.unshift(saved);
  }
  return sorted;
}
