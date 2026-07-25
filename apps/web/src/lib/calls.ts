export type CallPhase = 'incoming' | 'outgoing' | 'connecting' | 'active';

export type CallDirection = 'incoming' | 'outgoing';

export type CallOutcome = 'completed' | 'missed' | 'declined' | 'cancelled';

export interface CallRecord {
  id: string;
  contactId: string;
  direction: CallDirection;
  outcome: CallOutcome;
  timestamp: number;
  durationMs?: number;
}

export interface ActiveCall {
  id: string;
  contactId: string;
  phase: CallPhase;
  direction: CallDirection;
  startedAt: number;
  activeAt?: number;
  minimized: boolean;
  muted: boolean;
  speakerOn: boolean;
}

export function formatCallDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function historyTimeLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    const diffMin = Math.max(1, Math.round((now.getTime() - ts) / 60000));
    if (diffMin < 60) return `${diffMin} min`;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const diff = now.getTime() - ts;
  if (diff < 7 * 86400000) {
    return d.toLocaleDateString([], { weekday: 'short' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatCallHistoryMeta(record: CallRecord): string {
  const time = historyTimeLabel(record.timestamp);
  if (record.outcome === 'missed') return `Missed · ${time}`;
  const dir = record.direction === 'incoming' ? 'Incoming' : 'Outgoing';
  if (record.outcome === 'completed' && record.durationMs && record.durationMs >= 60000) {
    const min = Math.round(record.durationMs / 60000);
    return `${dir} · ${min} min`;
  }
  return `${dir} · ${time}`;
}

export function isMissedCall(record: CallRecord): boolean {
  return record.outcome === 'missed';
}
