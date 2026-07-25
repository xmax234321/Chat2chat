import { useMemo } from 'react';
import { normalizeHref, openExternalUrl, URL_PATTERN } from './link-url';

type Part = { type: 'text'; value: string } | { type: 'link'; value: string };

function splitLinkParts(text: string): Part[] {
  const parts: Part[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, index) });
    }
    parts.push({ type: 'link', value: match[0] });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return parts.length ? parts : [{ type: 'text', value: text }];
}

export function LinkifyText({ text }: { text: string }) {
  const parts = useMemo(() => splitLinkParts(text), [text]);

  return (
    <>
      {parts.map((part, index) =>
        part.type === 'link' ? (
          <a
            key={`${index}-${part.value}`}
            className="chat-link"
            href={normalizeHref(part.value)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openExternalUrl(part.value);
            }}
          >
            {part.value}
          </a>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </>
  );
}
