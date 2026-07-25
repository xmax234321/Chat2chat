import type { ReactNode } from 'react';
import { SFCheckmark } from 'sf-symbols-lib/monochrome';

type Props = {
  icon: ReactNode;
  accentColor: string;
  label: string;
  granted: boolean;
  onPress: () => void;
  className?: string;
};

export function PermissionAccessRow({ icon, accentColor, label, granted, onPress, className = '' }: Props) {
  return (
    <button
      type="button"
      className={`permission-access-row${className ? ` ${className}` : ''}`}
      onClick={onPress}
      disabled={granted}
    >
      <span className="permission-access-row-icon" style={{ color: accentColor }} aria-hidden>
        {icon}
      </span>
      <span className="permission-access-row-label">{label}</span>
      <span className="permission-access-row-trail" aria-hidden>
        {granted ? (
          <SFCheckmark size={20} style={{ color: '#34C759', display: 'block' }} />
        ) : (
          <span className="permission-access-row-action">Enable</span>
        )}
      </span>
    </button>
  );
}
