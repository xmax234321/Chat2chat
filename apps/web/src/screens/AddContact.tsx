import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneShell, NavHeader } from '../components/PhoneShell';
import { DevicePermissionSheet } from '../components/DevicePermissionSheet';
import { QrScanner } from '../components/QrScanner';
import { useToast } from '../components/Toast';
import { useApp } from '../store/AppContext';
import { useDeviceLayout } from '../hooks/useDeviceLayout';
import { chatPath, homePathForDevice } from '../lib/types';
import { parseContactIdFromQr } from '../lib/contact-qr';
import { hapticSuccess } from '../lib/haptics';
import { isMediaCaptureBlocked, requestMediaCaptureAccess } from '../lib/media-capture-permissions';

type AddStep = 'scan' | 'id' | 'name';
type IdSource = 'scan' | 'manual';
type CameraAccess = 'checking' | 'granted' | 'denied';

export function AddContactScreen() {
  const navigate = useNavigate();
  const layout = useDeviceLayout();
  const { identity, addContact } = useApp();
  const { show } = useToast();
  const [step, setStep] = useState<AddStep>('scan');
  const [pendingId, setPendingId] = useState('');
  const [idSource, setIdSource] = useState<IdSource>('scan');
  const [manualId, setManualId] = useState('');
  const [alias, setAlias] = useState('');
  const [cameraAccess, setCameraAccess] = useState<CameraAccess>('checking');
  const [permissionSheetOpen, setPermissionSheetOpen] = useState(false);

  const back = homePathForDevice(layout);

  const backFromAdd = () => {
    if (step === 'name') {
      setAlias('');
      if (idSource === 'manual') {
        setStep('id');
      } else {
        setPendingId('');
        setStep('scan');
      }
      return;
    }
    if (step === 'id') {
      setManualId('');
      setStep('scan');
    }
  };

  const headerBack = () => {
    if (step !== 'scan') {
      backFromAdd();
      return;
    }
    navigate(back);
  };

  const add = () => {
    const id = pendingId.trim();
    if (!id.startsWith('c2c_')) {
      show('Invalid ID — must start with c2c_');
      return;
    }
    if (identity && id === identity.userId) {
      show("You can't add yourself as a contact");
      return;
    }
    if (!addContact(id, alias.trim() || 'New contact')) {
      show('Contact already added');
      navigate(chatPath(layout === 'computer', id));
      return;
    }
    navigate(`/verify/${encodeURIComponent(id)}`);
  };

  const onScan = useCallback(
    (raw: string) => {
      const userId = parseContactIdFromQr(raw);
      if (!userId) return;
      if (identity && userId === identity.userId) {
        show("You can't add yourself as a contact");
        return;
      }
      void hapticSuccess();
      setPendingId(userId);
      setIdSource('scan');
      setAlias('');
      setStep('name');
    },
    [identity, show],
  );

  const proceedFromId = () => {
    const id = manualId.trim();
    if (!id.startsWith('c2c_')) {
      show('Invalid ID — must start with c2c_');
      return;
    }
    if (identity && id === identity.userId) {
      show("You can't add yourself as a contact");
      return;
    }
    setPendingId(id);
    setIdSource('manual');
    setAlias('');
    setStep('name');
  };

  const pasteId = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const match = text.match(/c2c_[A-Za-z0-9+/=_-]+/);
      if (match) {
        setManualId(match[0]);
        show('ID pasted');
      } else {
        show('No Chat2Chat ID in clipboard');
      }
    } catch {
      show('Clipboard access denied');
    }
  };

  const refreshCameraAccess = useCallback(async () => {
    setCameraAccess('checking');
    try {
      if (await isMediaCaptureBlocked(false)) {
        setCameraAccess('denied');
        setPermissionSheetOpen(true);
        return;
      }
      const granted = await requestMediaCaptureAccess(false);
      setCameraAccess(granted ? 'granted' : 'denied');
      if (!granted) setPermissionSheetOpen(true);
    } catch {
      setCameraAccess('denied');
      setPermissionSheetOpen(true);
    }
  }, []);

  useEffect(() => {
    if (step !== 'scan') return;
    void refreshCameraAccess();
  }, [refreshCameraAccess, step]);

  const stepLabel = step === 'name' ? 'Name contact' : undefined;

  if (step === 'scan') {
    return (
      <PhoneShell>
        <div className="add-contact-scan-screen">
          <NavHeader onBack={headerBack} />
          <div className="add-contact-scan-stage">
            {cameraAccess === 'checking' ? (
              <div className="qr-scanner-fallback qr-scanner-fallback--fullscreen">
                <p>Checking camera access…</p>
              </div>
            ) : cameraAccess === 'denied' ? (
              <div className="qr-scanner-fallback qr-scanner-fallback--fullscreen">
                <p className="permission-inline-title">Camera access needed</p>
                <p className="subtitle permission-inline-text">
                  Allow camera access in Settings to scan QR codes.
                </p>
                <button type="button" className="btn-primary permission-inline-btn" onClick={() => setPermissionSheetOpen(true)}>
                  Allow access
                </button>
              </div>
            ) : (
              <QrScanner fullScreen onScan={onScan} onError={() => { setCameraAccess('denied'); setPermissionSheetOpen(true); }} />
            )}
            <div className="add-contact-scan-overlay" aria-hidden />
          </div>
          <div className="add-contact-scan-footer">
            <p className="add-contact-scan-hint">Point your camera at a Chat2Chat QR code</p>
            <button type="button" className="btn-secondary add-contact-manual-btn" onClick={() => setStep('id')}>
              Add manually
            </button>
          </div>
        </div>
        <DevicePermissionSheet
          open={permissionSheetOpen}
          needs="camera"
          onClose={() => setPermissionSheetOpen(false)}
        />
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <NavHeader step={stepLabel} onBack={headerBack} />
      <div className="screen-body screen-pad scroll-area centered-content">
        <h2 className="title">Add contact</h2>
        {step === 'id' && <p className="subtitle">Enter the contact&apos;s Chat2Chat ID</p>}
        {step === 'name' && <p className="subtitle">Choose a name you&apos;ll recognize in your chat list</p>}

        {step === 'id' && (
          <div className="centered-block add-contact-step" style={{ marginTop: 24, width: '100%' }}>
            <div className="label-caps" style={{ marginBottom: 8 }}>
              Contact ID
            </div>
            <input
              className="input-field"
              placeholder="c2c_…"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
            />
            <button type="button" className="btn-secondary" style={{ marginTop: 10 }} onClick={() => void pasteId()}>
              Paste from clipboard
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ marginTop: 20 }}
              onClick={proceedFromId}
              disabled={!manualId.trim()}
            >
              Next
            </button>
            <button type="button" className="btn-ghost" style={{ marginTop: 12 }} onClick={() => setStep('scan')}>
              Scan QR instead
            </button>
          </div>
        )}

        {step === 'name' && (
          <div className="centered-block add-contact-step" style={{ marginTop: 24, width: '100%' }}>
            <div className="mono-box" style={{ fontSize: 10, color: '#9C9C9A' }}>
              {pendingId.length > 44 ? `${pendingId.slice(0, 44)}…` : pendingId}
            </div>
            <div className="label-caps" style={{ marginTop: 20, marginBottom: 8 }}>
              Contact name
            </div>
            <input
              className="input-field"
              placeholder="Name"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              autoCapitalize="words"
              autoCorrect="off"
              enterKeyHint="done"
            />
            <button type="button" className="btn-primary" style={{ marginTop: 20 }} onClick={() => add()}>
              Add contact
            </button>
          </div>
        )}
      </div>
    </PhoneShell>
  );
}
