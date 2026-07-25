import { registerPlugin } from '@capacitor/core';
import type { AppIconStyle } from './app-icon-styles';

export interface AppIconPlugin {
  setAlternateIcon(options: { style: AppIconStyle }): Promise<{ style: AppIconStyle; iosName: string | null }>;
  getAlternateIcon(): Promise<{ style: AppIconStyle; iosName: string | null }>;
}

export const NativeAppIcon = registerPlugin<AppIconPlugin>('AppIcon');
