import type { ChatMessage, MessageDeliveryStatus } from './types';

export function resolveDeliveryStatus(message: ChatMessage): MessageDeliveryStatus | null {
  if (message.direction !== 'out') return null;
  if (message.deliveryStatus) return message.deliveryStatus;
  if (message.pendingDelivery) return 'pending';
  const content = message.content;
  if (
    (content.kind === 'image' ||
      content.kind === 'video' ||
      content.kind === 'file' ||
      content.kind === 'voice') &&
    content.uploading
  ) {
    return 'pending';
  }
  return 'sent';
}

export function deliveryMetaForSend(delivered: boolean): Pick<ChatMessage, 'pendingDelivery' | 'deliveryStatus'> {
  return delivered
    ? { pendingDelivery: false, deliveryStatus: 'sent' }
    : { pendingDelivery: true, deliveryStatus: 'pending' };
}
