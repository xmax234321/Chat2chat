import { isCapacitor } from './platform';
import type { CellularDataStatus } from './native-network-status';

export type { CellularDataStatus };

function normalizeCellularStatus(status: unknown): CellularDataStatus {
  if (status === 'authorized' || status === 'denied' || status === 'unknown') return status;
  return 'unknown';
}

export function isCellularDataGranted(status: CellularDataStatus): boolean {
  return status === 'authorized';
}

export async function readCellularDataStatus(): Promise<CellularDataStatus> {
  if (!isCapacitor()) return 'authorized';
  try {
    const { NetworkStatus } = await import('./native-network-status');
    const { status } = await NetworkStatus.getCellularDataStatus();
    return normalizeCellularStatus(status);
  } catch {
    return 'unknown';
  }
}

/** True only when iOS reports cellular data is not restricted for this app. */
export async function readCellularDataAllowed(): Promise<boolean> {
  return isCellularDataGranted(await readCellularDataStatus());
}
