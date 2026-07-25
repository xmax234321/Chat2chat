import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { AppLockScreen } from '../screens/AppLockScreen';
import { CriticalUpdateSheet } from './CriticalUpdateSheet';
import { EntryAnimation } from './EntryAnimation';
import { isCriticalUpdateDismissed } from '../lib/app-updates';
import { isEntryAnimationEnabled } from '../lib/app-lock-settings';
import { loadState } from '../lib/types';

function isPublicPath(pathname: string): boolean {
  if (pathname === '/' || pathname === '/choose-device') return true;
  if (pathname.startsWith('/recover')) return true;
  if (pathname.startsWith('/onboarding')) return true;
  if (pathname === '/privacy-story') return true;
  return false;
}

function CriticalUpdateGate({ children }: { children: ReactNode }) {
  const { checkForUpdates, upgradeRequiredMessage, dismissUpgradeRequired } = useApp();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const [sheetMessage, setSheetMessage] = useState<string | undefined>();

  useEffect(() => {
    if (upgradeRequiredMessage) {
      setLatestVersion('');
      setSheetMessage(upgradeRequiredMessage);
      setSheetOpen(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await checkForUpdates();
      if (cancelled) return;
      if (result.status === 'critical' && !isCriticalUpdateDismissed(result.latest.version)) {
        setLatestVersion(result.latest.version);
        setSheetMessage(undefined);
        setSheetOpen(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checkForUpdates, upgradeRequiredMessage]);

  const handleDismiss = () => {
    if (upgradeRequiredMessage) {
      dismissUpgradeRequired();
    }
    setSheetOpen(false);
  };

  return (
    <>
      {children}
      <CriticalUpdateSheet
        open={sheetOpen}
        latestVersion={latestVersion}
        message={sheetMessage}
        onDismiss={handleDismiss}
      />
    </>
  );
}

export function AppLockGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { appLockEnabled, appUnlocked, unlockApp, logout } = useApp();
  const signedIn = Boolean(loadState().onboardingDone);
  const [unlockGeneration, setUnlockGeneration] = useState(0);
  const [appIntroDone, setAppIntroDone] = useState(() => !isEntryAnimationEnabled());

  const handleUnlock = useCallback(
    async (pin: string, viaBiometric?: boolean) => {
      const ok = await unlockApp(pin, viaBiometric);
      if (ok) setUnlockGeneration((g) => g + 1);
      return ok;
    },
    [unlockApp],
  );

  if (!signedIn || isPublicPath(pathname)) {
    return <>{children}</>;
  }

  if (appLockEnabled && !appUnlocked) {
    return <AppLockScreen onUnlock={handleUnlock} onLogout={logout} />;
  }

  if (!appIntroDone) {
    return <EntryAnimation variant="app" onComplete={() => setAppIntroDone(true)} />;
  }

  return <CriticalUpdateGate key={unlockGeneration}>{children}</CriticalUpdateGate>;
}
