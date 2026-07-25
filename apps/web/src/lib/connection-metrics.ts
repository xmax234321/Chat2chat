let windowBytes = 0;
let windowStart = 0;
let lastSpeedKbps = 0;
let lastSpeedAt = 0;

export function recordUploadBytes(bytes: number): void {
  if (bytes <= 0) return;
  const now = Date.now();
  if (!windowStart || now - windowStart > 3000) {
    windowBytes = 0;
    windowStart = now;
  }
  windowBytes += bytes;
  const elapsed = now - windowStart;
  if (elapsed >= 400) {
    lastSpeedKbps = Math.round((windowBytes * 8) / elapsed);
    lastSpeedAt = now;
  }
}

export function getUploadSpeedKbps(): number | null {
  const now = Date.now();
  if (windowStart && now - windowStart <= 3000 && windowBytes > 0) {
    const elapsed = Math.max(now - windowStart, 1);
    return Math.round((windowBytes * 8) / elapsed);
  }
  if (lastSpeedAt && now - lastSpeedAt < 12000 && lastSpeedKbps > 0) {
    return lastSpeedKbps;
  }
  return null;
}

export function formatSpeedKbps(kbps: number | null): string {
  if (kbps == null || kbps <= 0) return '—';
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)} Mbps`;
  return `${kbps} Kbps`;
}

export function formatPingMs(ms: number | null): string {
  if (ms == null || ms < 0) return '—';
  return `${ms} ms`;
}
