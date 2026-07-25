import { isCapacitor } from './platform';
import type { DevicePermissionStatus } from './native-photo-gallery';

export type { DevicePermissionStatus };

const REQUEST_TIMEOUT_MS = 30000;

function normalizePermissionStatus(status: unknown): DevicePermissionStatus {
  if (status === 'authorized' || status === 'denied' || status === 'restricted' || status === 'not_determined') {
    return status;
  }
  return 'denied';
}

async function withRequestTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      window.setTimeout(() => resolve(fallback), REQUEST_TIMEOUT_MS);
    }),
  ]);
}

async function photoGallery() {
  const { PhotoGallery } = await import('./native-photo-gallery');
  return PhotoGallery;
}

export function isDevicePermissionGranted(status: DevicePermissionStatus): boolean {
  return status === 'authorized';
}

export function isDevicePermissionBlocked(status: DevicePermissionStatus): boolean {
  return status === 'denied' || status === 'restricted';
}

async function readWebCameraStatus(): Promise<DevicePermissionStatus> {
  if (!navigator.mediaDevices?.getUserMedia) return 'denied';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((track) => track.stop());
    return 'authorized';
  } catch {
    return 'denied';
  }
}

async function readWebMicrophoneStatus(): Promise<DevicePermissionStatus> {
  if (!navigator.mediaDevices?.getUserMedia) return 'denied';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return 'authorized';
  } catch {
    return 'denied';
  }
}

export async function readCameraPermissionStatus(): Promise<DevicePermissionStatus> {
  if (!isCapacitor()) return readWebCameraStatus();
  try {
    const { status } = await (await photoGallery()).cameraAuthorizationStatus();
    return normalizePermissionStatus(status);
  } catch {
    return 'denied';
  }
}

export async function requestCameraPermission(): Promise<DevicePermissionStatus> {
  if (!isCapacitor()) return readWebCameraStatus();
  try {
    const { status } = await withRequestTimeout(
      (await photoGallery()).requestCameraAuthorization(),
      { status: 'denied' as DevicePermissionStatus },
    );
    return normalizePermissionStatus(status);
  } catch {
    return 'denied';
  }
}

export async function readMicrophonePermissionStatus(): Promise<DevicePermissionStatus> {
  if (!isCapacitor()) return readWebMicrophoneStatus();
  try {
    const { status } = await (await photoGallery()).microphoneAuthorizationStatus();
    return normalizePermissionStatus(status);
  } catch {
    return 'denied';
  }
}

export async function requestMicrophonePermission(): Promise<DevicePermissionStatus> {
  if (!isCapacitor()) return readWebMicrophoneStatus();
  try {
    const { status } = await withRequestTimeout(
      (await photoGallery()).requestMicrophoneAuthorization(),
      { status: 'denied' as DevicePermissionStatus },
    );
    return normalizePermissionStatus(status);
  } catch {
    return 'denied';
  }
}

export async function ensureCameraAccess(): Promise<boolean> {
  let status = await readCameraPermissionStatus();
  if (status === 'not_determined') {
    status = await requestCameraPermission();
  }
  return isDevicePermissionGranted(status);
}

export async function ensureCameraMicAccess(): Promise<boolean> {
  const [cameraOk, micOk] = await Promise.all([
    (async () => {
      let status = await readCameraPermissionStatus();
      if (status === 'not_determined') status = await requestCameraPermission();
      return isDevicePermissionGranted(status);
    })(),
    (async () => {
      let status = await readMicrophonePermissionStatus();
      if (status === 'not_determined') status = await requestMicrophonePermission();
      return isDevicePermissionGranted(status);
    })(),
  ]);
  return cameraOk && micOk;
}

export async function openAppSettings(): Promise<void> {
  if (!isCapacitor()) return;
  try {
    const { PhotoGallery } = await import('./native-photo-gallery');
    await PhotoGallery.openAppSettings();
    return;
  } catch {
    /* fall through */
  }
  try {
    const { App } = await import('@capacitor/app');
    if ('openUrl' in App && typeof App.openUrl === 'function') {
      await App.openUrl({ url: 'app-settings:' });
    }
  } catch {
    /* browser / unsupported */
  }
}
