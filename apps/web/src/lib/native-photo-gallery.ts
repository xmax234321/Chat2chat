import { registerPlugin } from '@capacitor/core';

export interface NativePickResult {
  path: string;
  mime: string;
  fileName: string;
  isFile?: boolean;
  size?: number;
}

export interface NativePickBatchResult {
  items: NativePickResult[];
}

export interface PhotoGalleryPlugin {
  pickPhoto(): Promise<NativePickBatchResult>;
  pickVideo(): Promise<NativePickBatchResult>;
  pickMedia(): Promise<NativePickBatchResult>;
  pickFile(): Promise<NativePickBatchResult>;
  captureMedia(): Promise<NativePickBatchResult>;
  readPick(options: {
    path: string;
    offset?: number;
    maxBytes?: number;
  }): Promise<{ base64: string; size: number; offset?: number; read?: number }>;
  persistMedia(options: { path: string; messageId: string; mime: string }): Promise<{ ok: boolean; size?: number }>;
  persistMediaChunk(options: {
    messageId: string;
    base64: string;
    offset: number;
    mime?: string;
    complete?: boolean;
  }): Promise<{ ok: boolean; size: number; complete?: boolean }>;
  compressVideo(options: { path: string }): Promise<{ path: string; mime: string }>;
  videoThumbnail(options: {
    path: string;
    maxSize?: number;
    timeSec?: number;
  }): Promise<{ path: string; mime: string }>;
  saveToGallery(options: { path: string; isVideo: boolean }): Promise<void>;
  listGalleryAssets(options: {
    filter?: 'photos' | 'videos' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<{ assets: GalleryAssetInfo[]; total: number }>;
  galleryThumbnail(options: { id: string; size?: number }): Promise<{ path: string; mime: string }>;
  exportGalleryAssets(options: { ids: string[] }): Promise<NativePickBatchResult>;
  galleryAuthorizationStatus(): Promise<{ status: GalleryPermissionStatus }>;
  requestGalleryAuthorization(): Promise<{ status: GalleryPermissionStatus }>;
  cameraAuthorizationStatus(): Promise<{ status: DevicePermissionStatus }>;
  requestCameraAuthorization(): Promise<{ status: DevicePermissionStatus }>;
  microphoneAuthorizationStatus(): Promise<{ status: DevicePermissionStatus }>;
  requestMicrophoneAuthorization(): Promise<{ status: DevicePermissionStatus }>;
  getPermissionStatuses(): Promise<{
    camera: DevicePermissionStatus;
    microphone: DevicePermissionStatus;
    photos: GalleryPermissionStatus;
  }>;
  openAppSettings(): Promise<void>;
}

export type DevicePermissionStatus = 'authorized' | 'denied' | 'restricted' | 'not_determined';

export type GalleryPermissionStatus =
  | 'authorized'
  | 'limited'
  | 'denied'
  | 'restricted'
  | 'not_determined';

export interface GalleryAssetInfo {
  id: string;
  mediaType: 'photo' | 'video';
  duration?: number;
  width?: number;
  height?: number;
}

export const PhotoGallery = registerPlugin<PhotoGalleryPlugin>('PhotoGallery');
