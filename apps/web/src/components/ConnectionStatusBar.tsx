import { useState } from 'react';
import { createPortal } from 'react-dom';
import { formatPingMs } from '../lib/connection-metrics';
import { isCapacitor, isDesktopShell } from '../lib/platform';
import { useApp } from '../store/AppContext';

type BarVariant = 'online' | 'offline' | 'connecting' | 'safe-online';

function barVariant(
  connected: boolean,
  connecting: boolean,
  linkMode: boolean,
  linkPeerConnected: boolean,
): BarVariant {
  if (linkMode) {
    return linkPeerConnected ? 'safe-online' : 'offline';
  }
  if (connecting) return 'connecting';
  if (!connected) return 'offline';
  return 'online';
}

function ConnectionStatusSheet({
  open,
  onClose,
  pingMs,
  connected,
  desktopClientMode,
  phoneRelayMode,
  linkPeerConnected,
}: {
  open: boolean;
  onClose: () => void;
  pingMs: number | null;
  connected: boolean;
  desktopClientMode: boolean;
  phoneRelayMode: boolean;
  linkPeerConnected: boolean;
}) {
  if (!open) return null;

  return createPortal(
    <div className="share-contact-backdrop" onClick={onClose} role="presentation">
      <div className="share-contact-sheet connection-status-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="share-contact-handle" aria-hidden />
        <div className="share-contact-title">Connection status</div>
        <div className="connection-status-live">
          <div className="connection-status-live-row">
            <span>Ping</span>
            <strong>{connected ? formatPingMs(pingMs) : '—'}</strong>
          </div>
        </div>
        <div className="connection-status-explainer">
          {desktopClientMode && (
            <div className="connection-status-row">
              <span className="connection-status-dot connection-status-dot--safe" aria-hidden />
              <div>
                <strong>Phone linked</strong>
                <p>
                  {linkPeerConnected
                    ? 'Your phone is connected. Messages relay through your phone.'
                    : 'Phone disconnected — open Chat2Chat on your phone to reconnect.'}
                </p>
              </div>
            </div>
          )}
          {phoneRelayMode && (
            <div className="connection-status-row">
              <span className="connection-status-dot connection-status-dot--safe" aria-hidden />
              <div>
                <strong>Computer linked</strong>
                <p>
                  {linkPeerConnected
                    ? 'Your computer is connected. Messages relay through this phone.'
                    : 'Computer disconnected — open Chat2Chat on your computer to reconnect.'}
                </p>
              </div>
            </div>
          )}
          {!desktopClientMode && !phoneRelayMode && (
          <div className="connection-status-row">
            <span className="connection-status-dot connection-status-dot--online" aria-hidden />
            <div>
              <strong>Online</strong>
              <p>Connected to the relay. Messages send and receive normally.</p>
            </div>
          </div>
          )}
          <div className="connection-status-row">
            <span className="connection-status-dot connection-status-dot--connecting" aria-hidden />
            <div>
              <strong>Connecting</strong>
              <p>Reconnecting to the relay. Messages will send once the connection is ready.</p>
            </div>
          </div>
          <div className="connection-status-row">
            <span className="connection-status-dot connection-status-dot--offline" aria-hidden />
            <div>
              <strong>Offline</strong>
              <p>Not connected to the relay. Outgoing messages are saved locally and will send when back online.</p>
            </div>
          </div>
        </div>
        <button type="button" className="btn-secondary connection-status-done" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>,
    document.body,
  );
}

export function ConnectionStatusBar({ className }: { className?: string }) {
  const { connectionSnapshot, settings } = useApp();
  const { connected, connecting, connectionPingMs, desktopBleConnected } = connectionSnapshot;
  const [sheetOpen, setSheetOpen] = useState(false);
  const desktopClientMode = isDesktopShell() && Boolean(settings.desktopLinked);
  const phoneRelayMode = isCapacitor() && !isDesktopShell() && Boolean(settings.desktopLinked);
  const linkMode = desktopClientMode || phoneRelayMode;
  const linkPeerConnected = desktopBleConnected;
  const variant = barVariant(connected, connecting, linkMode, linkPeerConnected);
  const label = desktopClientMode
    ? linkPeerConnected
      ? 'Phone linked'
      : 'Phone offline'
    : phoneRelayMode
      ? linkPeerConnected
        ? 'Computer linked'
        : 'Computer offline'
      : variant === 'online'
        ? 'Online'
        : variant === 'connecting'
          ? 'Connecting'
          : 'Offline';

  return (
    <>
      <button
        type="button"
        className={`connection-status-bar connection-status-bar--${variant}${className ? ` ${className}` : ''}`}
        onClick={() => setSheetOpen(true)}
        aria-label={`${label} — tap for details`}
      >
        <span className="connection-status-bar-dot" aria-hidden />
        {label}
      </button>
      <ConnectionStatusSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        pingMs={connectionPingMs}
        connected={connected}
        desktopClientMode={desktopClientMode}
        phoneRelayMode={phoneRelayMode}
        linkPeerConnected={linkPeerConnected}
      />
    </>
  );
}
