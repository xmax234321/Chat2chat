import { Capacitor } from '@capacitor/core';
import { PhotoGallery } from './native-photo-gallery';
import { isIosCapacitor } from './platform';

export async function startNativeVoiceRecord(): Promise<void> {
  if (!isIosCapacitor()) throw new Error('Native voice recording is only available on iOS');
  const plugin = PhotoGallery as typeof PhotoGallery & {
    startVoiceRecord(): Promise<void>;
  };
  await plugin.startVoiceRecord();
}

export async function stopNativeVoiceRecord(): Promise<{ path: string; durationMs: number }> {
  if (!isIosCapacitor()) throw new Error('Native voice recording is only available on iOS');
  const plugin = PhotoGallery as typeof PhotoGallery & {
    stopVoiceRecord(): Promise<{ path: string; durationMs: number }>;
  };
  return plugin.stopVoiceRecord();
}

export async function cancelNativeVoiceRecord(): Promise<void> {
  if (!isIosCapacitor()) return;
  const plugin = PhotoGallery as typeof PhotoGallery & {
    cancelVoiceRecord(): Promise<void>;
  };
  await plugin.cancelVoiceRecord().catch(() => {});
}

export async function readNativeVoiceBytes(path: string): Promise<Uint8Array> {
  const { base64 } = await PhotoGallery.readPick({ path, offset: 0, maxBytes: 32 * 1024 * 1024 });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function nativeVoiceFileUrl(path: string): string {
  return Capacitor.convertFileSrc(path);
}
