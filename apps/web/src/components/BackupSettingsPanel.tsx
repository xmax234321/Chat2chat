import { useEffect, useMemo, useRef, useState } from 'react';
import { ToggleSwitch } from './ToggleSwitch';
import { useToast } from './Toast';
import { AppFolderFilePicker } from './AppFolderFilePicker';
import { useApp } from '../store/AppContext';
import {
  APP_BACKUPS_FOLDER_HINT,
  BACKUP_MIN_PASSWORD,
  formatBackupExclusionNotice,
  pickBackupFile,
  openBackupFromUserFile,
  sharePreparedBackup,
  type PreparedBackupShare,
} from '../lib/backup';
import {
  listAppFolderFiles,
  readBackupFromAppFolderEntry,
  shareAppFolderFile,
  type AppFolderFileEntry,
} from '../lib/app-backups-folder';
import { scorePassword } from '../lib/password-strength';
import { isElectron, isIosCapacitor, isNativeMobile } from '../lib/platform';
import { BackupIcon } from './Icons';

type Screen = 'menu' | 'password' | 'restore' | 'saved';

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12M7 8l5 5 5-5M5 21h14" />
    </svg>
  );
}

function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="backup-dc-field">
      <input
        className="backup-dc-field-input"
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="backup-dc-field-eye"
        aria-label={visible ? 'Hide password' : 'Show password'}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ) : (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" />
            <path d="M1 1l22 22" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          </svg>
        )}
      </button>
    </div>
  );
}

