/** Extract Chat2Chat user ID from any QR payload (raw ID, deep link, web URL). */
export function parseContactIdFromQr(text: string): string | null {
  let raw = text.trim();
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }

  const addParam = raw.match(/[?&#]add=(c2c_[A-Za-z0-9_-]+)/i);
  if (addParam?.[1]) return addParam[1];

  const match = raw.match(/c2c_[A-Za-z0-9_-]+/);
  return match?.[0] ?? null;
}

export function qrRenderOptions(size: number, payload: string) {
  const longPayload = payload.length > 72;
  return {
    width: size,
    margin: longPayload ? 4 : 2,
    errorCorrectionLevel: (longPayload ? 'L' : 'M') as 'L' | 'M',
    color: { dark: '#0B0B0C', light: '#F4F4F3' },
  };
}
