import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../store/AppContext';
import { formatBuildLabel } from '../lib/build-label';
import { isCapacitor } from '../lib/platform';
import { SfUpdateIcon } from './settings/SettingsSfIcons';

export function UpdatesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { checkForUpdates } = useApp();
  const [versionInfo, setVersionInfo] = useState<{ version: string; build: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const buildLabel = formatBuildLabel();

  useEffect(() => {
    if (!open) {
      setResult(null);
      setChecking(false);
      return;
    }
    if (!isCapacitor()) return;
    void import('@capacitor/app')
      .then(({ App }) => App.getInfo())
      .then((info) => setVersionInfo({ version: info.version, build: info.build }))
      .catch(() => {});
  }, [open]);

  if (!open) return null;

  const handleCheck = async () => {
    setChecking(true);
    setResult(null);
    try {
      const update = await checkForUpdates();
      if (update.status === 'current') {
        setResult(update.message ?? 'You have the latest version');
      } else if (update.status === 'available') {
        setResult(update.message ?? `Update ${update.latest.version} is available`);
      } else {
        setResult(update.message ?? `Security update ${update.latest.version} is available`);
      }
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Update check failed');
    } finally {
      setChecking(false);
    }
  };

  return createPortal(
    <div className="updates-sheet-backdrop" onClick={onClose} role="presentation">
      <div className="attach-sheet-stack sheet-up updates-sheet-stack" onClick={(e) => e.stopPropagation()}>
        <div className="share-contact-sheet updates-sheet" role="dialog" aria-modal="true">
          <div className="share-contact-handle" aria-hidden />
          <h2 className="updates-sheet-title">Updates</h2>
          <div className="updates-sheet-meta">
            {versionInfo ? (
              <div className="updates-sheet-meta-row">
                <span>Version</span>
                <strong>
                  {versionInfo.version} ({versionInfo.build})
                </strong>
              </div>
            ) : null}
            {buildLabel ? (
              <div className="updates-sheet-meta-row">
                <span>Build</span>
                <strong>{buildLabel}</strong>
              </div>
            ) : null}
          </div>
          <button type="button" className="updates-sheet-check-btn" onClick={() => void handleCheck()} disabled={checking}>
            <span className="updates-sheet-check-icon" aria-hidden>
              <SfUpdateIcon size={20} />
            </span>
            <span>{checking ? 'Checking…' : 'Check for updates'}</span>
          </button>
          {result ? <p className="updates-sheet-result">{result}</p> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
