/** Primary relay (HTTPS/WSS). */
export const RELAY_HTTP_URL = 'https://api.chat2chat.org';
export const RELAY_WS_URL = 'wss://api.chat2chat.org/ws';

/** Optional dev-only relay override via env (never shipped in production builds). */
function devRelayFromEnv(): { ws: string; http: string } | null {
  const env = import.meta.env;
  if (!env?.DEV) return null;
  const http = env.VITE_CHAT2CHAT_DEV_RELAY_HTTP as string | undefined;
  const ws = env.VITE_CHAT2CHAT_DEV_RELAY_WS as string | undefined;
  if (!http || !ws) return null;
  return { ws, http };
}

export interface RelayEndpoints {
  ws: string;
  http: string;
}

export const RELAY_CANDIDATES: RelayEndpoints[] = [
  { ws: RELAY_WS_URL, http: RELAY_HTTP_URL },
  ...(devRelayFromEnv() ? [devRelayFromEnv()!] : []),
];

const LAST_RELAY_KEY = 'chat2chat-last-relay';

export function loadCachedRelay(): RelayEndpoints | null {
  try {
    const raw = sessionStorage.getItem(LAST_RELAY_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as RelayEndpoints;
    if (cached.http.includes('161.104.17.85') || cached.ws.includes('161.104.17.85')) {
      sessionStorage.removeItem(LAST_RELAY_KEY);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

export function cacheRelay(endpoints: RelayEndpoints): void {
  if (endpoints.http.includes('161.104.17.85') || endpoints.ws.includes('161.104.17.85')) return;
  try {
    sessionStorage.setItem(LAST_RELAY_KEY, JSON.stringify(endpoints));
  } catch {
    /* ignore */
  }
}

async function probeRelay(httpBase: string): Promise<boolean> {
  const url = `${httpBase.replace(/\/$/, '')}/api/v1/health`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Pick the first reachable relay (cached → primary → dev override). */
export async function pickRelayUrls(preferred?: RelayEndpoints): Promise<RelayEndpoints> {
  const seen = new Set<string>();
  const candidates: RelayEndpoints[] = [];

  const add = (c: RelayEndpoints) => {
    if (c.http.includes('161.104.17.85') || c.ws.includes('161.104.17.85')) return;
    const key = `${c.ws}|${c.http}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(c);
  };

  if (preferred) add(preferred);
  const cached = loadCachedRelay();
  if (cached) add(cached);
  for (const c of RELAY_CANDIDATES) add(c);

  for (const c of candidates) {
    if (await probeRelay(c.http)) {
      cacheRelay(c);
      return c;
    }
  }

  return preferred ?? cached ?? RELAY_CANDIDATES[0]!;
}
