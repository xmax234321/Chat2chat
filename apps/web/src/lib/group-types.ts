export type GroupDeletePolicy =
  | { mode: 'all' }
  | { mode: 'majority' }
  | { mode: 'count'; count: number };

export interface Group {
  id: string;
  name: string;
  avatar: string;
  adminId: string;
  /** Accepted members (includes admin). */
  memberIds: string[];
  /** Pending invites — not in chat until they accept. */
  invitedIds: string[];
  createdAt: number;
  deletePolicy: GroupDeletePolicy;
}

export type GroupInviteStatus = 'pending' | 'accepted' | 'declined';

export interface GroupInvite {
  id: string;
  groupId: string;
  groupName: string;
  fromUserId: string;
  fromAlias: string;
  timestamp: number;
  status: GroupInviteStatus;
}

export type AppNotification =
  | {
      id: string;
      kind: 'group_invite';
      inviteId: string;
      groupId: string;
      groupName: string;
      fromUserId: string;
      fromAlias: string;
      timestamp: number;
      read: boolean;
    }
  | {
      id: string;
      kind: 'group_kick';
      groupId: string;
      groupName: string;
      timestamp: number;
      read: boolean;
    }
  | {
      id: string;
      kind: 'admin_transfer';
      groupId: string;
      groupName: string;
      fromUserId: string;
      timestamp: number;
      read: boolean;
    };

export function normalizeGroup(group: Group): Group {
  return {
    ...group,
    invitedIds: group.invitedIds ?? [],
  };
}

export function acceptedMemberCount(group: Group): number {
  return group.memberIds.length;
}

export function isGroupId(id: string): boolean {
  return id.startsWith('grp_');
}

export function generateGroupId(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return `grp_${Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')}`;
}

export function viewThreshold(memberCount: number, policy: GroupDeletePolicy): number {
  if (policy.mode === 'all') return memberCount;
  if (policy.mode === 'majority') return Math.ceil(memberCount / 2);
  return Math.min(policy.count, memberCount);
}

export const DEFAULT_GROUP_DELETE_POLICY: GroupDeletePolicy = { mode: 'all' };
