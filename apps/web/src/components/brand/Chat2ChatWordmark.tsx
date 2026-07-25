import type { CSSProperties } from 'react';

export function Chat2ChatWordmark({
  className,
  style,
  size = 'md',
}: {
  className?: string;
  style?: CSSProperties;
  size?: 'sm' | 'md' | 'lg';
}) {
  const fontSize = size === 'lg' ? 34 : size === 'sm' ? 22 : 30;
  return (
    <span className={className} style={{ fontWeight: 600, letterSpacing: '-0.025em', fontSize, ...style }}>
      Chat<span style={{ color: '#9C9C9A' }}>2</span>Chat
    </span>
  );
}
