import { useNavigate } from 'react-router-dom';
import { LockIcon } from '../components/Icons';
import { useApp } from '../store/AppContext';

export function ChooseDeviceScreen() {
  const navigate = useNavigate();
  const { setPreferredDevice } = useApp();

  const choose = (device: 'phone' | 'computer') => {
    setPreferredDevice(device);
    navigate('/');
  };

  return (
    <div className="choose-device">
      <div className="choose-device-card">
        <div className="choose-device-icon">
          <LockIcon size={28} color="#0B0B0C" />
        </div>
        <h1>Welcome to Chat2Chat</h1>
        <p>What are you using right now?</p>
        <p className="choose-device-hint">We&apos;ll tailor the interface. You can change this later in Settings.</p>

        <div className="choose-device-options">
          <button type="button" className="choose-device-btn" onClick={() => choose('phone')}>
            <span className="choose-device-emoji">📱</span>
            <span className="choose-device-label">Phone</span>
            <span className="choose-device-desc">Mobile layout, compact chats</span>
          </button>
          <button type="button" className="choose-device-btn" onClick={() => choose('computer')}>
            <span className="choose-device-emoji">💻</span>
            <span className="choose-device-label">Computer</span>
            <span className="choose-device-desc">Desktop layout, sidebar + chats</span>
          </button>
        </div>
      </div>
    </div>
  );
}
