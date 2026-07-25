import manifest from '../../../../deploy/altstore/versions.manifest.json';

const ALTSTORE_BASE = 'https://api.chat2chat.org/altstore';

export type PublicRelease = {
  version: string;
  buildVersion: string;
  date: string;
  description: string;
  ipaFile: string;
  downloadUrl: string;
  isLatest: boolean;
  deprecated?: boolean;
};

export function getPublicReleases(): PublicRelease[] {
  const byVersion = new Map<string, (typeof manifest.versions)[number]>();
  for (const entry of manifest.versions) {
    const existing = byVersion.get(entry.version);
    if (!existing || Number(entry.buildVersion) > Number(existing.buildVersion)) {
      byVersion.set(entry.version, entry);
    }
  }

  return [...byVersion.values()]
    .sort((a, b) => Number(b.buildVersion) - Number(a.buildVersion))
    .map((entry) => ({
      version: entry.version,
      buildVersion: entry.buildVersion,
      date: entry.date,
      description: entry.description,
      ipaFile: entry.ipaFile,
      downloadUrl: `${ALTSTORE_BASE}/${entry.ipaFile}`,
      isLatest: entry.version === manifest.latest,
      deprecated: entry.deprecated,
    }));
}
