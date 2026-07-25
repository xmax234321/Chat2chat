import { openAppSettings } from '../lib/device-permissions';

type Kind = 'camera' | 'microphone';

const COPY: Record<Kind, { title: string; text: string }> = {
  camera: {
    title: 'Camera access needed',
    text: 'Allow camera access in Settings to scan QR codes and take photos.',
  },
  microphone: {
    title: 'Microphone access needed',
    text: 'Allow microphone access in Settings to record voice messages.',
  },
};

export function PermissionStub({
  kind,
  onAllow,
  compact = false,
}: {
  kind: Kind;
  onAllow?: () => void;
  compact?: boolean;
}) {
  const copy = COPY[kind];

  return (
    <div className={`permission-stub${compact ? ' permission-stub--compact' : ''}`}>
      <div className="permission-stub-icon" aria-hidden>
        {kind === 'camera' ? (
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 8h3l2-3h6l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" />
            <circle cx="12" cy="14" r="3.5" />
          </svg>
        ) : (
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z" />
            <path d="M19 11v1a7 7 0 0 1-14 0v-1" />
            <path d="M12 19v3" />
          </svg>
        )}
      </div>
      <h2 className="permission-stub-title">{copy.title}</h2>
      <p className="permission-stub-text">{copy.text}</p>
      <button
        type="button"
        className="btn-primary permission-stub-btn"
        onClick={() => {
          if (onAllow) {
            void onAllow();
            return;
          }
          void openAppSettings();
        }}
      >
        Open Settings
      </button>
    </div>
  );
}
