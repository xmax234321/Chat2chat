export type Chat2ChatMarkVariant = 'primary' | 'reversed' | 'outline';

const HOLE = {
  primary: '#F4F4F3',
  reversed: '#0B0B0C',
  outline: 'none',
} as const;

export function Chat2ChatMark({
  variant = 'primary',
  size = 48,
  className,
  color,
}: {
  variant?: Chat2ChatMarkVariant;
  size?: number;
  className?: string;
  color?: string;
}) {
  const hole = HOLE[variant];

  if (variant === 'outline') {
    return (
      <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden
        style={color ? { color } : undefined}
      >
        <path
          d="M17 21 V15 a7 7 0 0 1 14 0 V21"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <rect
          x="9"
          y="21"
          width="30"
          height="17"
          rx="5.5"
          stroke="currentColor"
          strokeWidth="2.6"
        />
        <path
          d="M14.5 38 L11.8 43 L20 38"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx="24" cy="27.6" r="3" stroke="currentColor" strokeWidth="2.2" />
        <path d="M24 30.6 v3.4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden
      style={color ? { color } : undefined}
    >
      <path
        d="M17 21 V15 a7 7 0 0 1 14 0 V21"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <rect x="9" y="21" width="30" height="17" rx="5.5" fill="currentColor" />
      <path d="M14.5 37 L11.5 43.2 L21 37.5 Z" fill="currentColor" />
      <circle cx="24" cy="28" r="3.1" fill={hole} />
      <path d="M22.5 29.7 L21.7 34 h4.6 l-0.8 -4.3 Z" fill={hole} />
    </svg>
  );
}
