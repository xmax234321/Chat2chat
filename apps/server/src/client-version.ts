export interface ClientVersionInfo {
  version: string;
  build: string;
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

export function isClientVersionSupported(
  client: ClientVersionInfo | null | undefined,
  minimum: ClientVersionInfo,
): boolean {
  if (!client?.version) return false;
  const v = compareVersions(client.version, minimum.version);
  if (v > 0) return true;
  if (v < 0) return false;
  const clientBuild = parseInt(client.build || '0', 10) || 0;
  const minBuild = parseInt(minimum.build || '0', 10) || 0;
  return clientBuild >= minBuild;
}
