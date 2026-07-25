import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { LockIcon } from '../components/Icons';
import { AppIconBadge } from '../components/brand/AppIconBadge';
import { Chat2ChatWordmark } from '../components/brand/Chat2ChatWordmark';
import { EntryAnimation } from '../components/EntryAnimation';
import { AuthLayout } from '../components/AuthLayout';
import { PhoneShell } from '../components/PhoneShell';
import { useApp } from '../store/AppContext';
import { useDeviceLayout } from '../hooks/useDeviceLayout';
import { canCreateAccount } from '../lib/account-policy';
import { PrivacyStory } from '../components/PrivacyStory';
import { isEntryAnimationEnabled } from '../lib/app-lock-settings';
import { hasSeenPrivacyStory } from '../lib/privacy-story';
import { isDesktopShell, isMobileShell } from '../lib/platform';
import { homePathForDevice, loadState } from '../lib/types';

export function WelcomeRoute() {
  const layout = useDeviceLayout();
  const { settings } = useApp();
  const done = loadState().onboardingDone;

  if (done) return <Navigate to={homePathForDevice(layout)} replace />;
  if (isDesktopShell() && !done) return <Navigate to="/desktop" replace />;
  if (!settings.deviceChosen && !isDesktopShell() && !isMobileShell()) {
    return <Navigate to="/choose-device" replace />;
  }
  return <WelcomeScreen />;
}

export function WelcomeScreen() {
  const navigate = useNavigate();
  const layout = useDeviceLayout();
  const { createAccount } = useApp();
  const allowCreate = canCreateAccount(layout);
  const [introDone, setIntroDone] = useState(() => !isEntryAnimationEnabled());
  const [privacyDone, setPrivacyDone] = useState(
    () => hasSeenPrivacyStory() || !isMobileShell(),
  );

  const startCreate = () => {
    createAccount();
    navigate('/onboarding/identity');
  };

  if (layout === 'computer') {
    return (
      <AuthLayout>
        <div className="auth-panel-inner auth-welcome-desktop">
          <h2 className="auth-title">Chat2Chat on desktop</h2>
          <p className="auth-subtitle">
            New accounts are created on your phone. On this computer you can sign in with your seed phrase or link
            after setup on iPhone.
          </p>
          <button type="button" className="btn-primary" style={{ marginTop: 28 }} onClick={() => navigate('/desktop')}>
            Link with phone
          </button>
          <button type="button" className="btn-secondary" style={{ marginTop: 12 }} onClick={() => navigate('/recover')}>
            Recover with seed phrase
          </button>
          <p className="auth-subtitle" style={{ marginTop: 20, fontSize: 13, lineHeight: 1.6 }}>
            Don&apos;t have an account yet? Install Chat2Chat on your iPhone and tap Create account there.
          </p>
          <div className="lock-footer" style={{ marginTop: 24 }}>
            <LockIcon size={11} color="#5F5F5D" />
            End-to-end encrypted · no phone number
          </div>
        </div>
      </AuthLayout>
    );
  }

  if (!introDone) {
    return (
      <PhoneShell>
        <EntryAnimation variant="app" onComplete={() => setIntroDone(true)} />
      </PhoneShell>
    );
  }

  if (!privacyDone) {
    return <PrivacyStory onComplete={() => setPrivacyDone(true)} />;
  }

  return (
    <PhoneShell>
      <div className="screen-body welcome-screen">
        <div className="welcome-screen-top">
          <AppIconBadge tile={52} mark={30} className="auth-welcome-icon" />
          <Chat2ChatWordmark className="auth-welcome-title" size="md" />
          <p className="auth-subtitle" style={{ marginTop: 12, maxWidth: 280 }}>
            Private by design. Your conversations live only on your devices — never on our servers.
          </p>
        </div>
        <div className="welcome-screen-bottom">
          {allowCreate && (
            <button type="button" className="btn-primary" onClick={startCreate}>
              Create account
            </button>
          )}
          <button
            type="button"
            className={allowCreate ? 'btn-ghost' : 'btn-primary'}
            style={{ marginTop: allowCreate ? 16 : 0 }}
            onClick={() => navigate('/recover')}
          >
            Recover
          </button>
          <div className="lock-footer">
            <LockIcon size={11} color="#5F5F5D" />
            End-to-end encrypted · no phone number
          </div>
        </div>
      </div>
    </PhoneShell>
  );
}
