import type { Contact, ChatMessage } from './types';
import type { Identity } from '@chat2chat/crypto/browser';

export const SAVED_MESSAGES_CONTACT_ID = 'c2c_saved_messages';
export const SAVED_MESSAGES_ALIAS = 'Saved Messages';

export function isSavedMessagesId(contactId: string): boolean {
  return contactId === SAVED_MESSAGES_CONTACT_ID;
}

export function isSavedMessagesContact(contact: Contact): boolean {
  return Boolean(contact.isSavedMessages) || contact.userId === SAVED_MESSAGES_CONTACT_ID;
}

export function buildSavedMessagesContact(): Contact {
  return {
    userId: SAVED_MESSAGES_CONTACT_ID,
    fingerprint: '',
    alias: SAVED_MESSAGES_ALIAS,
    verified: true,
    avatar: 'bookmark',
    isSavedMessages: true,
  };
}

export function ensureSavedMessagesContact(contacts: Contact[]): Contact[] {
  const saved = buildSavedMessagesContact();
  const idx = contacts.findIndex((c) => isSavedMessagesContact(c));
  if (idx === -1) return [saved, ...contacts];
  const existing = contacts[idx];
  const normalized = {
    ...saved,
    ...existing,
    isSavedMessages: true,
    alias: SAVED_MESSAGES_ALIAS,
    avatar: 'bookmark',
    userId: SAVED_MESSAGES_CONTACT_ID,
  };
  if (
    existing.isSavedMessages &&
    existing.alias === normalized.alias &&
    existing.userId === normalized.userId
  ) {
    return contacts;
  }
  const next = [...contacts];
  next[idx] = normalized;
  return next;
}

export function migrateSavedMessagesState(
  identity: Identity,
  contacts: Contact[],
  messages: ChatMessage[],
): { contacts: Contact[]; messages: ChatMessage[] } {
  const selfId = identity.userId;

  let nextContacts = contacts.filter((c) => {
    if (c.userId === selfId && !isSavedMessagesContact(c)) return false;
    if (c.userId === selfId && c.alias === SAVED_MESSAGES_ALIAS) return false;
    return true;
  });

  nextContacts = ensureSavedMessagesContact(nextContacts);

  const hasLegacyMessages = messages.some((m) => m.contactId === selfId);
  const nextMessages = hasLegacyMessages
    ? messages.map((m) =>
        m.contactId === selfId ? { ...m, contactId: SAVED_MESSAGES_CONTACT_ID } : m,
      )
    : messages;

  return { contacts: nextContacts, messages: nextMessages };
}
