import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PhoneShell } from '../components/PhoneShell';
import { BackIcon } from '../components/Icons';
import { InviteMembersSheet } from '../components/InviteMembersSheet';
import { useApp } from '../store/AppContext';
import type { GroupDeletePolicy } from '../lib/types';
import { initials } from '../lib/types';
import { acceptedMemberCount } from '../lib/group-types';
import { displayMemberName } from '../lib/group-protocol';

type PolicyMode = 'all' | 'majority' | 'count';

function policyMode(policy: GroupDeletePolicy): PolicyMode {
  return policy.mode;
}

export function GroupProfileScreen() {
  const navigate = useNavigate();
  const { groupId: rawGroupId } = useParams();
  const groupId = decodeURIComponent(rawGroupId ?? '');
  const {
    contacts,
    getGroup,
    getContact,
    identity,
    kickFromGroup,
    transferGroupAdmin,
    updateGroupDeletePolicy,
    leaveGroup,
    deleteGroup,
  } = useApp();

  const group = getGroup(groupId);
  const isAdmin = group?.adminId === identity?.userId;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [policyModeSel, setPolicyModeSel] = useState<PolicyMode>(() =>
    group ? policyMode(group.deletePolicy) : 'all',
  );
  const [customCount, setCustomCount] = useState(() =>
    group?.deletePolicy.mode === 'count' ? group.deletePolicy.count : 2,
  );

  const memberCount = group ? acceptedMemberCount(group) : 0;
  const maxCustom = Math.max(memberCount, 1);

  const policyLabel = useMemo(() => {
    if (!group) return '';
    const p = group.deletePolicy;
    if (p.mode === 'all') return 'Everyone views';
    if (p.mode === 'majority') return 'Majority views';
    return `${p.count} member${p.count === 1 ? '' : 's'} view`;
  }, [group]);

  if (!group) {
    return (
      <PhoneShell>
        <div className="screen-pad">Group not found</div>
      </PhoneShell>
    );
  }

  const applyPolicy = (mode: PolicyMode) => {
    setPolicyModeSel(mode);
    let policy: GroupDeletePolicy;
    if (mode === 'all') policy = { mode: 'all' };
    else if (mode === 'majority') policy = { mode: 'majority' };
    else policy = { mode: 'count', count: Math.min(Math.max(1, customCount), maxCustom) };
    void updateGroupDeletePolicy(groupId, policy);
  };

  const applyCustomCount = (count: number) => {
    const next = Math.min(Math.max(1, count), maxCustom);
    setCustomCount(next);
    if (policyModeSel === 'count') {
      void updateGroupDeletePolicy(groupId, { mode: 'count', count: next });
    }
  };

  return (
    <PhoneShell showHome={false}>
      <div className="group-profile-screen">
        <div className="group-profile-header">
          <button type="button" className="nav-back" onClick={() => navigate(-1)}>
            <BackIcon />
          </button>
          <h1>Group info</h1>
        </div>

        <div className="group-profile-hero">
          <div className="avatar group-profile-avatar">{group.avatar}</div>
          <h2 className="group-profile-name">{group.name}</h2>
          <p className="group-profile-meta">
            {group.memberIds.length} members
            {(group.invitedIds?.length ?? 0) > 0 ? ` · ${group.invitedIds.length} invited` : ''}
          </p>
        </div>

        <div className="group-profile-section">
          <div className="group-profile-section-head">
            <h3 className="group-profile-section-title">Members</h3>
            {isAdmin && (
              <button type="button" className="group-profile-add-btn" onClick={() => setInviteOpen(true)}>
                Add members
              </button>
            )}
          </div>
          {group.memberIds.map((memberId) => {
            const contact = getContact(memberId);
            const isMemberAdmin = memberId === group.adminId;
            return (
              <div key={memberId} className="group-profile-member">
                <span className="avatar">{contact?.avatar ?? initials(contact?.alias ?? memberId)}</span>
                <span className="group-profile-member-name">
                  {memberId === identity?.userId
                    ? 'You'
                    : displayMemberName(memberId, contacts)}
                  {isMemberAdmin ? <span className="group-profile-admin-badge">Admin</span> : null}
                </span>
                {isAdmin && memberId !== identity?.userId && (
                  <div className="group-profile-member-actions">
                    <button
                      type="button"
                      className="group-profile-action-btn"
                      onClick={() => void transferGroupAdmin(groupId, memberId)}
                    >
                      Make admin
                    </button>
                    <button
                      type="button"
                      className="group-profile-action-btn group-profile-action-btn--danger"
                      onClick={() => void kickFromGroup(groupId, memberId)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {(group.invitedIds ?? []).map((invitedId) => {
            const contact = getContact(invitedId);
            return (
              <div key={`inv_${invitedId}`} className="group-profile-member group-profile-member--invited">
                <span className="avatar">{contact?.avatar ?? initials(contact?.alias ?? invitedId)}</span>
                <span className="group-profile-member-name">
                  {displayMemberName(invitedId, contacts)}
                  <span className="group-profile-invited-badge">Invited</span>
                </span>
              </div>
            );
          })}
        </div>

        {isAdmin && (
          <div className="group-profile-section">
            <h3 className="group-profile-section-title">Delete policy</h3>
            <p className="group-profile-hint">Messages delete from server after enough members view them.</p>
            <div className="group-profile-policy-list">
              <button
                type="button"
                className={`group-profile-policy-btn${policyModeSel === 'all' ? ' group-profile-policy-btn--on' : ''}`}
                onClick={() => applyPolicy('all')}
              >
                Everyone views
              </button>
              <button
                type="button"
                className={`group-profile-policy-btn${policyModeSel === 'majority' ? ' group-profile-policy-btn--on' : ''}`}
                onClick={() => applyPolicy('majority')}
              >
                Majority views
              </button>
              <button
                type="button"
                className={`group-profile-policy-btn${policyModeSel === 'count' ? ' group-profile-policy-btn--on' : ''}`}
                onClick={() => applyPolicy('count')}
              >
                Custom count
              </button>
            </div>
            {policyModeSel === 'count' && (
              <div className="group-profile-policy-slider">
                <label htmlFor="policy-count">
                  Members who must view: <strong>{customCount}</strong> / {maxCustom}
                </label>
                <input
                  id="policy-count"
                  type="range"
                  min={1}
                  max={maxCustom}
                  value={Math.min(customCount, maxCustom)}
                  onChange={(e) => applyCustomCount(Number(e.target.value))}
                />
              </div>
            )}
            <p className="group-profile-policy-active">Current: {policyLabel}</p>
          </div>
        )}

        {!isAdmin && (
          <button type="button" className="group-profile-leave-btn" onClick={() => void leaveGroup(groupId)}>
            Leave group
          </button>
        )}

        {isAdmin && (
          <button
            type="button"
            className="group-profile-leave-btn group-profile-delete-btn"
            onClick={() => {
              if (window.confirm(`Delete “${group.name}” for everyone? This cannot be undone.`)) {
                void deleteGroup(groupId).then(() => navigate('/chats'));
              }
            }}
          >
            Delete group
          </button>
        )}
      </div>

      <InviteMembersSheet open={inviteOpen} group={group} onClose={() => setInviteOpen(false)} />
    </PhoneShell>
  );
}
