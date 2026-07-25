import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  LockIcon,
  MicIcon,
  MessageIcon,
  PhoneEndIcon,
  PhoneIcon,
  SpeakerIcon,
} from '../Icons';
import { formatCallDuration } from '../../lib/calls';
import { useCalls } from '../../store/CallContext';
import { useApp } from '../../store/AppContext';

function useCallElapsed(activeAt: number | undefined, startedAt: number, running: boolean): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) {
      setElapsed(0);
      return;
    }
    const base = activeAt ?? startedAt;
    const tick = () => setElapsed(Date.now() - base);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [activeAt, startedAt, running]);

  return elapsed;
}

export function CallOverlay() {
  const { activeCall, acceptCall, declineCall, endCall, toggleMute, toggleSpeaker, minimizeCall } = useCalls();
  const { getContact } = useApp();
  const navigate = useNavigate();

  const contact = activeCall ? getContact(activeCall.contactId) : undefined;
  const phase = activeCall?.phase;
  const elapsed = useCallElapsed(
    activeCall?.activeAt,
    activeCall?.startedAt ?? 0,
    Boolean(activeCall && !activeCall.minimized && phase === 'active'),
  );

  if (!activeCall || activeCall.minimized || !contact) return null;

  const overlay = (
    <div className="call-overlay">
      <div className="call-overlay-bg" aria-hidden />
      <div className="call-overlay-content">
        {phase === 'incoming' && (
          <>
            <div className="call-overlay-top">
              <div className="call-enc-label">
                <LockIcon size={11} color="#9C9C9A" />
                ENCRYPTED CALL
              </div>
              <div className="avatar call-overlay-avatar call-overlay-avatar--lg">{contact.avatar}</div>
              <div className="call-overlay-name">{contact.alias}</div>
              <div className="call-overlay-sub">Chat2Chat audio…</div>
            </div>
            <div className="call-overlay-actions call-overlay-actions--ring">
              <div className="call-ctrl-wrap">
                <button type="button" className="call-big-btn end" onClick={declineCall} aria-label="Decline">
                  <PhoneEndIcon />
                </button>
                <span className="call-ctrl-lbl">Decline</span>
              </div>
              <div className="call-ctrl-wrap">
                <button type="button" className="call-big-btn accept" onClick={acceptCall} aria-label="Accept">
                  <PhoneIcon size={28} color="#0B0B0C" />
                </button>
                <span className="call-ctrl-lbl">Accept</span>
              </div>
            </div>
          </>
        )}

        {(phase === 'outgoing' || phase === 'connecting' || phase === 'active') && (
          <>
            <div className="call-overlay-top">
              <div className="avatar call-overlay-avatar">{contact.avatar}</div>
              <div className="call-overlay-name call-overlay-name--active">{contact.alias}</div>
              {phase === 'active' ? (
                <div className="call-overlay-timer">{formatCallDuration(elapsed)}</div>
              ) : (
                <div className="call-overlay-sub">
                  {phase === 'connecting' ? 'Connecting…' : 'Calling…'}
                </div>
              )}
              {phase === 'active' && (
                <div className="call-enc-label call-enc-label--active">
                  <LockIcon size={11} color="#7FB88A" />
                  END-TO-END ENCRYPTED
                </div>
              )}
            </div>

            {phase === 'active' && (
              <div className="call-overlay-controls">
                <div className="call-overlay-controls-row">
                  <div className="call-ctrl-wrap">
                    <button
                      type="button"
                      className={`call-ctrl${activeCall.muted ? ' act' : ''}`}
                      onClick={toggleMute}
                      aria-label={activeCall.muted ? 'Unmute' : 'Mute'}
                    >
                      <MicIcon color={activeCall.muted ? '#0B0B0C' : '#F4F4F3'} />
                    </button>
                    <span className="call-ctrl-lbl">Mute</span>
                  </div>
                  <div className="call-ctrl-wrap">
                    <button
                      type="button"
                      className={`call-ctrl${activeCall.speakerOn ? ' act' : ''}`}
                      onClick={toggleSpeaker}
                      aria-label={activeCall.speakerOn ? 'Speaker off' : 'Speaker'}
                    >
                      <SpeakerIcon color={activeCall.speakerOn ? '#0B0B0C' : '#F4F4F3'} />
                    </button>
                    <span className="call-ctrl-lbl">Speaker</span>
                  </div>
                  <div className="call-ctrl-wrap">
                    <button
                      type="button"
                      className="call-ctrl"
                      onClick={() => {
                        minimizeCall();
                        navigate(`/chat/${encodeURIComponent(activeCall.contactId)}`);
                      }}
                      aria-label="Message"
                    >
                      <MessageIcon color="#F4F4F3" />
                    </button>
                    <span className="call-ctrl-lbl">Message</span>
                  </div>
                </div>
              </div>
            )}

            <div className="call-overlay-actions">
              <div className="call-ctrl-wrap">
                <button type="button" className="call-big-btn end" onClick={endCall} aria-label="End call">
                  <PhoneEndIcon />
                </button>
                <span className="call-ctrl-lbl">{phase === 'active' ? 'End' : 'Cancel'}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
