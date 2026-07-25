import { isCapacitor } from './platform';
import type { CellularDataStatus } from './native-network-status';
import type { DevicePermissionStatus, GalleryPermissionStatus } from './native-photo-gallery';
import { readCellularDataStatus } from './cellular-permission';
import { readCameraPermissionStatus, readMicrophonePermissionStatus } from './device-permissions';
import { readGalleryPermissionStatus } from './gallery-assets';

export type PermissionStatuses = {
  camera: DevicePermissionStatus;
  microphone: DevicePermissionStatus;
  photos: GalleryPermissionStatus;
  cellular: CellularDataStatus;
};

function normalizeDeviceStatus(status: unknown): DevicePermissionStatus {
  if (status === 'authorized' || status === 'denied' || status === 'restricted' || status === 'not_determined') {
    return status;
  }
  return 'denied';
}

function normalizeGalleryStatus(status: unknown): GalleryPermissionStatus {
  if (
    status === 'authorized' ||
    status === 'limited' ||
    status === 'denied' ||
    status === 'restricted' ||
    status === 'not_determined'
  ) {
    return status;
  }
  return 'denied';
}

export async function readAllPermissionStatuses(): Promise<PermissionStatuses> {
  if (!isCapacitor()) {
    return {
      camera: 'authorized',
      microphone: 'authorized',
      photos: 'authorized',
      cellular: 'authorized',
    };
  }

  try {
    const { PhotoGallery } = await import('./native-photo-gallery');
    const [native, cellular] = await Promise.all([
      PhotoGallery.getPermissionStatuses(),
      readCellularDataStatus(),
    ]);
    return {
      camera: normalizeDeviceStatus(native.camera),
      microphone: normalizeDeviceStatus(native.microphone),
      photos: normalizeGalleryStatus(native.photos),
      cellular,
    };
  } catch {
    const [cellular, camera, microphone, photos] = await Promise.all([
      readCellularDataStatus(),
      readCameraPermissionStatus(),
      readMicrophonePermissionStatus(),
      readGalleryPermissionStatus(),
    ]);
    return { camera, microphone, photos, cellular };
  }
}
