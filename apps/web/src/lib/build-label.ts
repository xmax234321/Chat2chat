import { isCapacitor } from './platform';

export function getAppBuildLabel(): string | undefined {
  if (!isCapacitor()) return undefined;
  const id = import.meta.env.VITE_APP_BUILD_ID?.trim();
  return id || undefined;
}

/** Display build label as-is (VITE_APP_BUILD_ID already includes "dev build …"). */
export function formatBuildLabel(): string | undefined {
  return getAppBuildLabel();
}
