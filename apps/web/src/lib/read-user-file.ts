async function readViaFileReader(
  file: File,
  mode: 'text' | 'arrayBuffer' | 'dataURL',
): Promise<string | ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.onload = () => {
      if (reader.result == null) {
        reject(new Error('Could not read file'));
        return;
      }
      resolve(reader.result);
    };
    if (mode === 'text') reader.readAsText(file);
    else if (mode === 'dataURL') reader.readAsDataURL(file);
    else reader.readAsArrayBuffer(file);
  });
}

function emptyFileError(): Error {
  return new Error('File is empty — wait for iCloud to finish downloading, then try again');
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** WKWebView on iOS often rejects file.arrayBuffer() / file.text() with "Load failed". */
async function readBytesViaBlobUrl(file: File): Promise<Uint8Array> {
  const url = URL.createObjectURL(file);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not read file (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function readBytesFromFile(file: File): Promise<Uint8Array> {
  const attempts: Array<() => Promise<Uint8Array>> = [
    async () => new Uint8Array(await file.arrayBuffer()),
    () => readBytesViaBlobUrl(file),
    async () => new Uint8Array(await readViaFileReader(file, 'arrayBuffer') as ArrayBuffer),
    async () => dataUrlToBytes(await readViaFileReader(file, 'dataURL') as string),
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const bytes = await attempt();
      if (!bytes.length) throw emptyFileError();
      return bytes;
    } catch (e) {
      lastError = e;
    }
  }

  const message = lastError instanceof Error ? lastError.message : 'Could not read file';
  if (/load failed/i.test(message)) {
    throw new Error('Could not read file — open Files, wait for iCloud download, then try again');
  }
  throw lastError instanceof Error ? lastError : new Error('Could not read file');
}

/** Read user-picked file bytes (iOS WKWebView often rejects file.text/arrayBuffer). */
export async function readBytesFromUserFile(file: File): Promise<Uint8Array> {
  return readBytesFromFile(file);
}

/** Read user-picked file as UTF-8 text. */
export async function readTextFromUserFile(file: File): Promise<string> {
  if (!file.size) throw emptyFileError();

  try {
    return await file.text();
  } catch {
    try {
      const bytes = await readBytesFromFile(file);
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      try {
        const text = await readViaFileReader(file, 'text');
        return String(text).replace(/^\uFEFF/, '');
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Could not read file';
        if (/load failed/i.test(message)) {
          throw new Error('Could not read file — open Files, wait for iCloud download, then try again');
        }
        throw e;
      }
    }
  }
}
