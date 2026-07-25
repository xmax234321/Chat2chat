import { isCellularDataGranted, readCellularDataStatus, type CellularDataStatus } from './cellular-permission';
import {
  isDevicePermissionBlocked,
  isDevicePermissionGranted,
  openAppSettings,
  readCameraPermissionStatus,
  readMicrophonePermissionStatus,
  requestCameraPermission,
  requestMicrophonePermission,
  type DevicePermissionStatus,
} from './device-permissions';
import {
  isGalleryPermissionGranted,
  readGalleryPermissionStatus,
  requestGalleryPermission,
  type GalleryPermissionStatus,
} from './gallery-assets';

async function promptDevicePermission(
  request: () => Promise<DevicePermissionStatus>,
  read: () => Promise<DevicePermissionStatus>,
): Promise<DevicePermissionStatus> {
  const requested = await request();
  if (isDevicePermissionGranted(requested)) return requested;

  const latest = await read();
  if (isDevicePermissionBlocked(latest)) {
    await openAppSettings();
    return read();
  }
  return latest;
}

export async function promptCameraPermission(): Promise<DevicePermissionStatus> {
  return promptDevicePermission(requestCameraPermission, readCameraPermissionStatus);
}

export async function promptMicrophonePermission(): Promise<DevicePermissionStatus> {
  return promptDevicePermission(requestMicrophonePermission, readMicrophonePermissionStatus);
}

export async function promptGalleryPermission(): Promise<GalleryPermissionStatus> {
  const requested = await requestGalleryPermission();
  if (isGalleryPermissionGranted(requested)) return requested;

  const latest = await readGalleryPermissionStatus();
  if (latest === 'denied' || latest === 'restricted') {
    await openAppSettings();
    return readGalleryPermissionStatus();
  }
  return latest;
}

export async function promptCellularAccess(): Promise<CellularDataStatus> {
  const status = await readCellularDataStatus();
  if (isCellularDataGranted(status)) return status;
  await openAppSettings();
  return readCellularDataStatus();
}
