import { useCallback, useEffect, useState } from 'react';
import { SFCameraFill, SFMicrophoneFill } from 'sf-symbols-lib/monochrome';
import { PermissionAccessRow } from './PermissionAccessRow';
import { SfAntennaIcon, SfPhotoIcon } from './settings/SettingsSfIcons';
import { usePermissionAutoRefresh } from '../hooks/usePermissionAutoRefresh';
import { isCellularDataGranted } from '../lib/cellular-permission';
import { isDevicePermissionGranted } from '../lib/device-permissions';
import { isGalleryPermissionGranted } from '../lib/gallery-assets';
import { readAllPermissionStatuses } from '../lib/permission-status';
import {
  promptCameraPermission,
  promptCellularAccess,
  promptGalleryPermission,
  promptMicrophonePermission,
} from '../lib/permission-prompt';

const CAMERA_COLOR = '#34C759';
const MIC_COLOR = '#FF9500';
const PHOTO_COLOR = '#FF9F0A';
const CELLULAR_COLOR = '#0A84FF';

type Props = {
  variant?: 'sheet' | 'settings';
  active?: boolean;
};

export function PermissionsSettingsContent({ variant = 'sheet', active = true }: Props) {
  const [ready, setReady] = useState(false);
  const [cellularGranted, setCellularGranted] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [micGranted, setMicGranted] = useState(false);
  const [galleryGranted, setGalleryGranted] = useState(false);

  const refresh = useCallback(async () => {
    const statuses = await readAllPermissionStatuses();
    setCellularGranted(isCellularDataGranted(statuses.cellular));
    setCameraGranted(isDevicePermissionGranted(statuses.camera));
    setMicGranted(isDevicePermissionGranted(statuses.microphone));
    setGalleryGranted(isGalleryPermissionGranted(statuses.photos));
    setReady(true);
  }, []);

  usePermissionAutoRefresh(active, refresh);

  useEffect(() => {
    if (!active) {
      setReady(false);
      return;
    }
    void refresh();
  }, [active, refresh]);

  const rowClass = variant === 'settings' ? 'permission-access-row--settings' : '';

  if (active && !ready) {
    return <div className="permission-menu-loading">Loading…</div>;
  }

  return (
    <div className="permission-menu-list">
      <PermissionAccessRow
        className={rowClass}
        icon={<SfAntennaIcon size={22} color={CELLULAR_COLOR} />}
        accentColor={CELLULAR_COLOR}
        label="Cellular data"
        granted={cellularGranted}
        onPress={() => {
          void (async () => {
            await promptCellularAccess();
            await refresh();
          })();
        }}
      />
      <PermissionAccessRow
        className={rowClass}
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
      <PermissionAccessRow
        className={rowClass}
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
      <PermissionAccessRow
        className={rowClass}
        icon={<SfPhotoIcon size={22} color={PHOTO_COLOR} />}
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
    </div>
  );
}
