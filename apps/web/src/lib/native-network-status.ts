import { registerPlugin } from '@capacitor/core';

export type CellularDataStatus = 'authorized' | 'denied' | 'unknown';

export interface NetworkStatusPlugin {
  getStatus(): Promise<{
    online: boolean;
    wifi: boolean;
    cellular: boolean;
    cellularRestricted: boolean;
    cellularStatus?: CellularDataStatus;
  }>;
  getCellularDataStatus(): Promise<{ status: CellularDataStatus }>;
}

export const NetworkStatus = registerPlugin<NetworkStatusPlugin>('NetworkStatus');
