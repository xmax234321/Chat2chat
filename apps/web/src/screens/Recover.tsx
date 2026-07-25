import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { identityFromMnemonic } from '@chat2chat/crypto/browser';
import { AuthLayout } from '../components/AuthLayout';
import { MnemonicInput } from '../components/MnemonicInput';
import { NavHeader } from '../components/PhoneShell';
import { PhoneShell } from '../components/PhoneShell';
import { useToast } from '../components/Toast';
import { AppFolderFilePicker } from '../components/AppFolderFilePicker';
import { useApp } from '../store/AppContext';
import { useDeviceLayout } from '../hooks/useDeviceLayout';
import { homePathForDevice } from '../lib/types';
import {
  listAppFolderFiles,
  readBackupFromAppFolderEntry,
  readTextFromAppFolderEntry,
  formatAppFolderFileDate,
  formatAppFolderFileIdHint,
  type AppFolderFileEntry,
} from '../lib/app-backups-folder';
import {
  parseOwnershipProofFile,
  verifyAccountOwnership,
  verifyProofSeal,
  decryptSeedFromProof,
  type OwnershipProofFile,
} from '../lib/ownership-proof';
import { readTextFromUserFile } from '../lib/read-user-file';
import { BACKUP_MIN_PASSWORD } from '../lib/backup';
import { isElectron, isNativeMobile } from '../lib/platform';

type RecoverMode = 'choose' | 'manual' | 'file';

function modeFromPath(pathname: string): RecoverMode {
  if (pathname.endsWith('/manual')) return 'manual';
  if (pathname.endsWith('/file') || pathname.endsWith('/backup')) return 'file';
  return 'choose';
}

export function RecoverScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const layout = useDeviceLayout();
  const mode = modeFromPath(location.pathname);

  const shell = (children: ReactNode, back?: () => void) => {
    if (layout === 'computer') {
      return (
        <AuthLayout onBack={back ?? (() => navigate('/'))}>
          <div className="auth-panel-inner centered-content">{children}</div>
        </AuthLayout>
      );
    }
    return (
      <PhoneShell>
        <NavHeader onBack={back ?? (() => navigate('/'))} />
        <div className="screen-body screen-pad scroll-area centered-content">{children}</div>
      </PhoneShell>
    );
  };

  if (mode === 'choose') {
    return shell(
      <>
        <h2 className={layout === 'computer' ? 'auth-title' : 'title'}>Recover</h2>
        <p className={layout === 'computer' ? 'auth-subtitle' : 'subtitle'}>
          Enter your ID and seed phrase, or load a file from the app folder.
        </p>
        <button type="button" className="btn-primary" style={{ marginTop: 24 }} onClick={() => navigate('/recover/manual')}>
          Manually
        </button>
        <button type="button" className="btn-secondary" style={{ marginTop: 12 }} onClick={() => navigate('/recover/file')}>
          Recover with file
        </button>
      </>,
    );
  }

  if (mode === 'manual') {
    return shell(<RecoverOwnershipForm mode="manual" />, () => navigate('/recover'));
  }

  return shell(<RecoverWithFileForm />, () => navigate('/recover'));
}

type FileRecoverPhase = 'scanning' | 'pick-backup' | 'backup' | 'login' | 'manual';

