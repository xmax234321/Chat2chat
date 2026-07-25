import type { ReactNode } from 'react';
import { useDeviceLayout } from '../hooks/useDeviceLayout';
import { PhoneShell } from './PhoneShell';
import { AppIconBadge } from './brand/AppIconBadge';
import { Chat2ChatWordmark } from './brand/Chat2ChatWordmark';

export function AuthLayout({ children, onBack }: { children: ReactNode; onBack?: () => void }) {
  const layout = useDeviceLayout();

  if (layout === 'computer') {
    return (
      <div className="auth-desktop">
        <aside className="auth-desktop-brand">
          <AppIconBadge tile={52} mark={30} className="auth-desktop-brand-icon" />
          <Chat2ChatWordmark size="lg" style={{ display: 'block' }} />
          <p>Private by design. Your conversations live only on your devices — never on our servers.</p>
          <ul className="auth-desktop-features">
            <li>End-to-end encrypted</li>
            <li>No phone number required</li>
            <li>Zero server storage</li>
          </ul>
        </aside>
        <main className="auth-desktop-panel">
          {onBack && (
            <button type="button" className="auth-back-btn" onClick={onBack}>
              ← Back
            </button>
          )}
          {children}
        </main>
      </div>
    );
  }

  return <PhoneShell>{children}</PhoneShell>;
}
