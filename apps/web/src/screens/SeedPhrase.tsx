import { useNavigate } from 'react-router-dom';
import { OnboardingLayout } from '../components/OnboardingLayout';
import { PhoneShell } from '../components/PhoneShell';
import { useToast } from '../components/Toast';
import { useApp } from '../store/AppContext';
import { useDeviceLayout } from '../hooks/useDeviceLayout';

export function SeedPhraseScreen() {
  const navigate = useNavigate();
  const layout = useDeviceLayout();
  const { identity, copyToClipboard } = useApp();
  const { show } = useToast();
  const words = identity?.mnemonic?.split(' ') ?? [];

  const body = (
    <>
      <h2 className={layout === 'computer' ? 'auth-title' : 'title'}>Recovery phrase</h2>
      <p className={layout === 'computer' ? 'auth-subtitle' : 'subtitle'}>
        These 12 words are the <strong style={{ color: '#F4F4F3' }}>only</strong> way to recover your account.
        Write them down and store them offline. Never share them.
      </p>
      <div className="seed-grid">
        {words.map((word, i) => (
          <div key={`${i}-${word}`} className="seed-word">
            <span>{String(i + 1).padStart(2, '0')}</span>
            {word}
          </div>
        ))}
      </div>
    </>
  );

  const wrapped = (
    <OnboardingLayout
      step="STEP 2 / 4"
      backTo="/onboarding/identity"
      footer={
        <>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              void copyToClipboard(words.join(' ')).then(() => show('Copied to clipboard'));
            }}
          >
            Copy to clipboard
          </button>
          <button type="button" className="btn-primary" style={{ marginTop: 10 }} onClick={() => navigate('/onboarding/confirm')}>
            I&apos;ve written it down
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
