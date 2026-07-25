import type { MessageDeliveryStatus } from '../lib/types';

type Props = {
  status: MessageDeliveryStatus;
};

export function MessageStatusTicks({ status }: Props) {
  if (status === 'pending' || status === 'failed') {
    return (
      <span className="msg-status-ticks msg-status-ticks--failed" aria-label="Not delivered">
        ✕
      </span>
    );
  }
  if (status === 'sent') {
    return (
      <span className="msg-status-ticks msg-status-ticks--sent" aria-label="Sent to server">
        ✓
      </span>
    );
  }
  if (status === 'delivered') {
    return (
      <span className="msg-status-ticks msg-status-ticks--delivered" aria-label="Delivered">
        ✓✓
      </span>
    );
  }
  return (
    <span className="msg-status-ticks msg-status-ticks--read" aria-label="Read">
      ✓✓
    </span>
  );
}
