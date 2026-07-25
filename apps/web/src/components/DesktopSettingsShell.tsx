import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { AppIconBadge } from './brand/AppIconBadge';
import { GridIcon, UserIcon } from './Icons';
import { LogOutSheet } from './LogOutSheet';
import {
  SfBellBadgeIcon,
  SfHandRaisedIcon,
  SfIcloudIcon,
  SfLockIcon,
  SfLogoutCircleIcon,
  SfPaintbrushIcon,
  SfUpdateIcon,
} from './settings/SettingsSfIcons';
import { useApp } from '../store/AppContext';
import { homePathForDevice } from '../lib/types';
import { useDeviceLayout } from '../hooks/useDeviceLayout';
import type { ReactNode } from 'react';

type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { to: '/settings', label: 'Overview', icon: <GridIcon />, end: true },
      { to: '/settings/pin', label: 'PIN', icon: <SfLockIcon size={16} /> },
      { to: '/settings/permissions', label: 'Permissions', icon: <SfHandRaisedIcon size={16} /> },
    ],
  },
  {
    label: 'Profile',
    items: [{ to: '/settings/profile', label: 'Profile', icon: <UserIcon /> }],
  },
  {
    label: 'Privacy',
    items: [{ to: '/settings/backup', label: 'Backup', icon: <SfIcloudIcon size={16} /> }],
  },
  {
    label: 'App',
    items: [
      { to: '/settings/customisation', label: 'Customisation', icon: <SfPaintbrushIcon size={16} /> },
      { to: '/settings/notifications', label: 'Notifications', icon: <SfBellBadgeIcon size={16} /> },
      { to: '/settings/updates', label: 'Updates', icon: <SfUpdateIcon size={16} /> },
    ],
  },
];

export function SettingsLayout() {
  const layout = useDeviceLayout();
  if (layout === 'computer') {
    return <DesktopSettingsShell />;
  }
  return <Outlet />;
}

export function DesktopSettingsShell() {
  const navigate = useNavigate();
  const layout = useDeviceLayout();
  const { logout, appLockEnabled, settings } = useApp();
  const [logoutOpen, setLogoutOpen] = useState(false);

  return (
    <div className="desktop-settings">
      <aside className="desktop-settings-nav">
        <div className="desktop-brand">
          <AppIconBadge tile={36} mark={20} className="desktop-brand-icon" />
          <span>Settings</span>
        </div>
        <nav className="desktop-settings-links">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="desktop-settings-nav-group-label">{group.label}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `desktop-settings-link${isActive ? ' active' : ''}`}
                >
                  <span className="desktop-settings-link-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="desktop-settings-nav-footer">
          <button type="button" className="desktop-settings-back" onClick={() => navigate(homePathForDevice(layout))}>
            ← Back to chats
          </button>
          <button type="button" className="desktop-settings-danger" onClick={() => setLogoutOpen(true)}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <SfLogoutCircleIcon size={14} />
              Log out
            </span>
          </button>
        </div>
      </aside>
      <main className="desktop-settings-main">
        <Outlet />
      </main>
      <LogOutSheet
        open={logoutOpen}
        pinRequired={appLockEnabled}
        hasBackup={Boolean(settings.lastBackupAt)}
        onClose={() => setLogoutOpen(false)}
        onLogout={() => {
          setLogoutOpen(false);
          logout();
        }}
      />
    </div>
  );
}
