import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { AppNotification } from '../lib/types';
import { formatTime, initials } from '../lib/types';
import { displayMemberName } from '../lib/group-protocol';
import { useApp } from '../store/AppContext';

type Props = {
  open: boolean;
  onClose: () => void;
};

function notificationTitle(n: AppNotification, contacts: ReturnType<typeof useApp>['contacts']): string {
  if (n.kind === 'group_invite') {
    const inviterName = displayMemberName(n.fromUserId, contacts);
    return `${inviterName} invited you`;
  }
  if (n.kind === 'group_kick') return `Removed from ${n.groupName}`;
  return `Admin of ${n.groupName}`;
}

function notificationBody(n: AppNotification): string {
  if (n.kind === 'group_invite') return `Join ${n.groupName}`;
  if (n.kind === 'group_kick') return 'You were removed from this group';
  return 'You are now the group admin';
}

export function NotificationsSheet({ open, onClose }: Props) {
  const { contacts, notifications, acceptGroupInvite, declineGroupInvite, dismissNotification, markNotificationsRead } = useApp();

  useEffect(() => {
    if (open) markNotificationsRead();
  }, [open, markNotificationsRead]);

  if (!open) return null;

  const sorted = [...notifications].sort((a, b) => b.timestamp - a.timestamp);

  return createPortal(
    <div className="share-contact-backdrop" onClick={onClose} role="presentation">
      <div className="share-contact-sheet notifications-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Activity">
        <div className="share-contact-handle" aria-hidden />
        <div className="notifications-sheet-header">
          <h2>Activity</h2>
          <button type="button" className="create-group-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="notifications-sheet-body share-contact-list">
          {sorted.length === 0 ? (
            <p className="notifications-sheet-empty">No notifications yet</p>
          ) : (
            sorted.map((n) => {
              const inviterName =
                n.kind === 'group_invite' ? displayMemberName(n.fromUserId, contacts) : null;
              const avatarLabel =
                n.kind === 'group_invite' && inviterName ? inviterName : n.groupName;
              return (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  className={`notifications-sheet-item${n.read ? '' : ' notifications-sheet-item--unread'}`}
                  onClick={() => {
                    if (n.kind === 'group_invite' && !n.read) return;
                    dismissNotification(n.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    if (n.kind === 'group_invite' && !n.read) return;
                    e.preventDefault();
                    dismissNotification(n.id);
                  }}
                >
                  <div className="avatar notifications-sheet-avatar">
                    {initials(avatarLabel)}
                  </div>
                  <div className="notifications-sheet-item-body">
                    <div className="notifications-sheet-item-top">
                      <span className="notifications-sheet-item-title">{notificationTitle(n, contacts)}</span>
                      <span className="notifications-sheet-item-time">{formatTime(n.timestamp)}</span>
                    </div>
                    <p className="notifications-sheet-item-sub">{notificationBody(n)}</p>
                    {n.kind === 'group_invite' && !n.read && (
                      <div className="notifications-sheet-actions">
                        <button
                          type="button"
                          className="btn-secondary notifications-sheet-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            void declineGroupInvite(n.inviteId);
                          }}
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          className="btn-primary notifications-sheet-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            void acceptGroupInvite(n.inviteId);
                          }}
                        >
                          Accept
                        </button>
                      </div>
                    )}
                    {n.read && (
                      <button
                        type="button"
                        className="notifications-sheet-dismiss"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissNotification(n.id);
                        }}
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
