import { registerPlugin } from '@capacitor/core';
import { isCapacitor } from './platform';

export interface SecureStoragePlugin {
  getItem(options: { key: string }): Promise<{ value: string | null }>;
  setItem(options: { key: string; value: string }): Promise<void>;
  removeItem(options: { key: string }): Promise<void>;
  setBiometricProtectedItem(options: { key: string; value: string }): Promise<void>;
  getBiometricProtectedItem(options: {
    key: string;
    prompt?: string;
  }): Promise<{ value: string | null; cancelled?: boolean }>;
  removeBiometricProtectedItem(options: { key: string }): Promise<void>;
}

const plugin = registerPlugin<SecureStoragePlugin>('SecureStorage');

export async function secureStorageGet(key: string): Promise<string | null> {
  if (!isCapacitor()) return null;
  try {
    const { value } = await plugin.getItem({ key });
    return value ?? null;
  } catch {
    return null;
  }
}

export async function secureStorageSet(key: string, value: string): Promise<boolean> {
  if (!isCapacitor()) return false;
  try {
    await plugin.setItem({ key, value });
    return true;
  } catch {
    return false;
  }
}

export async function secureStorageRemove(key: string): Promise<void> {
  if (!isCapacitor()) return;
  try {
    await plugin.removeItem({ key });
  } catch {
    /* ignore */
  }
}

export async function secureStorageSetBiometric(key: string, value: string): Promise<boolean> {
  if (!isCapacitor()) return false;
  try {
    await plugin.setBiometricProtectedItem({ key, value });
    return true;
  } catch {
    return false;
  }
}

export async function secureStorageGetBiometric(
  key: string,
  prompt = 'Unlock Chat2Chat',
): Promise<string | null> {
  if (!isCapacitor()) return null;
  try {
    const { value } = await plugin.getBiometricProtectedItem({ key, prompt });
    return value ?? null;
  } catch {
    return null;
  }
}

export async function secureStorageRemoveBiometric(key: string): Promise<void> {
  if (!isCapacitor()) return;
  try {
    await plugin.removeBiometricProtectedItem({ key });
  } catch {
    /* ignore */
  }
}
