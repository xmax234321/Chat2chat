import { useNavigate, useParams } from 'react-router-dom';
import { PhoneShell, NavHeader } from '../components/PhoneShell';
import { useApp } from '../store/AppContext';
import { useDeviceLayout } from '../hooks/useDeviceLayout';
import { chatPath, formatFingerprintGroups, homePathForDevice } from '../lib/types';

export function VerifyContactScreen() {
  const { contactId: rawId } = useParams();
  const contactId = decodeURIComponent(rawId ?? '');
  const navigate = useNavigate();
  const layout = useDeviceLayout();
  const { getContact, verifyContact } = useApp();
  const contact = getContact(contactId);

  const safetyNumber = contact?.fingerprint || '';
  const toChat = () => navigate(chatPath(layout === 'computer', contactId));

  const verify = () => {
    verifyContact(contactId);
    toChat();
  };

  return (
    <PhoneShell>
      <NavHeader onBack={() => navigate('/add-contact')} />
      <div className="screen-body screen-pad">
        <h2 className="title">Verify contact</h2>
        <p className="subtitle">{contact?.alias ?? 'Contact'}</p>
        <div className="mono-box" style={{ marginTop: 8, fontSize: 10, color: '#9C9C9A' }}>
          {contactId.slice(0, 40)}…
        </div>

        <div className="label-caps" style={{ marginTop: 28, marginBottom: 10 }}>
          Safety number
        </div>
        <div
          style={{
            font: "400 13px 'JetBrains Mono', monospace",
            color: '#F4F4F3',
            lineHeight: 2,
            letterSpacing: '0.04em',
          }}
        >
          {formatFingerprintGroups(safetyNumber).split(' ').map((g, i) => (
            <span key={i} style={{ display: 'inline-block', minWidth: 72 }}>
              {g}&nbsp;&nbsp;
            </span>
          ))}
        </div>

        <p className="subtitle" style={{ marginTop: 20 }}>
          Compare this number with {contact?.alias ?? 'your contact'} in person or over a trusted channel. If it
          matches, no one is intercepting your messages.
        </p>
      </div>
      <div style={{ padding: '0 26px 28px' }}>
        <button type="button" className="btn-primary" onClick={verify}>
          Mark as verified
        </button>
        <button type="button" className="btn-ghost" style={{ marginTop: 12 }} onClick={toChat}>
          Add without verifying
        </button>
        <button type="button" className="btn-ghost" style={{ marginTop: 12 }} onClick={() => navigate(homePathForDevice(layout))}>
          Back to chats
        </button>
      </div>
    </PhoneShell>
  );
}