export function BackupSettingsPanel() {
  const { prepareBackup, saveBackupDesktop, shareBackup, restoreBackup, settings, toggleBackupNotifications } =
    useApp();
  const { show } = useToast();

  const [screen, setScreen] = useState<Screen>('menu');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [restorePassword, setRestorePassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [folderBackups, setFolderBackups] = useState<AppFolderFileEntry[]>([]);
  const [showBackupPicker, setShowBackupPicker] = useState(false);
  const [restoreNote, setRestoreNote] = useState('');
  const savedPreparedRef = useRef<PreparedBackupShare | null>(null);
  const restoreRef = useRef<HTMLInputElement>(null);

  const lastBackupLabel = settings.lastBackupAt
    ? new Date(settings.lastBackupAt).toLocaleString()
    : 'Never';

  const strength = useMemo(() => scorePassword(password), [password]);
  const canContinue = password.length >= BACKUP_MIN_PASSWORD && password === confirm;

  const resetCreateFlow = () => {
    setPassword('');
    setConfirm('');
    setError('');
    setScreen('menu');
    savedPreparedRef.current = null;
  };

  useEffect(() => {
    if (screen !== 'restore' || !isNativeMobile()) return;
    void (async () => {
      const entries = await listAppFolderFiles('backup');
      setFolderBackups(entries);
      if (entries.length === 0) {
        setRestoreNote('No backups in app folder — you can choose a file manually.');
      } else if (entries.length === 1) {
        setRestoreNote(`Found backup: ${entries[0].name}`);
      } else {
        setRestoreNote(`${entries.length} backups found in app folder.`);
        setShowBackupPicker(true);
      }
    })();
  }, [screen]);

  const restoreFromEntry = async (entry: AppFolderFileEntry) => {
    if (restorePassword.length < BACKUP_MIN_PASSWORD) {
      show('Enter backup password first');
      return;
    }
    if (!window.confirm('Replace all chats on this device with the backup?')) return;
    setBusy(true);
    try {
      const picked = await readBackupFromAppFolderEntry(entry);
      await restoreBackup(restorePassword, picked);
      setScreen('menu');
      setShowBackupPicker(false);
      show('Backup restored');
    } catch (err) {
      show(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setBusy(false);
    }
  };

  const chooseBackupFile = async () => {
    if (restorePassword.length < BACKUP_MIN_PASSWORD) {
      show('Enter backup password first');
      return;
    }

    if (isNativeMobile()) {
      const entries = folderBackups.length ? folderBackups : await listAppFolderFiles('backup');
      if (entries.length > 1) {
        setFolderBackups(entries);
        setShowBackupPicker(true);
        return;
      }
      if (entries.length === 1) {
        await restoreFromEntry(entries[0]);
        return;
      }
      show('No backups in app folder — choose a file');
    }

    if (!window.confirm('Replace all chats on this device with the backup?')) return;
    setBusy(true);
    try {
      if (isElectron() || isIosCapacitor()) {
        const picked = await pickBackupFile();
        if (!picked) return;
        await restoreBackup(restorePassword, picked);
      } else {
        restoreRef.current?.click();
        return;
      }
      setScreen('menu');
      show('Backup restored');
    } catch (err) {
      show(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setBusy(false);
    }
  };

  if (screen === 'saved' && savedPreparedRef.current) {
    const prepared = savedPreparedRef.current;
    const exclusionNotice = formatBackupExclusionNotice(prepared.exportExcludedChats ?? []);
    return (
      <div className="backup-dc-password">
        <h2 className="backup-dc-password-title">Backup saved</h2>
        <p className="backup-dc-password-sub">
          Saved to {APP_BACKUPS_FOLDER_HINT}
          {prepared.filename ? ` as ${prepared.filename}` : ''}.
        </p>
        {exclusionNotice ? (
          <p className="backup-dc-exclusion-note">{exclusionNotice}</p>
        ) : null}
        {isNativeMobile() ? (
          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: 16, width: '100%' }}
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  if (prepared.uri) {
                    await sharePreparedBackup(prepared);
                  } else {
                    await shareAppFolderFile({ filename: prepared.filename, uri: prepared.uri });
                  }
                } catch (e) {
                  show(e instanceof Error ? e.message : 'Could not open share menu');
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Choose where to save
          </button>
        ) : null}
        <button type="button" className="backup-dc-create-btn" style={{ marginTop: 12 }} onClick={resetCreateFlow}>
          Done
        </button>
      </div>
    );
  }

  if (screen === 'password') {
    return (
      <div className="backup-dc-password">
        <h2 className="backup-dc-password-title">Set password</h2>
        <p className="backup-dc-password-sub">
          {isNativeMobile()
            ? isIosCapacitor()
              ? 'Creates an encrypted ZIP with messages, contacts, identity, and photos/videos. Saved automatically to Files.'
              : 'Creates an encrypted backup with messages, contacts, and identity. Saved automatically to Files.'
            : 'Saves everything on this device: messages, contacts, identity, and media.'}
        </p>

        <div className="backup-dc-password-fields">
          <PasswordField value={password} onChange={setPassword} placeholder="Password" autoComplete="new-password" />
          <PasswordField value={confirm} onChange={setConfirm} placeholder="Confirm password" autoComplete="new-password" />
        </div>

        {password.length > 0 && (
          <div className="backup-dc-strength">
            <div className="backup-dc-strength-bars">
              {[1, 2, 3, 4].map((bar) => (
                <div
                  key={bar}
                  className="backup-dc-strength-bar"
                  style={{ background: bar <= strength.score ? strength.color : '#2a2a2d' }}
                />
              ))}
            </div>
            <span className="backup-dc-strength-label" style={{ color: strength.color }}>
              {strength.label}
            </span>
          </div>
        )}

        <div className="backup-dc-warning">If you forget the password, the backup cannot be recovered.</div>
        {error ? <div className="backup-dc-warning">{error}</div> : null}

        <button
          type="button"
          className={`backup-dc-create-btn${canContinue ? '' : ' backup-dc-create-btn-disabled'}`}
          disabled={busy || !canContinue}
          onClick={() => {
            void (async () => {
              setBusy(true);
              setError('');
              try {
                if (isNativeMobile()) {
                  const prepared = await prepareBackup(password);
                  await shareBackup(prepared);
                  savedPreparedRef.current = prepared;
                  setPassword('');
                  setConfirm('');
                  setScreen('saved');
                  return;
                }

                const result = await saveBackupDesktop(password);
                resetCreateFlow();
                const notice = formatBackupExclusionNotice(result.exportExcludedChats ?? []);
                show(notice ? `Backup saved. ${notice}` : 'Backup saved');
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Backup failed');
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          {busy ? 'Creating…' : isNativeMobile() ? 'Create backup' : 'Download backup'}
        </button>

        <button type="button" className="btn-ghost" style={{ marginTop: 10, width: '100%' }} onClick={resetCreateFlow}>
          Cancel
        </button>
      </div>
    );
  }

  if (screen === 'restore') {
    return (
      <div className="backup-dc-password">
        <h2 className="backup-dc-password-title">Restore backup</h2>
        <p className="backup-dc-password-sub">
          {restoreNote || 'Choose a backup file and enter its password. This replaces all data on this device.'}
        </p>

        {showBackupPicker && folderBackups.length > 1 ? (
          <AppFolderFilePicker
            title="Backups in app folder"
            entries={folderBackups}
            onSelect={(entry) => void restoreFromEntry(entry)}
            onCancel={() => setShowBackupPicker(false)}
          />
        ) : null}

        <input
          ref={restoreRef}
          type="file"
          accept=".json,.c2backup.json,.zip,.c2backup.zip,application/json,application/zip"
          className="attach-input-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            void (async () => {
              if (restorePassword.length < BACKUP_MIN_PASSWORD) {
                show('Enter backup password first');
                return;
              }
              if (!window.confirm('Replace all chats on this device with the backup?')) return;
              setBusy(true);
              try {
                const picked = await openBackupFromUserFile(file);
                await restoreBackup(restorePassword, picked);
                setScreen('menu');
                show('Backup restored');
              } catch (err) {
                show(err instanceof Error ? err.message : 'Restore failed');
              } finally {
                setBusy(false);
              }
            })();
          }}
        />

        <PasswordField
          value={restorePassword}
          onChange={setRestorePassword}
          placeholder="Backup password"
          autoComplete="current-password"
        />

        {folderBackups.length === 1 && !showBackupPicker ? (
          <button
            type="button"
            className="backup-dc-create-btn"
            style={{ marginTop: 20 }}
            disabled={busy || restorePassword.length < BACKUP_MIN_PASSWORD}
            onClick={() => void restoreFromEntry(folderBackups[0])}
          >
            {busy ? 'Restoring…' : 'Restore from app folder'}
          </button>
        ) : null}

        <button
          type="button"
          className={folderBackups.length === 1 ? 'btn-secondary' : 'backup-dc-create-btn'}
          style={{ marginTop: folderBackups.length === 1 ? 10 : 20, width: '100%' }}
          disabled={busy || restorePassword.length < BACKUP_MIN_PASSWORD}
          onClick={() => void chooseBackupFile()}
        >
          {busy ? 'Restoring…' : 'Choose backup file'}
        </button>

        <button type="button" className="btn-ghost" style={{ marginTop: 10, width: '100%' }} onClick={() => setScreen('menu')}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="backup-dc-overview">
      <div className="backup-dc-hero">
        <div className="backup-dc-hero-icon" aria-hidden>
          <BackupIcon size={27} />
        </div>
        <div className="backup-dc-hero-title">Create a copy of chats</div>
        <div className="backup-dc-hero-subtitle">
          {settings.lastBackupAt ? `Last backup: ${lastBackupLabel}` : 'Encrypted backup stored on this device.'}
        </div>
      </div>

      <div className="settings-group">
        <button
          type="button"
          className="backup-dc-create-btn"
          onClick={() => {
            setError('');
            setPassword('');
            setConfirm('');
            setScreen('password');
          }}
        >
          <DownloadIcon />
          Create backup
        </button>
        <button
          type="button"
          className="btn-ghost"
          style={{ marginTop: 10, width: '100%' }}
          onClick={() => {
            setRestoreNote('');
            setShowBackupPicker(false);
            setFolderBackups([]);
            setScreen('restore');
          }}
        >
          Restore from file
        </button>
      </div>

      <div className="backup-dc-note settings-group">
        {isNativeMobile()
          ? isIosCapacitor()
            ? `Backups are saved to ${APP_BACKUPS_FOLDER_HINT}. Includes photos and videos (.c2backup.zip). Chats with export blocked are omitted. Encrypted with your password only.`
            : 'Backups are saved automatically to the app folder in Files. Chats with export blocked are omitted. Encrypted with your password only.'
          : 'Saves messages, contacts, identity, and media. Chats with export blocked are omitted. Encrypted with your password only.'}
      </div>

      <div className="backup-dc-card settings-group">
        <div className="backup-dc-row">
          <div>
            <div className="backup-dc-row-title">Backup notifications</div>
            <div className="backup-dc-row-sub">Remind you when many messages accumulate</div>
          </div>
          <ToggleSwitch
            checked={Boolean(settings.backupNotificationsEnabled)}
            onChange={toggleBackupNotifications}
            ariaLabel="Backup notifications"
          />
        </div>
      </div>
    </div>
  );
}
