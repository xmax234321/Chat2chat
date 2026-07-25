import { useNavigate } from 'react-router-dom';
import { PrivacyStory } from '../components/PrivacyStory';
import { useDeviceLayout } from '../hooks/useDeviceLayout';
import { isMobileShell } from '../lib/platform';
import { homePathForDevice } from '../lib/types';

export function PrivacyStoryReplayScreen() {
  const navigate = useNavigate();
  const layout = useDeviceLayout();

  if (!isMobileShell()) {
    return null;
  }

  return (
    <PrivacyStory onComplete={() => navigate(homePathForDevice(layout), { replace: true })} />
  );
}
