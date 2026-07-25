import { useEffect, useState } from 'react';
import { MicIcon, PhoneEndIcon } from '../Icons';
import { formatCallDuration } from '../../lib/calls';
import type { ActiveCall } from '../../lib/calls';
import type { Contact } from '../../lib/types';
import { useCalls } from '../../store/CallContext';

export function InCallBanner({ call, contact }: { call: ActiveCall; contact: Contact }) {
  const { expandCall, endCall, toggleMute } = useCalls();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tick = () => {
      const base = call.activeAt ?? call.startedAt;
      setElapsed(Date.now() - base);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [call.activeAt, call.startedAt]);

  return (
    <div className="in-call-banner">
      <div className="avatar in-call-banner-avatar">{contact.avatar}</div>
      <button type="button" className="in-call-banner-main" onClick={expandCall}>
        <div className="in-call-banner-name">{contact.alias}</div>
        <div className="in-call-banner-status">Ongoing call · {formatCallDuration(elapsed)}</div>
      </button>
      <button
        type="button"
        className="in-call-banner-ctrl in-call-banner-ctrl--mute"
        onClick={toggleMute}
        aria-label={call.muted ? 'Unmute' : 'Mute'}
      >
        <MicIcon size={15} color="#7FB88A" />
      </button>
      <button
        type="button"
        className="in-call-banner-ctrl in-call-banner-ctrl--end"
        onClick={endCall}
        aria-label="End call"
      >
        <PhoneEndIcon size={16} />
      </button>
    </div>
  );
}
