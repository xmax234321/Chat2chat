import type { ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import {
  FingerprintIcon,
  GridIcon,
  QrIcon,
} from '../components/Icons';
import { LogOutSheet } from '../components/LogOutSheet';
import { UpdatesSheet } from '../components/UpdatesSheet';
import { useToast } from '../components/Toast';
import { useApp } from '../store/AppContext';
import { useDeviceLayout } from '../hooks/useDeviceLayout';
import { homePathForDevice } from '../lib/types';
import { formatBuildLabel } from '../lib/build-label';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PinSetup, PinDisableButton } from '../components/PinSetup';
import { PinSettingsOptions } from '../components/PinSettingsOptions';
import { BackupSettingsPanel } from '../components/BackupSettingsPanel';
import { ExpandableUserId } from '../components/ExpandableUserId';
import { ContactRenameSheet } from '../components/ContactRenameSheet';
import { ProfileCoinAvatar } from '../components/ProfileCoinAvatar';
import { QrCodeBox, contactQrValue } from '../components/QrCodeBox';
import { useUserProfile } from '../hooks/useUserProfile';
import { loadAccountCreatedAt } from '../lib/account-created';
import { coinTierForCreatedAt } from '../lib/coin-tier';
import { resolveDisplayName } from '../lib/user-profile';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { SecurityFingerprintCard } from '../components/SecurityFingerprintCard';
import { isCapacitor } from '../lib/platform';
import {
  loadAppLockPreferences,
  saveAppLockPreferences,
} from '../lib/app-lock-settings';
import { ChatWallpaperEditor } from '../components/ChatWallpaperEditor';
import {
  SfBellBadgeIcon,
  SfHandRaisedIcon,
  SfIcloudIcon,
  SfLockIcon,
  SfLogoutCircleIcon,
  SfPaintbrushIcon,
  SfPencilIcon,
  SfQrcodeIcon,
  SfUpdateIcon,
} from '../components/settings/SettingsSfIcons';
import { PermissionsSettingsContent } from '../components/PermissionsSettingsContent';
import { PermissionsSettingsSheet } from '../components/PermissionsSettingsSheet';
import {
  SettingsCard,
  SettingsFigList,
  SettingsFigmaProfile,
  SettingsFigmaRow,
  SettingsPageHeader,
  SettingsStaticRow,
} from '../components/settings/SettingsUI';

function SettingsPanel({
  title,
  children,
  back = '/settings',
  hideTitle = false,
  hideDesktopTitle = true,
  headerAction,
}: {
  title: string;
  children: ReactNode;
  back?: string;
  hideTitle?: boolean;
  hideDesktopTitle?: boolean;
  headerAction?: ReactNode;
}) {
  const layout = useDeviceLayout();
  const navigate = useNavigate();

  if (layout === 'computer') {
    return (
      <div className="desktop-settings-panel">
        <div className="desktop-settings-panel-top">
          {!hideTitle && !hideDesktopTitle ? <h1 className="desktop-settings-panel-title">{title}</h1> : <span />}
          {headerAction ? <span className="desktop-settings-panel-action">{headerAction}</span> : null}
        </div>
        {children}
      </div>
    );
  }

  return (
    <AppShell forceMobile>
      <div className="screen-body scroll-area settings-fig-screen">
        <SettingsPageHeader title={title} onBack={() => navigate(back)} rightAction={headerAction} />
        <div className="settings-fig-page">{children}</div>
      </div>
    </AppShell>
  );
}

