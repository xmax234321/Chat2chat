import type { DeviceLayout } from '../hooks/useDeviceLayout';
import { isDesktopShell } from './platform';

/** Account creation is phone-only; desktop clients link or recover. */
export function canCreateAccount(layout: DeviceLayout): boolean {
  if (isDesktopShell()) return false;
  return layout === 'phone';
}
