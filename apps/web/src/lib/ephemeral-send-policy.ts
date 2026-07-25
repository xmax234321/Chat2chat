import { isSavedMessagesId } from './saved-messages';
import { isGroupId } from './types';

export function ephemeralSendAllowed(contactId: string): boolean {
  return !isGroupId(contactId) && !isSavedMessagesId(contactId);
}
