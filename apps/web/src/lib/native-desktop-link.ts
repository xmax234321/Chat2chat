import { registerPlugin } from '@capacitor/core';

export interface DesktopLinkPlugin {
  connect(options: {
    serviceUuid: string;
    rxUuid: string;
    txUuid: string;
    deviceNamePrefix?: string;
  }): Promise<{ connected: boolean; deviceName?: string }>;

  disconnect(): Promise<void>;

  write(options: { value: string }): Promise<void>;

  addListener(
    eventName: 'message',
    listener: (event: { value: string }) => void,
  ): Promise<{ remove: () => void }>;

  isConnected(): Promise<{ connected: boolean }>;
}

export const NativeDesktopLink = registerPlugin<DesktopLinkPlugin>('DesktopLink');
