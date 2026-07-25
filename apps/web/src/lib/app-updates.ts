import { App } from '@capacitor/app';
import { isCapacitor } from './platform';

export const ALTSTORE_SOURCE_URL = 'https://api.chat2chat.org/altstore/source.json';

export interface VersionInfo {
  version: string;
  build: string;
}

export interface UpdateCheckResult {
  status: 'current' | 'available' | 'critical';
  latest: VersionInfo;
  current: VersionInfo;
  message?: string;
}

interface AltStoreVersionEntry {
  version: string;
  buildVersion: string;
  securityCritical?: boolean;
}

interface AltStoreSource {
  updatePolicy?: { securityCritical?: boolean };
  apps?: Array<{
    versions?: AltStoreVersionEntry[];
  }>;
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function isNewer(latest: VersionInfo, current: VersionInfo): boolean {
  const v = compareVersions(latest.version, current.version);
  if (v > 0) return true;
  if (v < 0) return false;
  const lb = parseInt(latest.build, 10) || 0;
  const cb = parseInt(current.build, 10) || 0;
  return lb > cb;
}

async function getCurrentAppVersion(): Promise<VersionInfo> {
  if (isCapacitor()) {
    const info = await App.getInfo();
    return { version: info.version, build: info.build };
  }
  return { version: '0.0.0', build: '0' };
}

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  const current = await getCurrentAppVersion();

  let source: AltStoreSource;
  try {
    const res = await fetch(ALTSTORE_SOURCE_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    source = (await res.json()) as AltStoreSource;
  } catch (e) {
    return {
      status: 'current',
      latest: current,
      current,
      message: e instanceof Error ? e.message : 'Could not reach update server',
    };
  }

  const latestEntry = source.apps?.[0]?.versions?.[0];
  if (!latestEntry) {
    return {
      status: 'current',
      latest: current,
      current,
      message: 'No versions in update feed',
    };
  }

  const latest: VersionInfo = {
    version: latestEntry.version,
    build: String(latestEntry.buildVersion),
  };

  if (!isNewer(latest, current)) {
    return { status: 'current', latest, current };
  }

  const securityCritical =
    Boolean(source.updatePolicy?.securityCritical) || Boolean(latestEntry.securityCritical);

  return {
    status: securityCritical ? 'critical' : 'available',
    latest,
    current,
    message: securityCritical
      ? `Security update ${latest.version} (build ${latest.build}) is available`
      : `Update ${latest.version} (build ${latest.build}) is available`,
  };
}

export function criticalUpdateDismissKey(version: string): string {
  return `critical-update-dismissed-${version}`;
}

export function isCriticalUpdateDismissed(version: string): boolean {
  try {
    return sessionStorage.getItem(criticalUpdateDismissKey(version)) === '1';
  } catch {
    return false;
  }
}

export function dismissCriticalUpdate(version: string): void {
  try {
    sessionStorage.setItem(criticalUpdateDismissKey(version), '1');
  } catch {
    /* ignore */
  }
}
