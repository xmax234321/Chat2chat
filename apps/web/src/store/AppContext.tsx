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
  MessageContent,
  AppSettings,
} from '../lib/types';
import {
  loadState,
  saveState,
  previewText,
  DEFAULT_SETTINGS,
  initials,
  UNKNOWN_CONTACT_ALIAS,
  isGroupId,
  generateGroupId,
  DEFAULT_GROUP_DELETE_POLICY,
  normalizeGroup,
} from '../lib/types';
import {
  unlockStateStorage,
  unlockStateStorageWithBiometricKey,
  lockStateStorage,
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
import { createFullImageBlobUrl, createMediaPreviewUrl, createVideoBubbleThumbUrl } from '../lib/media-thumbnail';
import { enrichOutgoingPreview, quickPreviewForSend } from '../lib/quick-media-preview';
import { cacheDecryptedMedia, cacheMediaBlob, deleteCachedMediaBlobs, migrateMediaCacheToNativeFs } from '../lib/media-cache';
import type { PickedMedia } from '../lib/pick-media';
import { isVideoPick, isFilePick, isVoicePick, prepareImageForSend } from '../lib/prepare-media-for-send';
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
  validateAppLockPassword,
  verifyAppLockPassword,
  type AppLockPinLength,
} from '../lib/app-lock';
import { loadAppLockPreferences } from '../lib/app-lock-settings';
import type { DesktopLinkOffer } from '../lib/desktop-link/protocol';
import { pairPhoneWithDesktop, onDesktopLinkMessage, sendMessageToDesktop, disconnectPhoneBle, reconnectPhoneToDesktop, setPhoneLinkEndpoint } from '../lib/desktop-link/phone';
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
  decryptIncomingMessage,
  encryptOutgoingMessage,
} from '../lib/message-crypto';

interface SavedIdentity {
  mnemonic: string;
}

interface AppContextValue {
  identity: Identity | null;
  contacts: Contact[];
  messages: ChatMessage[];
  connected: boolean;
  connecting: boolean;
  connectionPingMs: number | null;
  uploadSpeedKbps: number | null;
  settings: AppSettings;
  createAccount: () => Identity;
  recoverAccount: (mnemonic: string) => Identity;
  finishOnboarding: () => void;
  addContact: (userId: string, alias: string) => boolean;
  renameContact: (userId: string, alias: string) => void;
  deleteChat: (contactId: string) => void;
  verifyContact: (userId: string) => void;
  sendText: (contactId: string, body: string) => Promise<void>;
  sendCallSignal: (contactId: string, signal: CallSignalPayload) => Promise<void>;
  setCallSignalHandler: (handler: ((from: string, signal: CallSignal) => void) | null) => void;
  sendMedia: (contactId: string, picked: PickedMedia) => Promise<void>;
  cancelUpload: (messageId: string) => void;
  getContact: (id: string) => Contact | undefined;
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
  sendGroupText: (groupId: string, body: string) => Promise<void>;
  markGroupMessageViewed: (groupId: string, messageId: string) => void;
  dismissNotification: (id: string) => void;
  chatReadCursors: Record<string, number>;
  appLockEnabled: boolean;
  appUnlocked: boolean;
  unlockApp: (password: string, viaBiometric?: boolean) => Promise<boolean>;
  enableAppLock: (password: string, pinLength?: AppLockPinLength) => Promise<void>;
  changeAppLockPassword: (current: string, next: string, pinLength?: AppLockPinLength) => Promise<void>;
  disableAppLock: (password: string) => Promise<boolean>;
  lockApp: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function randomId(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function encodePayload(
  content: MessageContent & { from?: string; senderAlias?: string; groupId?: string },
  client?: ClientVersionInfo | null,
): Uint8Array {
  if (content.groupId && content.from && content.senderAlias) {
    return encodeGroupMessagePayload(content, {
      from: content.from,
      senderAlias: content.senderAlias,
      groupId: content.groupId,
      client,
    });
  }
  const clientFields = client
    ? { appVersion: client.version, appBuild: client.build }
    : {};
  if (content.kind === 'text') {
    return new TextEncoder().encode(
      JSON.stringify({ kind: 'text', body: content.body, from: content.from, ...clientFields }),
    );
  }
  return new TextEncoder().encode(JSON.stringify({ ...content, from: content.from, ...clientFields }));
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
  if (!contact.isUnknown || contact.alias !== UNKNOWN_CONTACT_ALIAS) return contact.alias;
  return UNKNOWN_CONTACT_ALIAS;
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

export function AppProvider({ children }: { children: ReactNode }) {
  const saved = loadState();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [contacts, setContacts] = useState<Contact[]>(saved.contacts ?? []);
  const [groups, setGroups] = useState<Group[]>(() => (saved.groups ?? []).map(normalizeGroup));
  const [groupInvites, setGroupInvites] = useState<GroupInvite[]>(saved.groupInvites ?? []);
  const [notifications, setNotifications] = useState<AppNotification[]>(saved.notifications ?? []);
  const [chatReadCursors, setChatReadCursors] = useState<Record<string, number>>(
    () => saved.chatReadCursors ?? {},
  );
  const [messages, setMessages] = useState<ChatMessage[]>(saved.messages ?? []);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionPingMs, setConnectionPingMs] = useState<number | null>(null);
  const [uploadSpeedKbps, setUploadSpeedKbps] = useState<number | null>(null);
  const [desktopBleConnected, setDesktopBleConnected] = useState(false);
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
  const callSignalHandlerRef = useRef<((from: string, signal: CallSignal) => void) | null>(null);
  const clientVersionRef = useRef<ClientVersionInfo | null>(null);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    chatReadCursorsRef.current = chatReadCursors;
  }, [chatReadCursors]);

