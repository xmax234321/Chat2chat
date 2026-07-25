export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
};

export function scorePassword(password: string): PasswordStrength {
  if (!password) return { score: 0, label: 'EMPTY', color: '#2a2a2d' };

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  const normalized = Math.min(4, Math.max(1, Math.floor(score * 0.8))) as 1 | 2 | 3 | 4;

  if (password.length < 6) {
    return { score: 1, label: 'WEAK', color: '#c89b6b' };
  }
  if (normalized <= 2) return { score: 2, label: 'FAIR', color: '#c89b6b' };
  if (normalized === 3) return { score: 3, label: 'GOOD', color: '#7fb88a' };
  return { score: 4, label: 'STRONG', color: '#7fb88a' };
}
