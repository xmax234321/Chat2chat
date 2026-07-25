import type { AppIconStyle } from '../../lib/app-icon-styles';
import { APP_ICON_STYLE_LABELS } from '../../lib/app-icon-styles';

const TILE_BG: Record<AppIconStyle, string> = {
  'mono-dark': '#0B0B0C',
  'mono-light': '#F4F4F3',
};

function MonoLockMark({ color, hole }: { color: string; hole: string }) {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden>
      <path
        d="M17 21 V15 a7 7 0 0 1 14 0 V21"
        fill="none"
        stroke={color}
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <rect x="9" y="21" width="30" height="17" rx="5.5" fill={color} />
      <path d="M14.5 37 L11.5 43.2 L21 37.5 Z" fill={color} />
      <circle cx="24" cy="28" r="3.1" fill={hole} />
      <path d="M22.5 29.7 L21.7 34 h4.6 l-0.8 -4.3 Z" fill={hole} />
    </svg>
  );
}

function IconMark({ style }: { style: AppIconStyle }) {
  switch (style) {
    case 'mono-dark':
      return <MonoLockMark color="#F4F4F3" hole="#0B0B0C" />;
    case 'mono-light':
      return <MonoLockMark color="#0B0B0C" hole="#F4F4F3" />;
  }
}

export function AppIconStyleTile({
  style,
  selected,
  onSelect,
  size = 72,
  compactLabel = false,
}: {
  style: AppIconStyle;
  selected?: boolean;
  onSelect?: () => void;
  size?: number;
  compactLabel?: boolean;
}) {
  const radius = Math.round(size * 0.226);
  const markSize = Math.round(size * 0.55);
  const fullLabel = APP_ICON_STYLE_LABELS[style];
  const label = compactLabel ? fullLabel.replace('Mono ', '') : fullLabel;

  const tile = (
    <div
      className={`app-icon-style-tile${selected ? ' app-icon-style-tile--selected' : ''}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: TILE_BG[style],
        boxShadow: '0 8px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: markSize, height: markSize }}>
        <IconMark style={style} />
      </div>
    </div>
  );

  if (!onSelect) {
    return (
      <div className="app-icon-style-option" aria-label={label}>
        {tile}
        <span className="app-icon-style-label">{label}</span>
      </div>
    );
  }

  return (
    <button type="button" className="app-icon-style-option" onClick={onSelect} aria-label={label} aria-pressed={selected}>
      {tile}
      {!compactLabel && <span className="app-icon-style-label">{label}</span>}
      {compactLabel && <span className="app-icon-style-label app-icon-style-label--compact">{label}</span>}
    </button>
  );
}
