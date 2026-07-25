import { CALLS_ENABLED } from '../lib/calls-feature';
import { useLocation, useNavigate } from 'react-router-dom';

export function PhoneTabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!CALLS_ENABLED) return null;
  const onChats = pathname === '/chats' || pathname.startsWith('/chat/');
  const onCalls = pathname === '/calls';

  return (
    <nav className="phone-tab-bar" aria-label="Main">
      <button
        type="button"
        className={`phone-tab${onChats ? ' phone-tab--active' : ''}`}
        onClick={() => navigate('/chats')}
      >
        Chats
      </button>
      <button
        type="button"
        className={`phone-tab${onCalls ? ' phone-tab--active' : ''}`}
        onClick={() => navigate('/calls')}
      >
        Calls
      </button>
    </nav>
  );
}
