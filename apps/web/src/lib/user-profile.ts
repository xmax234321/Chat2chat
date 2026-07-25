import { DEFAULT_USER_PROFILE, initials, type UserProfile } from './types';
import { loadState, saveState } from './state-storage';

const PROFILE_EVENT = 'user-profile-change';

function normalizeHue(hue: number): number {
  const rounded = Math.round(hue);
  return ((rounded % 360) + 360) % 360;
}

export function loadUserProfile(): UserProfile {
  const stored = loadState().userProfile;
  if (!stored) return { ...DEFAULT_USER_PROFILE };
  const letters = typeof stored.avatarLetters === 'string' ? stored.avatarLetters.trim().slice(0, 2) : undefined;
  return {
    displayName: typeof stored.displayName === 'string' ? stored.displayName : '',
    avatarHue: normalizeHue(typeof stored.avatarHue === 'number' ? stored.avatarHue : DEFAULT_USER_PROFILE.avatarHue),
    avatarLetters: letters || undefined,
    avatarImage:
      typeof stored.avatarImage === 'string' && stored.avatarImage.startsWith('data:')
        ? stored.avatarImage
        : undefined,
  };
}

export function saveUserProfile(patch: Partial<UserProfile>): UserProfile {
  const current = loadUserProfile();
  const next: UserProfile = {
    displayName: patch.displayName !== undefined ? patch.displayName.trim() : current.displayName,
    avatarHue: patch.avatarHue !== undefined ? normalizeHue(patch.avatarHue) : current.avatarHue,
    avatarLetters:
      patch.avatarLetters !== undefined
        ? patch.avatarLetters.trim().slice(0, 2) || undefined
        : current.avatarLetters,
    avatarImage: patch.avatarImage !== undefined ? patch.avatarImage || undefined : current.avatarImage,
  };
  saveState({ userProfile: next });
  window.dispatchEvent(new Event(PROFILE_EVENT));
  return next;
}

export function subscribeUserProfile(listener: () => void): () => void {
  window.addEventListener(PROFILE_EVENT, listener);
  return () => window.removeEventListener(PROFILE_EVENT, listener);
}

export function resolveDisplayName(displayName: string): string {
  const trimmed = displayName.trim();
  return trimmed || 'You';
}

export function profileInitials(displayName: string): string {
  return initials(resolveDisplayName(displayName));
}

export function profileAvatarLabel(profile: UserProfile, displayName?: string): string {
  const custom = profile.avatarLetters?.trim();
  if (custom) return custom.toUpperCase();
  return profileInitials(displayName ?? profile.displayName);
}

export function avatarGradient(hue: number): string {
  const h = normalizeHue(hue);
  const h2 = (h + 42) % 360;
  return `linear-gradient(145deg, hsl(${h} 68% 52%) 0%, hsl(${h2} 62% 38%) 100%)`;
}