function RecoverWithFileForm() {
  const navigate = useNavigate();
  const layout = useDeviceLayout();
  const { show } = useToast();
  const { restoreBackup } = useApp();

  const [phase, setPhase] = useState<FileRecoverPhase>('scanning');
  const [backupEntries, setBackupEntries] = useState<AppFolderFileEntry[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<AppFolderFileEntry | null>(null);
  const [selectedLogin, setSelectedLogin] = useState<AppFolderFileEntry | null>(null);
  const [backupPassword, setBackupPassword] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [scanNote, setScanNote] = useState('');

  const scanStartedRef = useRef(false);

  useEffect(() => {
    if (scanStartedRef.current) return;
    scanStartedRef.current = true;

    if (!isNativeMobile() && !isElectron()) {
      setPhase('manual');
      return;
    }

    void (async () => {
      const backups = await listAppFolderFiles('backup');
      if (backups.length > 0) {
        setBackupEntries(backups);
        setSelectedBackup(backups.length === 1 ? backups[0] : null);
        setPhase(backups.length === 1 ? 'backup' : 'pick-backup');
        return;
      }

      setScanNote('No backups found in app folder.');
      const logins = await listAppFolderFiles('login');
      if (logins.length > 0) {
        setSelectedLogin(logins.length === 1 ? logins[0] : null);
        setPhase('login');
        return;
      }

      setScanNote('No backups or login files in app folder. Choose a file manually.');
      setPhase('manual');
    })();
  }, []);

  const restoreFromBackupEntry = async (entry: AppFolderFileEntry) => {
    if (backupPassword.length < BACKUP_MIN_PASSWORD) {
      show(`Enter backup password (min ${BACKUP_MIN_PASSWORD} characters)`);
      return;
    }
    if (!window.confirm('Replace all chats on this device with the backup?')) return;
    setBackupBusy(true);
    try {
      const picked = await readBackupFromAppFolderEntry(entry);
      await restoreBackup(backupPassword, picked);
      show('Backup restored');
      navigate(homePathForDevice(layout));
    } catch (e) {
      show(e instanceof Error ? e.message : 'Restore failed');
    } finally {
      setBackupBusy(false);
    }
  };

  if (phase === 'scanning') {
    return (
      <>
        <h2 className={layout === 'computer' ? 'auth-title' : 'title'}>Recover with file</h2>
        <p className={layout === 'computer' ? 'auth-subtitle' : 'subtitle'}>Searching app folder…</p>
      </>
    );
  }

  if (phase === 'pick-backup') {
    return (
      <>
        <h2 className={layout === 'computer' ? 'auth-title' : 'title'}>Choose backup</h2>
        <p className={layout === 'computer' ? 'auth-subtitle' : 'subtitle'}>
          Pick a backup from this device.
        </p>
        <AppFolderFilePicker
          title="Backups"
          entries={backupEntries}
          onSelect={(entry) => {
            setSelectedBackup(entry);
            setPhase('backup');
          }}
        />
      </>
    );
  }

  if (phase === 'backup') {
    const entry = selectedBackup ?? backupEntries[0];
    if (!entry) {
      setPhase('manual');
      return null;
    }
    return (
      <>
        <h2 className={layout === 'computer' ? 'auth-title' : 'title'}>Restore backup</h2>
        <p className={layout === 'computer' ? 'auth-subtitle' : 'subtitle'}>
          {formatAppFolderFileDate(entry.modifiedAt)} · {formatAppFolderFileIdHint(entry.name)}
        </p>
        <input
          className="input-field"
          style={{ marginTop: 16 }}
          type="password"
          placeholder={`Backup password (min ${BACKUP_MIN_PASSWORD} chars)`}
          value={backupPassword}
          autoComplete="current-password"
          onChange={(e) => setBackupPassword(e.target.value)}
        />
        {backupEntries.length > 1 ? (
          <button
            type="button"
            className="app-folder-picker-cancel"
            style={{ marginTop: 12 }}
            onClick={() => setPhase('pick-backup')}
          >
            Change backup
          </button>
        ) : null}
        <button
          type="button"
          className="btn-primary"
          style={{ marginTop: 16 }}
          disabled={backupBusy || backupPassword.length < BACKUP_MIN_PASSWORD}
          onClick={() => void restoreFromBackupEntry(entry)}
        >
          {backupBusy ? 'Restoring…' : 'Restore backup'}
        </button>
      </>
    );
  }

  if (phase === 'login') {
    return (
      <RecoverOwnershipForm
        mode="file"
        initialLoginEntry={selectedLogin ?? undefined}
        scanNote={scanNote}
        onManualFallback={() => setPhase('manual')}
      />
    );
  }

  return (
    <RecoverOwnershipForm mode="file" scanNote={scanNote} onManualFallback={() => setPhase('manual')} />
  );
}

function RecoverOwnershipForm({
  mode,
  initialLoginEntry,
  scanNote,
  onManualFallback,
}: {
  mode: 'manual' | 'file';
  initialLoginEntry?: AppFolderFileEntry;
  scanNote?: string;
  onManualFallback?: () => void;
}) {
  const navigate = useNavigate();
  const layout = useDeviceLayout();
  const { show } = useToast();
  const { recoverAccount, finishOnboarding } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const autoLoadedRef = useRef<string | null>(null);
  const folderScanRef = useRef(false);

  const [proof, setProof] = useState<OwnershipProofFile | null>(null);
  const [userId, setUserId] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [unlockedMnemonic, setUnlockedMnemonic] = useState('');
  const [complete, setComplete] = useState(false);
  const [seedUnlocked, setSeedUnlocked] = useState(false);
  const [filePassword, setFilePassword] = useState('');
  const [error, setError] = useState('');
  const [loginEntries, setLoginEntries] = useState<AppFolderFileEntry[]>([]);
  const [showLoginPicker, setShowLoginPicker] = useState(false);
  const [loadedEntryName, setLoadedEntryName] = useState<string | null>(null);

  const idLocked = mode === 'file' && Boolean(proof);
  const hasEncryptedSeed = Boolean(proof?.seedCipher);
  const showManualSeedInput = mode === 'manual' || (mode === 'file' && proof !== null && !hasEncryptedSeed);
  const seedReady = hasEncryptedSeed ? seedUnlocked && Boolean(unlockedMnemonic) : complete;

  useEffect(() => {
    if (mode !== 'manual' || !complete || userId.trim()) return;
    try {
      setUserId(identityFromMnemonic(mnemonic.trim().toLowerCase()).userId);
    } catch {
      /* invalid mnemonic */
    }
  }, [mode, complete, mnemonic, userId]);

  const loadFromText = (text: string, sourceName?: string, options?: { silent?: boolean }) => {
    try {
      const doc = parseOwnershipProofFile(text);
      setProof(doc);
      setUserId(doc.userId);
      setMnemonic('');
      setUnlockedMnemonic('');
      setComplete(false);
      setSeedUnlocked(false);
      setFilePassword('');
      setError('');
      setLoadedEntryName(sourceName ?? null);
      if (!options?.silent) {
        show(doc.seedCipher ? 'Login file loaded' : 'File loaded');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load file';
      setError(msg);
      show(msg);
    }
  };

  const loadFromEntry = async (entry: AppFolderFileEntry, options?: { silent?: boolean }) => {
    if (autoLoadedRef.current === entry.name) return;
    try {
      const text = await readTextFromAppFolderEntry(entry);
      autoLoadedRef.current = entry.name;
      loadFromText(text, entry.name, options);
      setShowLoginPicker(false);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not load file');
    }
  };

  useEffect(() => {
    if (mode !== 'file') return;

    if (initialLoginEntry) {
      if (autoLoadedRef.current === initialLoginEntry.name) return;
      void loadFromEntry(initialLoginEntry, { silent: true });
      return;
    }

    if (folderScanRef.current) return;
    folderScanRef.current = true;

    void (async () => {
      const logins = await listAppFolderFiles('login');
      setLoginEntries(logins);
      if (logins.length === 1) {
        await loadFromEntry(logins[0], { silent: true });
      } else if (logins.length > 1) {
        setShowLoginPicker(true);
      }
    })();
  }, [initialLoginEntry?.name, mode]);

  const tryUnlockSeed = async (unlockRaw: string) => {
    if (!proof?.seedCipher) return;
    try {
      const m = await decryptSeedFromProof(proof, unlockRaw);
      const derivedId = identityFromMnemonic(m).userId;
      if (derivedId !== proof.userId) throw new Error('Seed does not match file ID');
      if (!verifyProofSeal(proof, m)) throw new Error('Seed does not match login file');
      setUnlockedMnemonic(m);
      setSeedUnlocked(true);
      setComplete(true);
      setError('');
      show('Seed unlocked from file');
    } catch {
      setUnlockedMnemonic('');
      setError('Could not unlock seed — wrong file password');
      setSeedUnlocked(false);
      setComplete(false);
    }
  };

  const loadFile = async (file: File) => {
    try {
      const text = await readTextFromUserFile(file);
      loadFromText(text, file.name);
      setShowLoginPicker(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load file';
      setError(msg);
      show(msg);
    }
  };

  const recover = async () => {
    setError('');
    let mnemonicToUse: string;
    if (mode === 'file' && proof?.seedCipher) {
      if (!seedUnlocked || !unlockedMnemonic) {
        setError('Unlock seed from file first');
        return;
      }
      try {
        mnemonicToUse = await decryptSeedFromProof(proof, filePassword);
      } catch {
        setError('Could not decrypt seed — wrong file password');
        return;
      }
      if (!verifyProofSeal(proof, mnemonicToUse)) {
        setError('Decrypted seed does not match login file');
        return;
      }
      if (identityFromMnemonic(mnemonicToUse).userId !== proof.userId) {
        setError('Seed does not match file ID');
        return;
      }
    } else {
      mnemonicToUse = mnemonic.trim().toLowerCase();
    }

    const check = verifyAccountOwnership({ userId: userId.trim(), mnemonic: mnemonicToUse, proof });
    if (!check.ok) {
      setError(check.reason ?? 'Verification failed');
      return;
    }
    try {
      recoverAccount(mnemonicToUse);
      finishOnboarding();
      navigate(homePathForDevice(layout));
    } catch {
      setError('Invalid seed phrase');
    }
  };

  const title = mode === 'manual' ? 'Manually' : 'Recover with file';
  const subtitle =
    mode === 'manual'
      ? 'Enter your ID and 12-word seed phrase.'
      : proof?.seedCipher
        ? 'Enter the file password to unlock your seed.'
        : 'This file has no encrypted seed — enter your seed phrase manually.';

  return (
    <>
      <h2 className={layout === 'computer' ? 'auth-title' : 'title'}>{title}</h2>
      <p className={layout === 'computer' ? 'auth-subtitle' : 'subtitle'}>{scanNote || subtitle}</p>

      {mode === 'file' && showLoginPicker && loginEntries.length > 1 && !proof && (
        <AppFolderFilePicker
          title="Login files in app folder"
          entries={loginEntries}
          onSelect={(entry) => void loadFromEntry(entry)}
          onCancel={() => {
            setShowLoginPicker(false);
            onManualFallback?.();
          }}
        />
      )}

      {mode === 'file' && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.c2cproof.json,application/json,text/plain,*/*"
            className="hidden-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadFile(f);
              e.target.value = '';
            }}
          />
          <button type="button" className="btn-secondary" style={{ marginTop: 16 }} onClick={() => fileRef.current?.click()}>
            Choose login file
          </button>
          {loginEntries.length > 1 && proof ? (
            <button
              type="button"
              className="btn-ghost"
              style={{ marginTop: 10, width: '100%' }}
              onClick={() => setShowLoginPicker(true)}
            >
              Choose another login file
            </button>
          ) : null}
        </>
      )}

      {loadedEntryName && mode === 'file' ? (
        <p className="subtitle" style={{ fontSize: 13, marginTop: 12 }}>Loaded: {loadedEntryName}</p>
      ) : null}

      {(mode === 'manual' || proof !== null) && (
        <>
          <div className="label-caps" style={{ marginTop: 20, marginBottom: 8 }}>Your ID</div>
          {idLocked ? (
            <div className="mono-box" style={{ fontSize: 10 }}>{userId}</div>
          ) : (
            <input
              className="input-field"
              placeholder="c2c_…"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setError('');
              }}
            />
          )}

          {mode === 'file' && proof?.seedCipher && (
            <>
              <div className="label-caps" style={{ marginTop: 20, marginBottom: 8 }}>File password</div>
              <input
                className="input-field"
                type="password"
                placeholder="Password you chose when saving the file"
                value={filePassword}
                onChange={(e) => {
                  setFilePassword(e.target.value);
                  setSeedUnlocked(false);
                  setUnlockedMnemonic('');
                  setComplete(false);
                  setError('');
                }}
              />
              <button
                type="button"
                className="btn-secondary"
                style={{ marginTop: 10 }}
                onClick={() => void tryUnlockSeed(filePassword)}
                disabled={filePassword.length < 6}
              >
                Unlock seed
              </button>
            </>
          )}

          {(showManualSeedInput || hasEncryptedSeed) && (
            <>
              <div className="label-caps" style={{ marginTop: 20, marginBottom: 8 }}>Seed phrase</div>
              {showManualSeedInput ? (
                <MnemonicInput
                  value={mnemonic}
                  onChange={(v) => {
                    setMnemonic(v);
                    setError('');
                  }}
                  onCompleteChange={setComplete}
                />
              ) : (
                <p style={{ fontSize: 13, color: seedUnlocked ? '#7FB88A' : '#9C9C9A' }}>
                  {seedUnlocked
                    ? 'Seed verified — matches your login file.'
                    : 'Unlock with your file password above.'}
                </p>
              )}
            </>
          )}

          {error && <p className="form-error">{error}</p>}
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: 24 }}
            onClick={() => void recover()}
            disabled={!seedReady || !userId.trim().startsWith('c2c_') || (hasEncryptedSeed && filePassword.length < 6)}
          >
            Restore identity
          </button>
        </>
      )}
    </>
  );
}
