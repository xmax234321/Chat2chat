import type { ReactNode } from 'react';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { isMobileShell } from '../lib/platform';
import { PhoneShell } from './PhoneShell';

/** Mobile phone frame, or full-bleed on desktop when forceFull */
export function AppShell({
  children,
  showHome = true,
  forceMobile = false,
}: {
  children: ReactNode;
  showHome?: boolean;
  forceMobile?: boolean;
}) {
  if (isMobileShell()) {
    return <PhoneShell showHome={showHome}>{children}</PhoneShell>;
  }
  const desktop = useIsDesktop();
  if (desktop && !forceMobile) {
    return <div className="desktop-fullscreen">{children}</div>;
  }
  return <PhoneShell showHome={showHome}>{children}</PhoneShell>;
}
