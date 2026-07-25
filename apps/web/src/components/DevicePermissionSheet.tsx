import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SFCameraFill, SFMicrophoneFill, SFPhoto } from 'sf-symbols-lib/monochrome';
import { PermissionAccessRow } from './PermissionAccessRow';
import { usePermissionAutoRefresh } from '../hooks/usePermissionAutoRefresh';
import { isDevicePermissionGranted } from '../lib/device-permissions';
import { isGalleryPermissionGranted } from '../lib/gallery-assets';
import { readAllPermissionStatuses } from '../lib/permission-status';
import { promptCameraPermission, promptGalleryPermission, promptMicrophonePermission } from '../lib/permission-prompt';

export type DevicePermissionNeeds = 'camera' | 'camera-and-microphone' | 'microphone' | 'photos';

type Props = {
  open: boolean;
  needs: DevicePermissionNeeds;
  onClose: () => void;
};

const COPY: Record<DevicePermissionNeeds, { title: string; text: string }> = {
  camera: {
    title: 'Camera access needed',
    text: 'Allow camera and microphone access to take photos and videos.',
  },
  'camera-and-microphone': {
    title: 'Camera & microphone needed',
    text: 'Allow camera and microphone access to take photos and videos.',
  },
  microphone: {
    title: 'Microphone access needed',
    text: 'Allow microphone access to record voice messages.',
  },
  photos: {
    title: 'Photos access needed',
    text: 'Allow access to your photo library to choose images and videos.',
  },
};

const CAMERA_COLOR = '#34C759';
const MIC_COLOR = '#FF9500';
const PHOTO_COLOR = '#FF9F0A';

function showsCamera(needs: DevicePermissionNeeds): boolean {
  return needs === 'camera' || needs === 'camera-and-microphone';
}

function showsMicrophone(needs: DevicePermissionNeeds): boolean {
  return needs === 'microphone' || needs === 'camera' || needs === 'camera-and-microphone';
}

function showsPhotos(needs: DevicePermissionNeeds): boolean {
  return needs === 'photos';
}

export function DevicePermissionSheet({ open, needs, onClose }: Props) {
  const [ready, setReady] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [micGranted, setMicGranted] = useState(false);
  const [galleryGranted, setGalleryGranted] = useState(false);

  const refresh = useCallback(async () => {
    const statuses = await readAllPermissionStatuses();
    setCameraGranted(isDevicePermissionGranted(statuses.camera));
    setMicGranted(isDevicePermissionGranted(statuses.microphone));
    setGalleryGranted(isGalleryPermissionGranted(statuses.photos));
    setReady(true);
  }, []);

  usePermissionAutoRefresh(open, refresh);

  useEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    void refresh();
  }, [open, refresh]);

  if (!open) return null;

  const copy = COPY[needs];

  return createPortal(
    <div className="permission-menu-backdrop device-permission-backdrop" onClick={onClose} role="presentation">
      <div className="permission-menu-sheet sheet-up" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="share-contact-handle" aria-hidden />
        <h2 className="permission-menu-title">{copy.title}</h2>
        <p className="device-permission-sheet-text">{copy.text}</p>
        {!ready ? (
          <div className="permission-menu-loading">Loading…</div>
        ) : (
          <div className="permission-menu-list">
            {showsCamera(needs) ? (
              <PermissionAccessRow
                icon={<SFCameraFill size={22} style={{ display: 'block' }} />}
                accentColor={CAMERA_COLOR}
                label="Camera"
                granted={cameraGranted}
                onPress={() => {
                  void (async () => {
                    await promptCameraPermission();
                    await refresh();
                  })();
                }}
              />
            ) : null}
            {showsMicrophone(needs) ? (
              <PermissionAccessRow
                icon={<SFMicrophoneFill size={22} style={{ display: 'block' }} />}
                accentColor={MIC_COLOR}
                label="Microphone"
                granted={micGranted}
                onPress={() => {
                  void (async () => {
                    await promptMicrophonePermission();
                    await refresh();
                  })();
                }}
              />
            ) : null}
            {showsPhotos(needs) ? (
              <PermissionAccessRow
                icon={<SFPhoto size={22} style={{ display: 'block', color: PHOTO_COLOR }} />}
                accentColor={PHOTO_COLOR}
                label="Photos"
                granted={galleryGranted}
                onPress={() => {
                  void (async () => {
                    await promptGalleryPermission();
                    await refresh();
                  })();
                }}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
