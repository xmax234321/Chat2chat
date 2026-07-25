import { useApp } from '../store/AppContext';
import { displayMemberName } from '../lib/group-protocol';
import type { ChatMessage } from '../lib/types';
import { ExpandableUserId } from './ExpandableUserId';

type InviteContent = Extract<ChatMessage['content'], { kind: 'group_invite' }>;

export function GroupInviteMessage({
  message,
  direction,
}: {
  message: ChatMessage & { content: InviteContent };
  direction: 'in' | 'out';
}) {
  const { contacts, acceptGroupInvite, declineGroupInvite } = useApp();
  const { content } = message;
  const pending = content.status === 'pending';

  if (direction === 'out') {
    let subtitle = 'Invitation sent';
    if (content.status === 'accepted') subtitle = 'Invitation accepted';
    else if (content.status === 'declined') subtitle = 'Invitation declined';
    else if (pending) subtitle = 'Waiting for response';

    return (
      <div className="bubble-out group-invite-bubble-out">
        <span className="group-invite-bubble-out-title">{content.groupName}</span>
        <span className="group-invite-bubble-out-sub">{subtitle}</span>
      </div>
    );
  }

  const inviterLabel = displayMemberName(content.fromUserId, contacts);
  const inviterIsId = inviterLabel === content.fromUserId;

  let statusLabel: string | null = null;
  if (content.status === 'accepted') statusLabel = 'You joined';
  else if (content.status === 'declined') statusLabel = 'You declined';

  return (
    <div className="bubble-in group-invite-msg">
      <div className="group-invite-msg-icon" aria-hidden>
        {content.groupName.slice(0, 1).toUpperCase()}
      </div>
      <div className="group-invite-msg-body">
        <p className="group-invite-msg-title">{content.groupName}</p>
        <p className="group-invite-msg-sub">
          {pending ? (
            inviterIsId ? (
              <>
                <ExpandableUserId userId={inviterLabel} /> invited you
              </>
            ) : (
              <>{inviterLabel} invited you</>
            )
          ) : (
            statusLabel
          )}
        </p>
        {pending && (
          <div className="group-invite-msg-actions">
            <button
              type="button"
              className="btn-secondary group-invite-msg-btn"
              onClick={() => void declineGroupInvite(content.inviteId)}
            >
              Decline
            </button>
            <button
              type="button"
              className="btn-primary group-invite-msg-btn"
              onClick={() => void acceptGroupInvite(content.inviteId)}
            >
              Accept
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