  const markChatRead = useCallback((contactId: string) => {
    const thread = messagesRef.current.filter((m) => m.contactId === contactId);
    const latest = thread.reduce((max, m) => Math.max(max, m.timestamp), 0);
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
  }, []);

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

  const patchMessage = (
    id: string,
    content: Partial<Extract<MessageContent, { kind: 'image' | 'video' | 'file' | 'voice' }>>,
    options?: { persist?: boolean },
  ) => {
    setMessages((prev) => {
      const next = prev.map((m) => {
        if (m.id !== id || m.content.kind === 'text') return m;
        return { ...m, content: { ...m.content, ...content } };
      });
      if (options?.persist !== false) persist({ messages: next });
      return next;
    });
  };

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
    try {
      const relay = await pickRelayUrls(relayRef.current);
      relayRef.current = relay;
      connectTransport(id, relay);
      transport = transportRef.current;
      await transport?.connect();
    } catch {
      /* relay offline */
    }
    return transport;
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
          setGroupInvites((prev) => {
            if (prev.some((x) => x.id === inv.id)) return prev;
            const next = [...prev, inv];
            persist({ groupInvites: next });
            return next;
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
    [pushNotification],
  );

  const relayRef = useRef(preferredRelayEndpoints());

  const connectTransport = (id: Identity, relay = relayRef.current) => {
    identityRef.current = id;
    transportRef.current?.disconnect();
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
        pushMessage({
          id: env.messageId,
          contactId: senderId,
          direction: 'in',
          content: parsed.kind === 'text' ? { kind: 'text', body: parsed.body } : parsed,
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
      },
      onAttachment: async (env, bucket) => {
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
          const contactId = groupId && isGroupId(groupId) ? groupId : senderId;
          const selfId = identityRef.current?.userId ?? '';
          const direction = senderId === selfId ? 'out' : 'in';

          let previewUrl: string | undefined;
          if (received.content.kind === 'image') {
            previewUrl = createFullImageBlobUrl(received.data, displayMime);
          } else if (isVideo || isVoice) {
            previewUrl = URL.createObjectURL(
              new Blob([received.data.slice()], { type: displayMime }),
            );
          }

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
              previewUrl: previewUrl ?? undefined,
            },
            timestamp: Date.now(),
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
              const thumb = await createVideoBubbleThumbUrl(
                received.data,
                displayMime,
                received.content.fileName,
              );
              if (thumb) {
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
    const lock = () => setAppUnlocked(false);

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
      const unlocked = await unlockStateStorageWithBiometricKey();
      if (!unlocked) return false;
      hydrateFromStorage();
      setAppUnlocked(true);
      return true;
    }
    const ok = verifyAppLockPassword(password);
    if (!ok) return false;
    const unlocked = await unlockStateStorage(password);
    if (!unlocked) return false;
    hydrateFromStorage();
    setAppUnlocked(true);
    return true;
  }, [appLockEnabled, hydrateFromStorage]);

  const enableAppLock = useCallback(async (password: string, pinLength: AppLockPinLength = 4) => {
    const err = validateAppLockPassword(password, pinLength);
    if (err) throw new Error(err);
    saveAppLockPassword(password, pinLength);
    const stored = loadStoredAppLock();
    if (stored) await enablePinStateEncryption(password, stored.salt);
    if (loadAppLockPreferences().faceIdEnabled) {
      await storeBiometricUnlockKey();
    }
    setAppLockEnabled(true);
    setAppUnlocked(true);
  }, []);

  const changeAppLockPassword = useCallback(async (current: string, next: string, pinLength?: AppLockPinLength) => {
    if (!verifyAppLockPassword(current)) throw new Error('Wrong PIN');
    const length = pinLength ?? next.length;
    const err = validateAppLockPassword(next, length as AppLockPinLength);
    if (err) throw new Error(err);
    saveAppLockPassword(next, length as AppLockPinLength);
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
    const contact = buildContact(userId, alias.trim() || 'New contact', false);
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
    setContacts((prev) => {
      const next = prev.map((c) =>
        c.userId === userId
          ? { ...c, alias: trimmed, isUnknown: false, avatar: initials(trimmed) }
          : c,
      );
      persist({ contacts: next });
      return next;
    });
  }, []);

  const finishOnboarding = useCallback(() => {
    persist({ onboardingDone: true });
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
    if (removedIds.length) void deleteCachedMediaBlobs(removedIds);
    if (activeChatContactIdRef.current === contactId) {
      activeChatContactIdRef.current = null;
    }
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

      const senderAlias = ownSenderAlias(contactsRef.current, id.userId);
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
    },
    [fanOutControl, identity],
  );

  const acceptGroupInvite = useCallback(
    async (inviteId: string) => {
      const id = identityRef.current ?? identity;
      if (!id) return;
      const invite = groupInvites.find((inv) => inv.id === inviteId);
      if (!invite || invite.status !== 'pending') return;

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
    [fanOutControl, groupInvites, identity],
  );

  const declineGroupInvite = useCallback(
    async (inviteId: string) => {
      const id = identityRef.current ?? identity;
      if (!id) return;
      const invite = groupInvites.find((inv) => inv.id === inviteId);
      if (!invite) return;
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
    [fanOutControl, groupInvites, identity],
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
    async (groupId: string, body: string) => {
      const id = identityRef.current ?? identity;
      const group = groupsRef.current.find((g) => g.id === groupId);
      if (!id || !group || !group.memberIds.includes(id.userId)) return;

      const messageId = randomId();
      const senderAlias = ownSenderAlias(contactsRef.current, id.userId);
      const bytes = encodeGroupMessagePayload(
        { kind: 'text', body },
        { from: id.userId, senderAlias, groupId, client: clientVersionRef.current },
      );

      if (isDesktopShell() && settingsRef.current.desktopLinked) {
        for (const memberId of group.memberIds) {
          if (memberId === id.userId) continue;
          await sendRelayViaPhone(memberId, randomId(), bytesToBase64(bytes));
        }
      } else {
        const transport = await ensureTransportReady();
        if (transport?.isConnected()) {
          for (const memberId of group.memberIds) {
            if (memberId === id.userId) continue;
            const memberMessageId = randomId();
            const wire = await encryptOutgoingMessage(memberId, bytes);
            transport.sendRaw(memberId, memberMessageId, wire);
          }
        }
      }

      pushMessage({
        id: messageId,
        contactId: groupId,
        direction: 'out',
        senderId: id.userId,
        senderAlias,
        content: { kind: 'text', body },
        timestamp: Date.now(),
      });
    },
    [ensureTransportReady, identity],
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

  const sendText = useCallback(async (contactId: string, body: string) => {
    if (isGroupId(contactId)) {
      await sendGroupText(contactId, body);
      return;
    }
    const id = identityRef.current ?? identity;
    if (!id) return;
    const messageId = randomId();

    if (isDesktopShell() && settingsRef.current.desktopLinked) {
      const bytes = encodePayload({ kind: 'text', body, from: id.userId }, clientVersionRef.current);
      await sendRelayViaPhone(contactId, messageId, bytesToBase64(bytes));
      pushMessage({
        id: messageId,
        contactId,
        direction: 'out',
        content: { kind: 'text', body },
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
    if (transport?.isConnected()) {
      const payload = encodePayload({ kind: 'text', body, from: id.userId }, clientVersionRef.current);
      const wire = await encryptOutgoingMessage(contactId, payload);
      transport.sendRaw(contactId, messageId, wire);
    }
    pushMessage({
      id: messageId,
      contactId,
      direction: 'out',
      content: { kind: 'text', body },
      timestamp: Date.now(),
    });
  }, [identity, sendGroupText]);

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

    const isFile = isFilePick(picked);
    const isVideo = isVideoPick(picked);
    const isVoice = isVoicePick(picked);
    const messageId = randomId();
    const previewUrl = quickPreviewForSend(picked, isFile, isVideo, isVoice);

    if (!previewUrl && !isFile && !isVoice) {
      notifyToast('Could not show media');
      return;
    }

    const placeholderName =
      picked.file.name?.trim() ||
      (isFile ? 'file.bin' : isVoice ? 'voice.m4a' : isVideo ? 'video.mp4' : 'photo.jpg');

    activeUploadsRef.current.set(messageId, { aborted: false });

    pushMessage({
      id: messageId,
      contactId,
      direction: 'out',
      content: isVoice
        ? {
            kind: 'voice',
            blobId: 'local',
            mime: picked.mime,
            fileName: placeholderName,
            size: picked.data?.length ?? 0,
            fileKey: '',
            digest: '',
            durationMs: picked.durationMs,
            previewUrl,
            uploading: true,
          }
        : {
            kind: isFile ? 'file' : isVideo ? 'video' : 'image',
            blobId: 'local',
            mime: picked.mime,
            fileName: placeholderName,
            size: picked.data?.length ?? 0,
            fileKey: '',
            digest: '',
            previewUrl,
            uploading: true,
          },
      timestamp: Date.now(),
    });

    const isAborted = () => activeUploadsRef.current.get(messageId)?.aborted === true;

    if (!isVoice) {
      void enrichOutgoingPreview(picked, isFile, isVideo).then((enriched) => {
        if (isAborted()) return;
        if (enriched) patchMessage(messageId, { previewUrl: enriched });
      });
    }

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
          if (!picked.data?.length) throw new Error('Could not read file');
          return {
            data: picked.data,
            mime: picked.mime === 'application/octet-stream' ? 'application/octet-stream' : picked.mime,
            fileName: placeholderName,
          };
        }
        if (isVideo) {
          if (!picked.data?.length) throw new Error('Could not read video');
          const fileName = picked.file.name?.trim() || placeholderName;
          return {
            data: picked.data,
            mime: picked.mime,
            fileName,
          };
        }
        return prepareImageForSend(picked);
      };

      const ensureTransport = async () => {
        let transport = transportRef.current;
        if (transport?.isConnected()) return transport;
        try {
          const relay = await pickRelayUrls(relayRef.current);
          relayRef.current = relay;
          connectTransport(id, relay);
          transport = transportRef.current;
          await transport?.connect();
        } catch {
          /* relay offline */
        }
        return transport;
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

      if (isVideo || (!isFile && !isVoice)) {
        try {
          await cacheDecryptedMedia(messageId, data, mime);
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
        notifyToast('Saved on this device — not connected to server');
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
      const group = isGroupId(contactId) ? groupsRef.current.find((g) => g.id === contactId) : undefined;
      const senderAlias = group ? ownSenderAlias(contactsRef.current, id.userId) : undefined;
      const sendParams = {
        messageId,
        blobId,
        data,
        mime,
        fileName,
        ...(isVoice && picked.durationMs != null ? { durationMs: picked.durationMs } : {}),
        ...(group ? { groupId: contactId, senderAlias } : {}),
        onPhase: (phase: 'encrypt' | 'upload', percent: number) => {
          if (phase === 'encrypt') {
            setProgress(12 + (percent / 100) * 8);
            return;
          }
          setProgress(20 + (percent / 100) * 75);
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
        previewUrl,
        uploading: false,
        uploadProgress: undefined,
      });
      activeUploadsRef.current.delete(messageId);

      if (isVideo) {
        void createVideoBubbleThumbUrl(data, mime, fileName).then((thumb) => {
          if (thumb && !isAborted()) patchMessage(messageId, { previewUrl: thumb });
        });
      } else if (!isFile && !isVoice) {
        patchMessage(messageId, { previewUrl: createFullImageBlobUrl(data, mime) });
      }
    } catch (e) {
      if (isAborted()) {
        activeUploadsRef.current.delete(messageId);
        return;
      }
      patchMessage(messageId, { uploading: false, blobId: 'local' });
      activeUploadsRef.current.delete(messageId);
      const msg = e instanceof Error ? e.message : 'Failed to send media';
      // Always show the real error so we can debug it
      if (/413/.test(msg)) {
        notifyToast('Upload failed: file too large (server limit)');
      } else {
        notifyToast(msg.length > 140 ? msg.slice(0, 140) + '…' : msg);
      }
    }
  }, [identity]);

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
        settings,
        httpBaseUrl: relayRef.current.http || defaultRelayHttpUrl(),
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      return encryptBackupPayload(password, payload, id.userId);
    },
    [identity, contacts, messages, settings],
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
          settings,
          httpBaseUrl: relayRef.current.http || defaultRelayHttpUrl(),
        });
      }

      const file = await buildEncryptedBackup(password);
      return prepareBackupShare(file);
    },
    [buildEncryptedBackup, identity, contacts, messages, settings],
  );

  const saveBackupDesktop = useCallback(
    async (password: string) => {
      const file = await buildEncryptedBackup(password);
      const saveResult = await saveBackupFile(file);
      updateSettings({ lastBackupAt: Date.now() });
      return saveResult;
    },
    [buildEncryptedBackup],
  );

  const shareBackup = useCallback(async (prepared: PreparedBackupShare) => {
    await sharePreparedBackup(prepared);
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

    persist({
      identity: { mnemonic: payload.mnemonic },
      contacts: payload.contacts,
      messages: restoredMessages,
      settings: mergedSettings,
      onboardingDone: true,
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
    if (!isDesktopShell() || !settings.desktopLinked) return;
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
        setPhoneOnline(online);
        setDesktopBleConnected(online);
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
      uploadSpeedKbps,
      settings,
      createAccount,
      recoverAccount,
      finishOnboarding,
      addContact,
      renameContact,
      deleteChat,
      verifyContact,
      sendText,
      sendCallSignal,
      setCallSignalHandler,
      sendMedia,
      cancelUpload,
      getContact: (id) => contacts.find((c) => c.userId === id),
      copyToClipboard: (t) => navigator.clipboard.writeText(t),
      logout: () => {
        transportRef.current?.disconnect();
        void disconnectPhoneBle();
        void stopDesktopLinkAdvertising({ force: true });
        clearDesktopLinkToken();
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
      dismissNotification,
      chatReadCursors,
      appLockEnabled,
      appUnlocked,
      unlockApp,
      enableAppLock,
      changeAppLockPassword,
      disableAppLock,
      lockApp,
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
      uploadSpeedKbps,
      settings,
      createAccount,
      recoverAccount,
      finishOnboarding,
      addContact,
      renameContact,
      deleteChat,
      verifyContact,
      sendText,
      sendCallSignal,
      setCallSignalHandler,
      sendMedia,
      cancelUpload,
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
      dismissNotification,
      chatReadCursors,
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
  const { contacts, groups, messages, chatReadCursors, notifications } = useApp();

  const unreadForChat = (contactId: string, thread: ChatMessage[]) => {
    const readAt = chatReadCursors[contactId] ?? 0;
    const messageUnread = thread.filter((m) => m.direction === 'in' && m.timestamp > readAt).length;
    const inviteUnread = notifications.filter(
      (n) => !n.read && n.kind === 'group_invite' && n.groupId === contactId,
    ).length;
    return Math.min(messageUnread + inviteUnread, 9);
  };

  const contactPreviews = contacts.map((c) => {
    const thread = messages.filter((m) => m.contactId === c.userId);
    const last = thread[thread.length - 1];
    return {
      contact: c,
      lastMessage: last ? previewText(last.content) : 'No messages yet',
      timestamp: last?.timestamp ?? 0,
      unread: unreadForChat(c.userId, thread),
      isGroup: false,
    };
  });

  const groupPreviews = groups.map((g) => {
    const thread = messages.filter((m) => m.contactId === g.id);
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
      timestamp: last?.timestamp ?? g.createdAt,
      unread: unreadForChat(g.id, thread),
      isGroup: true,
    };
  });

  return [...contactPreviews, ...groupPreviews].sort((a, b) => b.timestamp - a.timestamp);
}
