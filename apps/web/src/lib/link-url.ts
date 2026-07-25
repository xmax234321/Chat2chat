/** http(s), www., and bare domains like youtube.com/path */
export const URL_PATTERN =
  /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?'")\]}>]|(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?:\/[^\s<]*)?)/gi;

export function normalizeHref(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('www.')) return `https://${trimmed}`;
  return `https://${trimmed}`;
}

export function extractUrls(text: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0];
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(url);
  }
  return urls;
}

export function openExternalUrl(url: string): void {
  const href = normalizeHref(url);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
