import { Navigate, useParams } from 'react-router-dom';
import { AppIconBadge } from '../../components/brand/AppIconBadge';
import { Chat2ChatWordmark } from '../../components/brand/Chat2ChatWordmark';
import { ChatPanel } from '../../components/ChatPanel';
import { ChatSidebar } from '../../components/ChatSidebar';
import { ConnectionStatusBar } from '../../components/ConnectionStatusBar';
import { useApp } from '../../store/AppContext';

export function DesktopApp() {
  const { contactId: rawId } = useParams();
  const contactId = rawId ? decodeURIComponent(rawId) : undefined;
  const { settings, desktopBleConnected } = useApp();

  if (settings.desktopLinked && !desktopBleConnected) {
    return <Navigate to="/desktop/offline" replace />;
  }

  return (
    <div className="desktop-app">
      <aside className="desktop-sidebar">
        <div className="desktop-brand">
          <AppIconBadge tile={36} mark={20} className="desktop-brand-icon" />
          <Chat2ChatWordmark size="sm" />
        </div>
        <ChatSidebar selectedId={contactId} basePath="/app" />
        <ConnectionStatusBar className="connection-status-bar--desktop" />
      </aside>
      <main className="desktop-main">
        {contactId ? (
          <ChatPanel contactId={contactId} />
        ) : (
          <div className="desktop-welcome-pane">
            <AppIconBadge tile={72} mark={42} className="desktop-welcome-icon" />
            <Chat2ChatWordmark size="lg" style={{ display: 'block', marginTop: 20 }} />
            <p>Select a chat or add a contact to start messaging.</p>
            <p className="desktop-welcome-sub">End-to-end encrypted · synced with your phone</p>
          </div>
        )}
      </main>
    </div>
  );
}
