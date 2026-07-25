import { isCapacitor } from './platform';
import { loadAppLockPreferences } from './app-lock-settings';

export type BiometricAuthResult = {
  success: boolean;
  error?: 'unavailable' | 'cancelled' | 'failed' | 'plugin';
};

async function getPlugin() {
  const { BiometricAuth } = await import('./native-biometric-auth');
  return BiometricAuth;
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!isCapacitor()) return false;
  try {
    const plugin = await getPlugin();
    const result = await plugin.isAvailable();
    return Boolean(result.available);
  } catch {
    return false;
  }
}

export async function authenticateBiometric(
  reason = 'Unlock Chat2Chat',
  mode: 'unlock' | 'enable' = 'unlock',
): Promise<BiometricAuthResult> {
  if (!isCapacitor()) return { success: false, error: 'unavailable' };
  try {
    const plugin = await getPlugin();
    const available = await plugin.isAvailable();
    if (!available.available) return { success: false, error: 'unavailable' };
    const result = await plugin.authenticate({ reason, mode });
    if (result.success) return { success: true };
    return { success: false, error: result.error ?? 'failed' };
  } catch {
    return { success: false, error: 'plugin' };
  }
}

export async function tryBiometricUnlock(): Promise<boolean> {
  if (!isCapacitor() || !loadAppLockPreferences().faceIdEnabled) return false;
  const result = await authenticateBiometric('Unlock Chat2Chat', 'unlock');
  return result.success;
}
