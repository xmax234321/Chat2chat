import { useNavigate } from 'react-router-dom';
import { contactDeepLink } from '@chat2chat/crypto/browser';
import { OnboardingLayout } from '../components/OnboardingLayout';
import { PhoneShell } from '../components/PhoneShell';
import { QrCodeBox, contactQrValue } from '../components/QrCodeBox';
import { useToast } from '../components/Toast';
import { useApp } from '../store/AppContext';
import { useDeviceLayout } from '../hooks/useDeviceLayout';

export function IdentityScreen() {
  const navigate = useNavigate();
  const layout = useDeviceLayout();
  const { identity, copyToClipboard } = useApp();
  const { show } = useToast();

  if (!identity) {
    const loading = <div style={{ color: '#9C9C9A' }}>Loading…</div>;
    if (layout === 'computer') return loading;
    return <PhoneShell><div className="screen-body screen-pad">{loading}</div></PhoneShell>;
  }

  const body = (
    <>
      <h2 className={layout === 'computer' ? 'auth-title' : 'title'}>Your identity</h2>
      <p className={layout === 'computer' ? 'auth-subtitle' : 'subtitle'}>
        This is your public address. Share it so others can reach you — it reveals nothing about you.
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0 20px' }}>
        <QrCodeBox value={contactQrValue(identity.userId)} size={200} label="Your Chat2Chat ID" expandable expandSize={320} />
      </div>
      <div className="label-caps" style={{ marginBottom: 8 }}>Your ID</div>
      <div className="mono-box" style={{ fontSize: 10, lineHeight: 1.7 }}>{identity.userId}</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            void copyToClipboard(identity.userId).then(() => show('Copied'));
          }}
        >
          Copy
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            void copyToClipboard(contactDeepLink(identity.userId)).then(() => show('Link copied'));
          }}
        >
          Share
        </button>
      </div>
    </>
  );

  const wrapped = (
    <OnboardingLayout
      step="STEP 1 / 4"
      backTo="/"
      footer={
        <button type="button" className="btn-primary" onClick={() => navigate('/onboarding/seed')}>
          Continue
        </button>
      }
    >
      {body}
    </OnboardingLayout>
  );

  if (layout === 'computer') return wrapped;
  return <PhoneShell>{wrapped}</PhoneShell>;
}
