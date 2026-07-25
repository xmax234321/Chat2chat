import { registerPlugin } from '@capacitor/core';

export interface ScreenshotProtectionPlugin {
  setEnabled(options: { enabled: boolean }): Promise<void>;
}

export const ScreenshotProtection = registerPlugin<ScreenshotProtectionPlugin>('ScreenshotProtection');

export async function setScreenshotProtectionEnabled(enabled: boolean): Promise<void> {
  try {
    await ScreenshotProtection.setEnabled({ enabled });
  } catch {
    // Web / unsupported platform
  }
}
