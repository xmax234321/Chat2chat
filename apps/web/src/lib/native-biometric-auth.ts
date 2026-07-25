import { registerPlugin } from '@capacitor/core';

export type BiometryType = 'face' | 'touch' | 'none';

export interface BiometricAuthPlugin {
  isAvailable(): Promise<{ available: boolean; biometryType: BiometryType }>;
  authenticate(options?: { reason?: string; mode?: 'unlock' | 'enable' }): Promise<{
    success: boolean;
    error?: 'unavailable' | 'cancelled' | 'failed';
    code?: number;
  }>;
}

export const BiometricAuth = registerPlugin<BiometricAuthPlugin>('BiometricAuth');
