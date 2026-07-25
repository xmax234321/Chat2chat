import { unzipSync } from 'fflate';

function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** Pull visible text nodes from OOXML / ODF XML. */
function extractXmlText(xml: string): string {
  const chunks: string[] = [];
  const patterns = [
    /<w:t[^>]*>([^<]*)<\/w:t>/g,
    /<a:t[^>]*>([^<]*)<\/a:t>/g,
    /<text:p[^>]*>([\s\S]*?)<\/text:p>/g,
    /<text:span[^>]*>([^<]*)<\/text:span>/g,
  ];
  for (const re of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(xml)) !== null) {
      const raw = match[1]?.replace(/<[^>]+>/g, '').trim();
      if (raw) chunks.push(decodeXmlEntities(raw));
    }
  }
  return chunks.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export type OfficeDocumentView =
  | { kind: 'text'; title: string; body: string }
  | { kind: 'slides'; title: string; slides: { title: string; body: string }[] }
  | { kind: 'error'; message: string };

function slideSortKey(path: string): number {
  const m = path.match(/(\d+)/);
  return m ? parseInt(m[1]!, 10) : 0;
}

function readEntry(files: Record<string, Uint8Array>, path: string): string | null {
  const bytes = files[path];
  if (!bytes?.length) return null;
  return decodeText(bytes);
}

export function parseOfficeDocument(data: Uint8Array, ext: string): OfficeDocumentView {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data);
  } catch {
    return { kind: 'error', message: 'Could not read document archive' };
  }

  switch (ext) {
    case 'doc':
    case 'docx':
    case 'pages':
    case 'rtf': {
      const xml = readEntry(files, 'word/document.xml');
      if (!xml) return { kind: 'error', message: 'No document body found' };
      const body = extractXmlText(xml);
      return body
        ? { kind: 'text', title: 'Document', body }
        : { kind: 'error', message: 'Document has no readable text' };
    }
    case 'ppt':
    case 'pptx':
    case 'key':
    case 'odp': {
      const slidePaths = Object.keys(files)
        .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p) || /^content\.xml$/.test(p))
        .sort((a, b) => slideSortKey(a) - slideSortKey(b));
      if (ext === 'odp' && slidePaths.length === 1 && slidePaths[0] === 'content.xml') {
        const body = extractXmlText(readEntry(files, 'content.xml') ?? '');
        return body
          ? { kind: 'text', title: 'Presentation', body }
          : { kind: 'error', message: 'Presentation has no readable text' };
      }
      const slides = slidePaths
        .filter((p) => p.startsWith('ppt/slides/'))
        .map((path, i) => {
          const body = extractXmlText(readEntry(files, path) ?? '');
          return { title: `Slide ${i + 1}`, body: body || '(No text on this slide)' };
        });
      return slides.length
        ? { kind: 'slides', title: 'Presentation', slides }
        : { kind: 'error', message: 'No slides found' };
    }
    case 'xls':
    case 'xlsx':
    case 'csv':
    case 'numbers':
    case 'ods': {
      const shared = readEntry(files, 'xl/sharedStrings.xml');
      const sheet = readEntry(files, 'xl/worksheets/sheet1.xml');
      const odsContent = readEntry(files, 'content.xml');
      const parts: string[] = [];
      if (shared) parts.push(extractXmlText(shared));
      if (sheet) parts.push(extractXmlText(sheet));
      if (odsContent) parts.push(extractXmlText(odsContent));
      const body = parts.filter(Boolean).join('\n\n').trim();
      return body
        ? { kind: 'text', title: 'Spreadsheet', body }
        : { kind: 'error', message: 'Spreadsheet has no readable text' };
    }
    case 'odt': {
      const body = extractXmlText(readEntry(files, 'content.xml') ?? '');
      return body
        ? { kind: 'text', title: 'Document', body }
        : { kind: 'error', message: 'Document has no readable text' };
    }
    default:
      return { kind: 'error', message: 'Unsupported document format' };
  }
}
