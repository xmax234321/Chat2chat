import { useCallback, useEffect, useState } from 'react';
import { loadUserProfile, saveUserProfile, subscribeUserProfile } from '../lib/user-profile';
import type { UserProfile } from '../lib/types';

export function useUserProfile(): [UserProfile, (patch: Partial<UserProfile>) => void] {
  const [profile, setProfile] = useState(loadUserProfile);

  useEffect(() => subscribeUserProfile(() => setProfile(loadUserProfile())), []);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile(saveUserProfile(patch));
  }, []);

  return [profile, updateProfile];
}
