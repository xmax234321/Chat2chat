import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { QrIcon } from '../Icons';
import { useUserProfile } from '../../hooks/useUserProfile';
import { loadAccountCreatedAt } from '../../lib/account-created';
import { coinTierForCreatedAt } from '../../lib/coin-tier';
import { profileInitials, resolveDisplayName } from '../../lib/user-profile';

export function SettingsPageHeader({
  title,
  onBack,
  rightAction,
}: {
  title: string;
  onBack: () => void;
  rightAction?: ReactNode;
}) {
  return (
    <div className="settings-fig-header">
      <button type="button" className="settings-fig-back" onClick={onBack} aria-label="Back">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <h1 className="settings-fig-title">{title}</h1>
      <span className="settings-fig-header-trail">{rightAction ?? <span className="settings-fig-header-spacer" aria-hidden />}</span>
    </div>
  );
}

export function SettingsFigList({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`settings-fig-list ${className}`.trim()}>{children}</div>;
}

export function SettingsFigmaProfile({
  userId,
  onClick,
  onShowQr,
}: {
  userId: string;
  onClick: () => void;
  onShowQr?: () => void;
}) {
  const [profile] = useUserProfile();
  const name = resolveDisplayName(profile.displayName);
  const tier = coinTierForCreatedAt(loadAccountCreatedAt());
  const shortId = userId.length > 22 ? `${userId.slice(0, 10)}…${userId.slice(-8)}` : userId;
  const avatarLabel = profileInitials(profile.displayName) || userId.replace(/^c2c_/, '').slice(0, 2).toUpperCase() || 'ME';

  return (
    <div className="settings-fig-profile">
      <button type="button" className="settings-fig-profile-main" onClick={onClick}>
        <span className={`settings-fig-profile-avatar settings-fig-profile-avatar--${tier}`} aria-hidden>
          {avatarLabel}
        </span>
        <span className="settings-fig-profile-copy">
          <span className="settings-fig-profile-name">{name}</span>
          <span className="settings-fig-profile-id">{shortId}</span>
        </span>
      </button>
      {onShowQr ? (
        <button type="button" className="settings-fig-profile-qr" onClick={onShowQr} aria-label="Show QR code">
          <QrIcon />
        </button>
      ) : null}
    </div>
  );
}

type FigmaRowProps = {
  icon?: ReactNode;
  label: string;
  to?: string;
  onClick?: () => void;
  className?: string;
};

export function SettingsFigmaRow({ icon, label, to, onClick, className = '' }: FigmaRowProps) {
  const body = (
    <>
      {icon ? <span className="settings-fig-row-icon">{icon}</span> : null}
      <span className="settings-fig-row-label">{label}</span>
    </>
  );

  const rowClass = `settings-fig-row${className ? ` ${className}` : ''}`;

  if (to) {
    return (
      <Link to={to} className={rowClass}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" className={rowClass} onClick={onClick}>
      {body}
    </button>
  );
}

export function SettingsCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`settings-card ${className}`.trim()}>{children}</div>;
}

export function SettingsStaticRow({
  icon,
  label,
  hint,
  trailing,
}: {
  icon?: ReactNode;
  label: string;
  hint?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="settings-fig-row settings-fig-row--static">
      {icon ? <span className="settings-fig-row-icon">{icon}</span> : null}
      <span className="settings-fig-row-body">
        <span className="settings-fig-row-label settings-fig-row-label--left">{label}</span>
        {hint ? <span className="settings-fig-row-hint">{hint}</span> : null}
      </span>
      {trailing ? <span className="settings-fig-row-trail">{trailing}</span> : null}
    </div>
  );
}