export function SettingsScreen() {
  const navigate = useNavigate();
  const layout = useDeviceLayout();
  const { identity, settings, logout, setPreferredDevice, appLockEnabled } = useApp();
  const back = homePathForDevice(layout);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [profileQrOpen, setProfileQrOpen] = useState(false);

  const profileQrSheet =
    profileQrOpen && identity
      ? createPortal(
          <div className="share-contact-backdrop" onClick={() => setProfileQrOpen(false)} role="presentation">
            <div
              className="share-contact-sheet user-profile-qr-sheet"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Your QR code"
            >
              <div className="share-contact-handle" aria-hidden />
              <h2 className="user-profile-qr-sheet-title">Add me</h2>
              <div className="user-profile-qr-sheet-code">
                <QrCodeBox value={contactQrValue(identity.userId)} size={220} expandable expandSize={320} />
              </div>
              <button
                type="button"
                className="attach-sheet-group attach-sheet-cancel logout-sheet-cancel"
                onClick={() => setProfileQrOpen(false)}
              >
                Close
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  const settingsMain = (
    <SettingsFigList>
      {identity && (
        <SettingsFigmaProfile
          userId={identity.userId}
          onClick={() => navigate('/settings/profile')}
          onShowQr={() => setProfileQrOpen(true)}
        />
      )}
      <SettingsFigmaRow icon={<SfLockIcon size={20} />} label="PIN" to="/settings/pin" />
      <SettingsFigmaRow
        icon={<SfHandRaisedIcon size={20} />}
        label="Permissions"
        onClick={() => setPermissionsOpen(true)}
      />
      <SettingsFigmaRow icon={<SfIcloudIcon size={20} />} label="Backup" to="/settings/backup" />
      <SettingsFigmaRow icon={<SfUpdateIcon size={20} />} label="Update" onClick={() => setUpdatesOpen(true)} />
      <SettingsFigmaRow icon={<SfBellBadgeIcon size={20} />} label="Notifications" to="/settings/notifications" />
      <SettingsFigmaRow icon={<SfPaintbrushIcon size={20} />} label="Customisation" to="/settings/customisation" />
    </SettingsFigList>
  );

  const logoutFooter = (
    <>
      <SettingsFigList className="settings-fig-footer-list">
        <SettingsFigmaRow
          icon={<SfLogoutCircleIcon size={20} />}
          label="Log out"
          onClick={() => setLogoutOpen(true)}
        />
      </SettingsFigList>
      <LogOutSheet
        open={logoutOpen}
        pinRequired={appLockEnabled}
        hasBackup={Boolean(settings.lastBackupAt)}
        onClose={() => setLogoutOpen(false)}
        onLogout={() => {
          setLogoutOpen(false);
          logout();
        }}
      />
    </>
  );

  if (layout === 'computer') {
    return (
      <div className="desktop-settings-panel desktop-settings-panel--menu">
        <div className="settings-fig-main">{settingsMain}</div>
        <div className="settings-fig-footer">{logoutFooter}</div>
        <SettingsFigList className="settings-fig-logout-spaced">
          <div className="settings-fig-row settings-fig-row--static desktop-device-toggle-wrap">
            <div className="desktop-device-toggle">
              <button
                type="button"
                className={settings.preferredDevice === 'phone' ? 'active' : ''}
                onClick={() => setPreferredDevice('phone')}
              >
                Phone layout
              </button>
              <button
                type="button"
                className={settings.preferredDevice === 'computer' ? 'active' : ''}
                onClick={() => setPreferredDevice('computer')}
              >
                Computer layout
              </button>
            </div>
          </div>
        </SettingsFigList>
        <UpdatesSheet open={updatesOpen} onClose={() => setUpdatesOpen(false)} />
        <PermissionsSettingsSheet open={permissionsOpen} onClose={() => setPermissionsOpen(false)} />
        {profileQrSheet}
      </div>
    );
  }

  return (
    <AppShell forceMobile>
      <div className="screen-body settings-fig-screen">
        <SettingsPageHeader title="Settings" onBack={() => navigate(back)} />
        <div className="settings-fig-page settings-fig-page--menu">
          <div className="settings-fig-main scroll-area">{settingsMain}</div>
          <div className="settings-fig-footer">
            {logoutFooter}
            {formatBuildLabel() && <p className="settings-build-footer">{formatBuildLabel()}</p>}
          </div>
        </div>
      </div>
      <UpdatesSheet open={updatesOpen} onClose={() => setUpdatesOpen(false)} />
      <PermissionsSettingsSheet open={permissionsOpen} onClose={() => setPermissionsOpen(false)} />
      {profileQrSheet}
    </AppShell>
  );
}

export function ProfileSettingsScreen() {
  const { identity, copyToClipboard } = useApp();
  const { show } = useToast();
  const [profile, updateProfile] = useUserProfile();
  const [renameOpen, setRenameOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const displayName = resolveDisplayName(profile.displayName);
  const createdAt = loadAccountCreatedAt();
  const coinTier = coinTierForCreatedAt(createdAt);

  const headerActions = (
    <div className="chat-list-header-actions user-profile-header-actions">
      <button type="button" className="icon-btn" onClick={() => setQrOpen(true)} aria-label="Show QR code">
        <SfQrcodeIcon size={17} />
      </button>
      <button type="button" className="icon-btn" onClick={() => setRenameOpen(true)} aria-label="Edit name">
        <SfPencilIcon size={17} />
      </button>
    </div>
  );

  return (
    <SettingsPanel title="Profile" headerAction={headerActions}>
      <div className="user-profile-page">
        <div className="user-profile-hero">
          <ProfileCoinAvatar displayName={profile.displayName} tier={coinTier} createdAt={createdAt} />
          <p className="user-profile-spin-hint">Spin and flip · back shows member since date</p>
          <h2 className="user-profile-display-name">{displayName}</h2>
          {identity ? (
            <ExpandableUserId userId={identity.userId} className="tg-profile-userid user-profile-userid" />
          ) : null}
        </div>

        <div className="tg-profile-lists user-profile-lists">
          {identity ? (
            <div className="tg-profile-group">
              <SecurityFingerprintCard
                value={identity.fingerprint}
                displayValue={identity.fingerprint.match(/.{1,5}/g)?.join(' ')}
                onCopy={async () => {
                  await copyToClipboard(identity.fingerprint);
                  show('Copied');
                }}
              />
            </div>
          ) : null}

          <p className="user-profile-qr-note">
            Tap the QR button to share your code. Compare fingerprints in person to verify it is really you.
          </p>
        </div>
      </div>

      <ContactRenameSheet
        open={renameOpen}
        title="Your name"
        initialName={profile.displayName}
        onClose={() => setRenameOpen(false)}
        onSave={(name) => {
          updateProfile({ displayName: name });
          setRenameOpen(false);
          show('Saved');
        }}
      />

      {qrOpen && identity
        ? createPortal(
            <div className="share-contact-backdrop" onClick={() => setQrOpen(false)} role="presentation">
              <div
                className="share-contact-sheet user-profile-qr-sheet"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Your QR code"
              >
                <div className="share-contact-handle" aria-hidden />
                <h2 className="user-profile-qr-sheet-title">Add me</h2>
                <div className="user-profile-qr-sheet-code">
                  <QrCodeBox value={contactQrValue(identity.userId)} size={220} expandable expandSize={320} />
                </div>
                <button
                  type="button"
                  className="attach-sheet-group attach-sheet-cancel logout-sheet-cancel"
                  onClick={() => setQrOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </SettingsPanel>
  );
}

/** @deprecated use /settings/profile */
export function MyIdSettingsScreen() {
  return <Navigate to="/settings/profile" replace />;
}

/** @deprecated Security settings moved to Profile */
export function SecuritySettingsScreen() {
  return <Navigate to="/settings/profile" replace />;
}

export function PinSettingsScreen() {
  const { appLockEnabled, enableAppLock, changeAppLockPassword, disableAppLock, lockApp } = useApp();
  const { show } = useToast();
  const [changingPin, setChangingPin] = useState(false);
  const [disablingPin, setDisablingPin] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      show(e instanceof Error ? e.message : 'Failed');
      throw e;
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsPanel title="App PIN">
      <SettingsCard className="pin-settings-panel settings-page-section">
        {!appLockEnabled ? (
          <PinSetup
            mode="create"
            busy={busy}
            onCreate={async (pin, passcodeType) => {
              await run(async () => {
                await enableAppLock(pin, passcodeType);
                show('PIN enabled');
              });
            }}
          />
        ) : changingPin ? (
          <PinSetup
            mode="change"
            busy={busy}
            onChange={async (current, next, passcodeType) => {
              await run(async () => {
                await changeAppLockPassword(current, next, passcodeType);
                setChangingPin(false);
                show('PIN updated');
              });
            }}
            onCancel={() => setChangingPin(false)}
          />
        ) : disablingPin ? (
          <>
            <PinDisableButton
              startOpen
              busy={busy}
              onDisable={async (pin) => {
                await run(async () => {
                  const ok = await disableAppLock(pin);
                  if (!ok) throw new Error('Wrong PIN');
                  setDisablingPin(false);
                  show('PIN disabled');
                });
              }}
            />
            <button type="button" className="btn-ghost pin-setup-cancel" disabled={busy} onClick={() => setDisablingPin(false)}>
              Cancel
            </button>
          </>
        ) : (
          <PinSettingsOptions
            disableBusy={busy}
            onChangePasscode={() => setChangingPin(true)}
            onDisable={() => setDisablingPin(true)}
            onLockNow={() => {
              lockApp();
              show('App locked');
            }}
          />
        )}
      </SettingsCard>
    </SettingsPanel>
  );
}

export function BackupSettingsScreen() {
  return (
    <SettingsPanel title="Backup">
      <div className="settings-page-section settings-backup-fig">
        <BackupSettingsPanel />
      </div>
    </SettingsPanel>
  );
}

export function NotificationsSettingsScreen() {
  const { settings, toggleNotifications } = useApp();

  return (
    <SettingsPanel title="Notifications">
      <SettingsFigList>
        <SettingsStaticRow
          icon={<SfBellBadgeIcon size={20} />}
          label="Push notifications"
          hint="Get notified when you receive new messages"
          trailing={
            <ToggleSwitch
              checked={settings.notificationsEnabled}
              onChange={() => toggleNotifications()}
              ariaLabel="Push notifications"
            />
          }
        />
      </SettingsFigList>
    </SettingsPanel>
  );
}

export function PermissionsSettingsScreen() {
  return (
    <SettingsPanel title="Permissions">
      <SettingsFigList>
        <SettingsCard className="settings-page-section settings-permissions-card">
          <PermissionsSettingsContent variant="settings" />
        </SettingsCard>
      </SettingsFigList>
    </SettingsPanel>
  );
}

export function UpdatesSettingsScreen() {
  const { checkForUpdates } = useApp();
  const { show } = useToast();
  const [versionInfo, setVersionInfo] = useState<{ version: string; build: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [criticalAvailable, setCriticalAvailable] = useState(false);
  const buildLabel = formatBuildLabel();
  const altStoreSource = 'https://api.chat2chat.org/altstore/source.json';

  useEffect(() => {
    if (!isCapacitor()) return;
    void import('@capacitor/app')
      .then(({ App }) => App.getInfo())
      .then((info) => setVersionInfo({ version: info.version, build: info.build }))
      .catch(() => {});
  }, []);

  const handleCheck = async () => {
    setChecking(true);
    setCheckResult(null);
    setCriticalAvailable(false);
    try {
      const result = await checkForUpdates();
      if (result.status === 'current') {
        setCheckResult(result.message ?? 'You have the latest version');
      } else if (result.status === 'available') {
        setCheckResult(result.message ?? `Update ${result.latest.version} is available`);
      } else {
        setCriticalAvailable(true);
        setCheckResult(result.message ?? `Security update ${result.latest.version} is available`);
      }
    } catch (e) {
      show(e instanceof Error ? e.message : 'Update check failed');
    } finally {
      setChecking(false);
    }
  };

  return (
    <SettingsPanel title="Updates">
      {criticalAvailable && (
        <div className="updates-critical-card settings-page-section">
          <strong>Security update available</strong>
          <p className="subtitle" style={{ marginTop: 8 }}>
            A critical update is available. Update via AltStore when you can.
          </p>
        </div>
      )}

      <SettingsFigList className="settings-page-section">
        {buildLabel && (
          <SettingsStaticRow label="Build" trailing={<span className="settings-nav-row-value">{buildLabel}</span>} />
        )}
        {versionInfo && (
          <SettingsStaticRow
            label="Version"
            trailing={
              <span className="settings-nav-row-value">
                {versionInfo.version} (build {versionInfo.build})
              </span>
            }
          />
        )}
        <SettingsFigmaRow
          icon={<SfUpdateIcon size={20} />}
          label={checking ? 'Checking…' : 'Check for updates'}
          onClick={() => void handleCheck()}
        />
        <a className="settings-fig-row" href="https://chat2chat.org/download/versions/" target="_blank" rel="noopener noreferrer">
          <span className="settings-fig-row-icon">
            <GridIcon size={17} />
          </span>
          <span className="settings-fig-row-label">Version history</span>
        </a>
        <a className="settings-fig-row" href={altStoreSource} target="_blank" rel="noopener noreferrer">
          <span className="settings-fig-row-icon">
            <QrIcon />
          </span>
          <span className="settings-fig-row-label">AltStore source</span>
        </a>
      </SettingsFigList>
      {checkResult && <p className="subtitle settings-row-note settings-page-section">{checkResult}</p>}

      <div className="settings-page-section settings-static-note">
        <div className="label-caps" style={{ marginBottom: 8 }}>
          How to update
        </div>
        <ol className="subtitle updates-steps-list">
          <li>Open AltStore and pull down on Sources to refresh the feed.</li>
          <li>Go to Browse → Chat2Chat and tap UPDATE (not only Refresh All).</li>
          <li>Wait for installation. Your data and settings are preserved.</li>
        </ol>
      </div>
    </SettingsPanel>
  );
}

export function CustomisationSettingsScreen() {
  const [prefs, setPrefs] = useState(loadAppLockPreferences);

  return (
    <SettingsPanel title="Customisation">
      <SettingsFigList>
        <SettingsCard className="settings-page-section">
          <p className="settings-section-label">Chat wallpaper</p>
          <ChatWallpaperEditor />
        </SettingsCard>
        <SettingsStaticRow
          icon={<SfPaintbrushIcon size={20} />}
          label="Entry animation"
          hint="Plays when opening the app and on the PIN screen"
          trailing={
            <ToggleSwitch
              checked={prefs.entryAnimationEnabled}
              onChange={(entryAnimationEnabled) => {
                const next = saveAppLockPreferences({ entryAnimationEnabled });
                setPrefs(next);
              }}
              ariaLabel="Entry animation"
            />
          }
        />
        {isCapacitor() && (
          <SettingsFigmaRow icon={<FingerprintIcon size={17} />} label="Replay privacy story" to="/privacy-story" />
        )}
      </SettingsFigList>
    </SettingsPanel>
  );
}
