import { useEffect } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider } from './store/AppContext';
import { CallProvider } from './store/CallContext';
import { ToastProvider } from './components/Toast';
import { AppLockGate } from './components/AppLockGate';
import { ScreenshotProtectionSync } from './components/ScreenshotProtectionSync';
import { ElectronShell } from './components/ElectronShell';
import { SettingsLayout } from './components/DesktopSettingsShell';
import { useDeviceLayout } from './hooks/useDeviceLayout';
import { homePathForDevice, loadState } from './lib/types';
import { WelcomeRoute } from './screens/Welcome';
import { ChooseDeviceScreen } from './screens/ChooseDevice';
import { IdentityScreen } from './screens/Identity';
import { SeedPhraseScreen } from './screens/SeedPhrase';
import { ConfirmSeedScreen } from './screens/ConfirmSeed';
import { RecoverScreen } from './screens/Recover';
import { ChatListScreen } from './screens/ChatList';
import { CallListScreen } from './screens/CallList';
import { ConversationScreen } from './screens/Conversation';
import { ChatRouteMarker } from './screens/ChatRouteMarker';
import { MobileChatsShell } from './screens/MobileChatsShell';
import { AddContactScreen } from './screens/AddContact';
import { VerifyContactScreen } from './screens/VerifyContact';
import {
  SettingsScreen,
  SecuritySettingsScreen,
  PinSettingsScreen,
  BackupSettingsScreen,
  NotificationsSettingsScreen,
  UpdatesSettingsScreen,
  MyIdSettingsScreen,
  ProfileSettingsScreen,
  CustomisationSettingsScreen,
  PermissionsSettingsScreen,
} from './screens/SettingsPages';
import { DesktopScreen } from './screens/Desktop';
import { PhoneOfflineScreen } from './screens/PhoneOffline';
import { ProofScreen } from './screens/Proof';
import { PrivacyStoryReplayScreen } from './screens/PrivacyStoryReplay';
import { DesktopApp } from './screens/desktop/DesktopApp';
import { GroupProfileScreen } from './screens/GroupProfileScreen';
import { ContactProfileScreen } from './screens/ContactProfileScreen';
import { CALLS_ENABLED } from './lib/calls-feature';
import { useApp } from './store/AppContext';
import { CallOverlay } from './components/calls/CallOverlay';
import { isDesktopShell, isMobileShell } from './lib/platform';
import { canCreateAccount } from './lib/account-policy';

const Router = isDesktopShell() || isMobileShell() ? HashRouter : BrowserRouter;

