import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { shouldBlockScreenshots } from '../lib/screenshot-protection-routes';
import { isCapacitor } from '../lib/platform';
import { setScreenshotProtectionEnabled } from '../lib/native-screenshot-protection';

/** Syncs native screenshot blocking with the current route. */
export function ScreenshotProtectionSync() {
  const { pathname } = useLocation();
  const block = shouldBlockScreenshots(pathname);

  useEffect(() => {
    if (!isCapacitor()) return;
    void setScreenshotProtectionEnabled(block);
  }, [block]);

  return null;
}
