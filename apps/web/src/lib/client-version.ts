import { App } from '@capacitor/app';
import type { Contact } from './types';
import { compareVersions, type VersionInfo } from './app-updates';
import { isCapacitor } from './platform';

export type ClientVersionInfo = VersionInfo;

export async function getClientVersion(): Promise<ClientVersionInfo> {
  if (isCapacitor()) {
    const info = await App.getInfo();
    return { version: info.version, build: info.build };
  }
  return { version: '0.0.0', build: '0' };
}

export function isVersionNewer(a: ClientVersionInfo, b: ClientVersionInfo): boolean {
  const v = compareVersions(a.version, b.version);
  if (v > 0) return true;
  if (v < 0) return false;
  return (parseInt(a.build, 10) || 0) > (parseInt(b.build, 10) || 0);
}

export function contactVersionInfo(contact: Pick<Contact, 'appVersion' | 'appBuild'>): ClientVersionInfo | null {
  if (!contact.appVersion) return null;
  return { version: contact.appVersion, build: contact.appBuild ?? '0' };
}

export function isContactOnOlderApp(
  contact: Pick<Contact, 'appVersion' | 'appBuild'>,
  current: ClientVersionInfo,
): boolean {
  const peer = contactVersionInfo(contact);
  if (!peer) return false;
  if (current.version === '0.0.0') return false;
  return isVersionNewer(current, peer);
}

export function formatClientVersion(info: ClientVersionInfo): string {
  const build = info.build && info.build !== '0' ? ` (build ${info.build})` : '';
  return `${info.version}${build}`;
}

export function contactVersionDismissKey(
  contactId: string,
  peer: ClientVersionInfo,
): string {
  return `contact-version-dismiss-${contactId}-${peer.version}-${peer.build}`;
}

export function isContactVersionBannerDismissed(
  contactId: string,
  peer: ClientVersionInfo,
): boolean {
  try {
    return localStorage.getItem(contactVersionDismissKey(contactId, peer)) === '1';
  } catch {
    return false;
  }
}

export function dismissContactVersionBanner(contactId: string, peer: ClientVersionInfo): void {
  try {
    localStorage.setItem(contactVersionDismissKey(contactId, peer), '1');
  } catch {
    /* ignore */
  }
}
