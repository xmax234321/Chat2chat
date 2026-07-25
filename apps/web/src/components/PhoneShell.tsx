import type { ReactNode } from 'react';
import { CellularDataBanner } from './CellularDataBanner';
import { isMobileShell } from '../lib/platform';

export function PhoneShell({ children, showHome = true }: { children: ReactNode; showHome?: boolean }) {
  if (isMobileShell()) {
    return (
      <div className="native-app">
        <CellularDataBanner />
        <div className="native-app-frame">{children}</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="phone">
        <div className="sb">
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span>●●●</span>
        </div>
        {children}
        {showHome && <div className="home-indicator" />}
      </div>
    </div>
  );
}

export function NavHeader({
  step,
  onBack,
}: {
  step?: string;
  onBack?: () => void;
}) {
  return (
    <div className="nav-header">
      {onBack && (
        <button type="button" className="nav-back" onClick={onBack} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      {step && <div className="step-label">{step}</div>}
    </div>
  );
}
