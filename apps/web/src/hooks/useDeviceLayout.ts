import { useIsDesktop } from './useMediaQuery';
import { useApp } from '../store/AppContext';
import { isDesktopShell, isMobileShell } from '../lib/platform';

export type DeviceLayout = 'phone' | 'computer';

export function useDeviceLayout(): DeviceLayout {
  if (isMobileShell()) return 'phone';
  if (isDesktopShell()) return 'computer';
  const { settings } = useApp();
  if (settings.preferredDevice === 'phone') return 'phone';
  if (settings.preferredDevice === 'computer') return 'computer';
  const isDesktop = useIsDesktop();
  return isDesktop ? 'computer' : 'phone';
}

export function isComputerLayout(layout: DeviceLayout): boolean {
  return layout === 'computer';
}
