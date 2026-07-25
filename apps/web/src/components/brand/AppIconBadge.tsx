import { Chat2ChatMark } from './Chat2ChatMark';

/** App icon tile: light background + primary logomark (from brand sheet). */
export function AppIconBadge({
  tile = 52,
  mark = 30,
  className,
}: {
  tile?: number;
  mark?: number;
  className?: string;
}) {
  const radius = Math.round(tile * 0.269);
  return (
    <div
      className={className}
      style={{
        width: tile,
        height: tile,
        borderRadius: radius,
        background: '#F4F4F3',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
      }}
    >
      <Chat2ChatMark variant="primary" size={mark} color="#0B0B0C" />
    </div>
  );
}
