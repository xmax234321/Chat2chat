import {
  isDevicePermissionBlocked,
  isDevicePermissionGranted,
  readCameraPermissionStatus,
  readMicrophonePermissionStatus,
  requestCameraPermission,
  requestMicrophonePermission,
} from './device-permissions';

export type MediaCaptureAccess = 'granted' | 'blocked' | 'denied';

export async function isMediaCaptureBlocked(includeMic = false): Promise<boolean> {
  const camera = await readCameraPermissionStatus();
  if (isDevicePermissionBlocked(camera)) return true;
  if (!includeMic) return false;
  const mic = await readMicrophonePermissionStatus();
  return isDevicePermissionBlocked(mic);
}

/** Camera only — enough to open the native camera for photos (Telegram-style). */
export async function ensureCameraCaptureAccess(): Promise<boolean> {
  let camera = await readCameraPermissionStatus();
  if (isDevicePermissionBlocked(camera)) return false;
  if (camera === 'not_determined') camera = await requestCameraPermission();
  return isDevicePermissionGranted(camera);
}

export async function requestMediaCaptureAccess(includeMic = false): Promise<boolean> {
  let camera = await readCameraPermissionStatus();
  if (camera === 'not_determined') camera = await requestCameraPermission();
  if (!isDevicePermissionGranted(camera)) return false;

  if (!includeMic) return true;

  let mic = await readMicrophonePermissionStatus();
  if (mic === 'not_determined') mic = await requestMicrophonePermission();
  return isDevicePermissionGranted(mic);
}

/** @deprecated Prefer ensureCameraCaptureAccess for take-shot flows. */
export async function ensureMediaCaptureAccess(includeMic = false): Promise<boolean> {
  if (await isMediaCaptureBlocked(includeMic)) return false;

  const camera = await readCameraPermissionStatus();
  if (!isDevicePermissionGranted(camera)) {
    return requestMediaCaptureAccess(includeMic);
  }

  if (!includeMic) return true;

  const mic = await readMicrophonePermissionStatus();
  if (isDevicePermissionGranted(mic)) return true;
  return requestMediaCaptureAccess(true);
}

export async function resolveCameraCaptureAccess(): Promise<MediaCaptureAccess> {
  const camera = await readCameraPermissionStatus();
  if (isDevicePermissionBlocked(camera)) return 'blocked';
  if (isDevicePermissionGranted(camera)) return 'granted';
  if (camera === 'not_determined') {
    const next = await requestCameraPermission();
    if (isDevicePermissionGranted(next)) return 'granted';
    if (isDevicePermissionBlocked(next)) return 'blocked';
    return 'denied';
  }
  return 'denied';
}
