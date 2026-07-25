import { Filesystem, Directory } from '@capacitor/filesystem';
import { isIosCapacitor } from './platform';
import { readCachedMediaBytes, readCachedNativeRef } from './media-cache';
import { DocumentPreview } from './native-document-preview';

function safeFileName(name: string): string {
  return name.replace(/[/\\]/g, '_').replace(/\.\./g, '_') || 'document';
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function filePathFromUri(uri: string): string {
  if (uri.startsWith('file://')) {
    try {
      return decodeURIComponent(new URL(uri).pathname);
    } catch {
      return decodeURIComponent(uri.replace(/^file:\/\//, ''));
    }
  }
  return uri;
}

const OFFICE_EXTENSIONS = new Set([
  'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'odt', 'ods', 'odp', 'pages', 'numbers', 'key', 'pdf',
]);

/** iOS Quick Look for office/pdf and most cached attachments. */
export function isNativeOfficePreview(fileName: string): boolean {
  return isNativeDocumentPreview(fileName);
}

export function isNativeDocumentPreview(_fileName?: string): boolean {
  return isIosCapacitor();
}

async function previewFileAtPath(filePath: string): Promise<boolean> {
  await DocumentPreview.preview({ path: filePath });
  return true;
}

async function previewBytes(data: Uint8Array, fileName: string): Promise<boolean> {
  const path = `preview/${Date.now()}-${safeFileName(fileName)}`;
  await Filesystem.writeFile({
    path,
    data: bytesToBase64(data),
    directory: Directory.Cache,
    recursive: true,
  });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  return previewFileAtPath(filePathFromUri(uri));
}

/** Open cached message file via native Quick Look on iOS. */
export async function openNativeOfficeDocumentForMessage(
  messageId: string,
  fileName: string,
): Promise<boolean> {
  return openNativeDocumentForMessage(messageId, fileName);
}

export async function openNativeDocumentForMessage(
  messageId: string,
  fileName: string,
): Promise<boolean> {
  if (!isIosCapacitor()) return false;

  const nativeRef = await readCachedNativeRef(messageId);
  if (nativeRef?.uri) {
    try {
      return await previewFileAtPath(filePathFromUri(nativeRef.uri));
    } catch {
      /* fall through to bytes */
    }
  }

  const cached = await readCachedMediaBytes(messageId);
  if (!cached?.data.length) return false;
  return previewBytes(cached.data, fileName);
}

export async function openNativeOfficeDocument(data: Uint8Array, fileName: string): Promise<boolean> {
  if (!isIosCapacitor()) return false;
  return previewBytes(data, fileName);
}

export { OFFICE_EXTENSIONS };
