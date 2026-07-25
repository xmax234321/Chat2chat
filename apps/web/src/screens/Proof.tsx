import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingLayout } from '../components/OnboardingLayout';
import { PhoneShell } from '../components/PhoneShell';
import { useToast } from '../components/Toast';
import { useApp } from '../store/AppContext';
import { useDeviceLayout } from '../hooks/useDeviceLayout';
import { homePathForDevice } from '../lib/types';
import { buildOwnershipProof, saveOwnershipProofFile } from '../lib/ownership-proof';
import { APP_BACKUPS_FOLDER_HINT } from '../lib/backup';
import { shareAppFolderFile } from '../lib/app-backups-folder';
import { isNativeMobile } from '../lib/platform';

export function ProofScreen() {
  const navigate = useNavigate();
  const layout = useDeviceLayout();
  const { show } = useToast();
  const { identity, finishOnboarding } = useApp();
  const [downloaded, setDownloaded] = useState(false);
  const [filePassword, setFilePassword] = useState('');
  const [filePassword2, setFilePassword2] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const savedFileRef = useRef<{ filename: string; uri?: string } | null>(null);

  const passwordReady = filePassword.length >= 6 && filePassword === filePassword2;

  const scrollFieldIntoView = (el: HTMLInputElement) => {
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };

  const saveFile = async () => {
    if (!identity?.mnemonic) return;
    if (!passwordReady) {
      show('Set a file password (min 6 characters, both fields must match)');
      return;
    }
    try {
      const proof = await buildOwnershipProof(identity.userId, identity.mnemonic, filePassword);
      const result = await saveOwnershipProofFile(proof);
      savedFileRef.current = { filename: result.filename, uri: result.uri };
      setDownloaded(true);
      show(isNativeMobile() ? `Login file saved — ${APP_BACKUPS_FOLDER_HINT}` : 'Login file saved');
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not save file');
    }
  };

  const shareSavedFile = async () => {
    const saved = savedFileRef.current;
    if (!saved) return;
    setShareBusy(true);
    try {
      await shareAppFolderFile(saved);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not open share menu');
    } finally {
      setShareBusy(false);
    }
  };

  if (!identity?.mnemonic) return null;

  const finish = () => {
    finishOnboarding();
    navigate(homePathForDevice(layout));
  };

  const body = downloaded ? (
    <>
      <h2 className={layout === 'computer' ? 'auth-title' : 'title'}>Login file saved</h2>
      <p className={layout === 'computer' ? 'auth-subtitle' : 'subtitle'}>
        {isNativeMobile()
          ? `Saved to ${APP_BACKUPS_FOLDER_HINT}. You can also copy it to another location.`
          : 'Your login file has been downloaded.'}
      </p>
      {savedFileRef.current?.filename ? (
        <div className="mono-box" style={{ marginTop: 16, fontSize: 10 }}>{savedFileRef.current.filename}</div>
      ) : null}
    </>
  ) : (
    <>
      <h2 className={layout === 'computer' ? 'auth-title' : 'title'}>Your login file</h2>
      <p className={layout === 'computer' ? 'auth-subtitle' : 'subtitle'}>
        Save this file to recover later. Your seed phrase is stored inside, encrypted — you only need to remember the
        file password.
      </p>

      <div className="mono-box" style={{ marginTop: 20, fontSize: 10, lineHeight: 1.7 }}>{identity.userId}</div>

      <div className="label-caps" style={{ marginTop: 20, marginBottom: 8 }}>File password</div>
      <p className="subtitle" style={{ fontSize: 13, marginBottom: 10 }}>
        Memorize this password. It unlocks your seed from the file during recovery.
      </p>
      <input
        className="input-field"
        type="password"
        placeholder="Min 6 characters"
        value={filePassword}
        onChange={(e) => setFilePassword(e.target.value)}
        onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
      />
      <input
        className="input-field"
        style={{ marginTop: 10 }}
        type="password"
        placeholder="Repeat password"
        value={filePassword2}
        onChange={(e) => setFilePassword2(e.target.value)}
        onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
      />

      <div className="ownership-rules" style={{ marginTop: 20 }}>
        <div className="label-caps" style={{ marginBottom: 10 }}>To recover with this file</div>
        <ol className="ownership-rules-list">
          <li>Load the login file</li>
          <li>Enter your file password</li>
        </ol>
      </div>

      <p className="subtitle" style={{ marginTop: 16, fontSize: 13 }}>
        {isNativeMobile()
          ? `The file is saved automatically to ${APP_BACKUPS_FOLDER_HINT}. Keep it private — never share your seed phrase or file password.`
          : 'Keep the file private. Never share your seed phrase or file password with anyone.'}
      </p>
    </>
  );

  const wrapped = (
    <OnboardingLayout
      step="STEP 4 / 4"
      backTo="/onboarding/confirm"
      mobileBodyClassName="onboarding-proof-body scroll-area"
      mobileFooterClassName="proof-mobile-footer"
      footer={
        <>
          {!downloaded && (
            <button type="button" className="btn-primary" disabled={!passwordReady} onClick={() => void saveFile()}>
              Save login file
            </button>
          )}
          {downloaded && (
            <>
              {isNativeMobile() ? (
                <button type="button" className="btn-secondary" disabled={shareBusy} onClick={() => void shareSavedFile()}>
                  {shareBusy ? 'Opening…' : 'Choose where to save'}
                </button>
              ) : null}
              <button type="button" className="btn-secondary" style={{ marginTop: isNativeMobile() ? 12 : 0 }} onClick={() => void saveFile()}>
                Save again
              </button>
            </>
          )}
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: 12 }}
            onClick={finish}
            disabled={!downloaded}
          >
            Finish setup
          </button>
        </>
      }
    >
      {body}
    </OnboardingLayout>
  );

  if (layout === 'computer') return wrapped;
  return <PhoneShell>{wrapped}</PhoneShell>;
}
