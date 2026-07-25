import { useEffect } from 'react';
import { isCapacitor } from '../lib/platform';
import { setScreenshotProtectionEnabled } from '../lib/native-screenshot-protection';

/** @deprecated Use route-based ScreenshotProtectionSync instead. */
export function useAllowScreenshots(allow: boolean): void {
  useEffect(() => {
    if (!isCapacitor()) return;
    void setScreenshotProtectionEnabled(!allow);
    return () => {
      void setScreenshotProtectionEnabled(false);
    };
  }, [allow]);
}
