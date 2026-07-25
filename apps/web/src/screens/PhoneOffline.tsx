import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { NavHeader } from '../components/PhoneShell';

export function PhoneOfflineScreen() {
  const navigate = useNavigate();

  return (
    <AppShell>
      <NavHeader onBack={() => navigate('/desktop')} />
      <div
        className="screen-body"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 26,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: '#1B1B1E',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'grid',
            placeItems: 'center',
            marginBottom: 20,
            fontSize: 24,
          }}
        >
          📵
        </div>
        <h2 className="title">Phone disconnected</h2>
        <p className="subtitle" style={{ marginTop: 12 }}>
          Open Chat2Chat on your phone to reconnect. New messages relay through your phone and will appear here once it&apos;s back online.
        </p>
        <p style={{ fontSize: 12, color: '#9C9C9A', marginTop: 20 }}>Desktop · waiting for phone</p>
        <button type="button" className="btn-primary" style={{ marginTop: 28, width: '100%', maxWidth: 280 }} onClick={() => navigate('/desktop')}>
          Link phone again
        </button>
      </div>
    </AppShell>
  );
}
