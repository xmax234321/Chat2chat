import { getMiniBadgeStyle } from '../lib/file-mini-badge';

export function FileMiniBadge({ fileName }: { fileName: string }) {
  const { bg, fg, border, label } = getMiniBadgeStyle(fileName);

  return (
    <span
      className="file-mini-badge"
      style={{
        background: bg,
        color: fg,
        border: border ?? 'none',
      }}
      aria-hidden
    >
      <b>{label}</b>
    </span>
  );
}
