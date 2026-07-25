import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { NavHeader } from '../components/PhoneShell';
import { AuthLayout } from '../components/AuthLayout';
import { AppIconBadge } from '../components/brand/AppIconBadge';
import { Chat2ChatWordmark } from '../components/brand/Chat2ChatWordmark';
import { QrCodeBox } from '../components/QrCodeBox';
import { QrScanner } from '../components/QrScanner';
import { useToast } from '../components/Toast';
import { useApp } from '../store/AppContext';
import { useDeviceLayout } from '../hooks/useDeviceLayout';
import { isCapacitor, isDesktopShell } from '../lib/platform';
import { loadState } from '../lib/types';
import {
  buildDesktopLinkQr,
  DESKTOP_LINK_DEFAULT_PORT,
  DESKTOP_LINK_PAIR_TTL_MS,
  DESKTOP_LINK_SERVICE_UUID,
  parseDesktopLinkQr,
} from '../lib/desktop-link/protocol';
import { startDesktopLinkAdvertising, stopDesktopLinkAdvertising } from '../lib/desktop-link/desktop';

export function DesktopScreen() {
  const navigate = useNavigate();
  const layout = useDeviceLayout();
  const { settings, desktopBleConnected, pairDesktopFromPhone } = useApp();
  const { show } = useToast();
  const [seconds, setSeconds] = useState(120);
  const [qrValue, setQrValue] = useState('');
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState('');
  const [pairing, setPairing] = useState(false);
  const linkToken = useMemo(() => crypto.randomUUID(), []);
  const isDesktop = isDesktopShell();
  const isPhone = isCapacitor() && !isDesktop;
  const isComputer = layout === 'computer';

  useEffect(() => {
    if (!isDesktop) {
      setStarting(false);
      return;
    }
    let active = true;
    const offer = {
      version: 1 as const,
      token: linkToken,
      host: '0.0.0.0',
      port: DESKTOP_LINK_DEFAULT_PORT,
      serviceUuid: DESKTOP_LINK_SERVICE_UUID,
      expiresAt: Date.now() + DESKTOP_LINK_PAIR_TTL_MS,
    };
    void startDesktopLinkAdvertising(offer)
      .then((started) => {
        if (!active) return;
        setQrValue(buildDesktopLinkQr(started));
        setStarting(false);
        setError('');
      })
      .catch((e) => {
        if (!active) return;
        const message = e instanceof Error ? e.message : 'Could not start desktop link';
        setError(message);
        show(message);
        setStarting(false);
      });
    return () => {
      active = false;
      if (!loadState().settings?.desktopLinked) {
        void stopDesktopLinkAdvertising();
      }
    };
  }, [isDesktop, linkToken, show]);

  useEffect(() => {
    if (!isDesktop) return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [isDesktop]);

  useEffect(() => {
    if (settings.desktopLinked && loadState().onboardingDone && isDesktop) {
      navigate('/app');
    }
  }, [navigate, settings.desktopLinked, isDesktop]);

  const handlePhoneScan = useCallback(
    (raw: string) => {
      if (pairing) return;
      const offer = parseDesktopLinkQr(raw);
      if (!offer) {
        show('Not a Chat2Chat desktop QR code');
        return;
      }
      setPairing(true);
      setError('');
      void pairDesktopFromPhone(offer)
        .then(() => {
          show('Connected to computer');
          navigate('/chats');
        })
        .catch((e) => {
          const message = e instanceof Error ? e.message : 'Could not link computer';
          setError(message);
          show(message);
        })
        .finally(() => setPairing(false));
    },
    [navigate, pairDesktopFromPhone, pairing, show],
  );

  const mm = String(Math.floor(seconds / 60)).padStart(1, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  const desktopBody = (
    <>
      <div className="desktop-link-hero">
        <AppIconBadge tile={52} mark={30} />
        <Chat2ChatWordmark size="md" style={{ display: 'block', marginTop: 18 }} />
        <h2 className="auth-title desktop-link-title">Link this computer</h2>
        <p className="auth-subtitle">
          Scan this QR code in the Chat2Chat app on your phone to sign in and connect.
        </p>
      </div>

      <ol className="desktop-link-steps">
        <li>On your phone: open Chat2Chat → Settings → Link computer</li>
        <li>Point the camera at this QR code</li>
        <li>Approve Bluetooth when asked</li>
      </ol>

      <div className="desktop-link-qr-block">
        {qrValue ? (
          <QrCodeBox value={qrValue} size={220} />
        ) : (
          <div className="qr-code-skeleton desktop-link-qr-skeleton" aria-hidden />
        )}
        <div className="desktop-link-qr-meta">
          <div className="label-caps">Desktop pairing QR</div>
          {qrValue && (
            <div className="desktop-link-qr-preview" title={qrValue}>
              {qrValue.slice(0, 42)}…
            </div>
          )}
          <div className="desktop-link-expiry">
            {starting ? 'Starting…' : error ? 'Unavailable' : `Expires in ${mm}:${ss}`}
          </div>
          {desktopBleConnected && <div className="desktop-link-connected">Phone connected</div>}
          {error && <p className="desktop-link-error">{error}</p>}
        </div>
      </div>

      <button type="button" className="btn-ghost desktop-link-recover" onClick={() => navigate('/recover')}>
        Recover with seed phrase instead
      </button>
    </>
  );

  const phoneBody = (
    <>
      <h2 className="title" style={{ fontSize: 22 }}>Link computer</h2>
      <p className="subtitle">
        Open Chat2Chat on your Mac, then scan the pairing QR code shown there.
      </p>

      <ol className="desktop-link-steps">
        <li>On your Mac: open Chat2Chat and go to Link this computer</li>
        <li>Point your phone at the QR code on the Mac screen</li>
        <li>Approve Bluetooth when asked</li>
      </ol>

      <div className="desktop-link-scanner">
        <QrScanner
          onScan={handlePhoneScan}
          onError={(message) => setError(message)}
        />
      </div>

      {pairing && <p className="desktop-link-connected">Connecting…</p>}
      {settings.desktopLinked && !pairing && (
        <p className="desktop-link-connected">Computer linked — phone relay active</p>
      )}
      {error && <p className="desktop-link-error">{error}</p>}
    </>
  );

  if (isComputer) {
    return <AuthLayout onBack={settings.desktopLinked ? () => navigate('/app') : undefined}>{desktopBody}</AuthLayout>;
  }

  if (isPhone) {
    return (
      <AppShell forceMobile>
        <NavHeader onBack={() => navigate('/settings')} />
        <div className="screen-body screen-pad">{phoneBody}</div>
      </AppShell>
    );
  }

  return (
    <AppShell forceMobile>
      <NavHeader onBack={() => navigate('/settings')} />
      <div className="screen-body screen-pad">
        <p className="subtitle">Open the Chat2Chat desktop app on your Mac to show the pairing QR code.</p>
      </div>
    </AppShell>
  );
}
