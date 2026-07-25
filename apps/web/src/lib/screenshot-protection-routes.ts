/** Routes where screenshots and screen recording must be blocked. */
export function shouldBlockScreenshots(pathname: string): boolean {
  if (pathname === '/chats') return true;
  if (pathname.startsWith('/chat/')) return true;
  if (/^\/contact\/[^/]+\/profile$/.test(pathname)) return true;
  if (/^\/group\/[^/]+\/profile$/.test(pathname)) return true;
  if (pathname === '/settings/profile') return true;
  if (pathname === '/app' || pathname.startsWith('/app/')) return true;
  return false;
}