function RequireAuth({ children }: { children: React.ReactNode }) {
  const done = loadState().onboardingDone;
  if (!done) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ChatsRoute() {
  const layout = useDeviceLayout();
  if (layout === 'computer') return <Navigate to="/app" replace />;
  return <ChatListScreen />;
}

function CallListRoute() {
  const layout = useDeviceLayout();
  if (layout === 'computer') return <Navigate to="/app" replace />;
  return <CallListScreen />;
}

function DesktopRoute({ children }: { children: React.ReactNode }) {
  const layout = useDeviceLayout();
  if (layout === 'phone') return <Navigate to="/chats" replace />;
  return <>{children}</>;
}

function PhoneOnlyOnboarding({ children }: { children: React.ReactNode }) {
  const layout = useDeviceLayout();
  if (!canCreateAccount(layout)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ChooseDeviceRoute() {
  const layout = useDeviceLayout();
  const { settings } = useApp();
  const done = loadState().onboardingDone;

  if (isDesktopShell() || isMobileShell()) return <Navigate to="/" replace />;
  if (done) return <Navigate to={homePathForDevice(layout)} replace />;
  if (settings.deviceChosen) return <Navigate to="/" replace />;
  return <ChooseDeviceScreen />;
}

function MobileBootstrap() {
  const { settings, setPreferredDevice } = useApp();
  useEffect(() => {
    if (isMobileShell() && !settings.deviceChosen) {
      setPreferredDevice('phone');
    }
  }, [settings.deviceChosen, setPreferredDevice]);
  return null;
}

function DesktopBootstrap() {
  const { settings, setPreferredDevice } = useApp();
  useEffect(() => {
    if (isDesktopShell() && !settings.deviceChosen) {
      setPreferredDevice('computer');
    }
  }, [settings.deviceChosen, setPreferredDevice]);
  return null;
}

function DesktopNoSettings({ children }: { children: React.ReactNode }) {
  if (isDesktopShell()) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <AppProvider>
      <CallProvider>
      <ElectronShell />
      <DesktopBootstrap />
      <MobileBootstrap />
      <ToastProvider>
        <Router>
          <AppLockGate>
          <ScreenshotProtectionSync />
          {CALLS_ENABLED && <CallOverlay />}
          <Routes>
            <Route path="/" element={<WelcomeRoute />} />
            <Route path="/choose-device" element={<ChooseDeviceRoute />} />
            <Route path="/recover" element={<RecoverScreen />} />
            <Route path="/recover/manual" element={<RecoverScreen />} />
            <Route path="/recover/file" element={<RecoverScreen />} />
            <Route path="/recover/backup" element={<RecoverScreen />} />
            <Route path="/privacy-story" element={<PrivacyStoryReplayScreen />} />
            <Route
              path="/onboarding/identity"
              element={
                <PhoneOnlyOnboarding>
                  <IdentityScreen />
                </PhoneOnlyOnboarding>
              }
            />
            <Route
              path="/onboarding/seed"
              element={
                <PhoneOnlyOnboarding>
                  <SeedPhraseScreen />
                </PhoneOnlyOnboarding>
              }
            />
            <Route
              path="/onboarding/confirm"
              element={
                <PhoneOnlyOnboarding>
                  <ConfirmSeedScreen />
                </PhoneOnlyOnboarding>
              }
            />
            <Route
              path="/onboarding/proof"
              element={
                <PhoneOnlyOnboarding>
                  <ProofScreen />
                </PhoneOnlyOnboarding>
              }
            />

            {isMobileShell() ? (
              <Route
                element={
                  <RequireAuth>
                    <MobileChatsShell />
                  </RequireAuth>
                }
              >
                <Route path="/chats" element={<ChatsRoute />} />
                <Route path="/chat/:contactId" element={<ChatRouteMarker />} />
                <Route path="/contact/:contactId/profile" element={<ContactProfileScreen />} />
                <Route path="/group/:groupId/profile" element={<GroupProfileScreen />} />
              </Route>
            ) : (
              <>
                <Route
                  path="/chats"
                  element={
                    <RequireAuth>
                      <ChatsRoute />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/chat/:contactId"
                  element={
                    <RequireAuth>
                      <ConversationScreen />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/contact/:contactId/profile"
                  element={
                    <RequireAuth>
                      <ContactProfileScreen />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/group/:groupId/profile"
                  element={
                    <RequireAuth>
                      <GroupProfileScreen />
                    </RequireAuth>
                  }
                />
              </>
            )}
            <Route
              path="/app"
              element={
                <RequireAuth>
                  <DesktopRoute>
                    <DesktopApp />
                  </DesktopRoute>
                </RequireAuth>
              }
            />
            <Route
              path="/app/:contactId"
              element={
                <RequireAuth>
                  <DesktopRoute>
                    <DesktopApp />
                  </DesktopRoute>
                </RequireAuth>
              }
            />
            <Route
              path="/calls"
              element={
                <RequireAuth>
                  {CALLS_ENABLED ? <CallListRoute /> : <Navigate to="/chats" replace />}
                </RequireAuth>
              }
            />
            <Route
              path="/add-contact"
              element={
                <RequireAuth>
                  <AddContactScreen />
                </RequireAuth>
              }
            />
            <Route
              path="/verify/:contactId"
              element={
                <RequireAuth>
                  <VerifyContactScreen />
                </RequireAuth>
              }
            />

            <Route
              path="/settings"
              element={
                <RequireAuth>
                  <DesktopNoSettings>
                    <SettingsLayout />
                  </DesktopNoSettings>
                </RequireAuth>
              }
            >
              <Route index element={<SettingsScreen />} />
              <Route path="security" element={<SecuritySettingsScreen />} />
              <Route path="pin" element={<PinSettingsScreen />} />
              <Route path="backup" element={<BackupSettingsScreen />} />
              <Route path="notifications" element={<NotificationsSettingsScreen />} />
              <Route path="permissions" element={<PermissionsSettingsScreen />} />
              <Route path="updates" element={<UpdatesSettingsScreen />} />
              <Route path="customisation" element={<CustomisationSettingsScreen />} />
              <Route path="profile" element={<ProfileSettingsScreen />} />
              <Route path="id" element={<MyIdSettingsScreen />} />
            </Route>

            <Route
              path="/desktop"
              element={<DesktopScreen />}
            />
            <Route
              path="/desktop/offline"
              element={
                <RequireAuth>
                  <PhoneOfflineScreen />
                </RequireAuth>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </AppLockGate>
        </Router>
      </ToastProvider>
      </CallProvider>
    </AppProvider>
  );
}
