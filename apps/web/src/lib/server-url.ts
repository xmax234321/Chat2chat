import {
  pickRelayUrls,
  RELAY_CANDIDATES,
  RELAY_HTTP_URL,
  RELAY_WS_URL,
  type RelayEndpoints,
} from './relay-config';

export { RELAY_HTTP_URL, RELAY_WS_URL, pickRelayUrls };
export type { RelayEndpoints };

/** Resolve relay WebSocket URL (env → native bridge → production). */
export function defaultRelayWsUrl(): string {
  if (typeof window !== 'undefined' && window.chat2chat?.serverWs) {
    return window.chat2chat.serverWs;
  }
  if (import.meta.env.VITE_CHAT2CHAT_SERVER) {
    return import.meta.env.VITE_CHAT2CHAT_SERVER;
  }
  if (import.meta.env.DEV && import.meta.env.VITE_USE_LOCAL_RELAY === '1' && typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }
  return RELAY_WS_URL;
}

/** HTTP base for REST + blob API. */
export function defaultRelayHttpUrl(): string {
  if (typeof window !== 'undefined' && window.chat2chat?.serverHttp) {
    return window.chat2chat.serverHttp;
  }
  if (import.meta.env.VITE_CHAT2CHAT_HTTP) {
    return import.meta.env.VITE_CHAT2CHAT_HTTP;
  }
  if (import.meta.env.DEV && import.meta.env.VITE_USE_LOCAL_RELAY === '1' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return RELAY_HTTP_URL;
}

/** Preferred endpoints from bridge/env, with IP fallback candidates. */
export function preferredRelayEndpoints(): RelayEndpoints {
  return {
    ws: defaultRelayWsUrl(),
    http: defaultRelayHttpUrl(),
  };
}

export { RELAY_CANDIDATES };
