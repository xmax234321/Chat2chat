import { isCapacitor } from './platform';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not read file'));
        return;
      }
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(blob);
  });
}

async function fetchBlob(src: string): Promise<Blob> {
  const res = await fetch(src);
  if (!res.ok) throw new Error('Could not load media');
  return res.blob();
}

function extFromMime(mime: string): string {
  if (mime.startsWith('video/')) return mime.includes('quicktime') ? 'mov' : 'mp4';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.includes('zip')) return 'zip';
  if (mime.startsWith('text/')) return 'txt';
  return 'jpg';
}

function filePathFromUri(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''));
}

function safeFileName(name: string): string {
  return name.replace(/[/\\]/g, '_').replace(/\.\./g, '_') || 'media';
}

async function writeCacheBase64File(path: string, base64: string): Promise<string> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  await Filesystem.writeFile({
    path,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  return uri;
}

async function saveNativeToGallery(blob: Blob, mime: string, name: string): Promise<void> {
  const { PhotoGallery } = await import('./native-photo-gallery');
  const base64 = await blobToBase64(blob);
  const safeName = safeFileName(name);
  const path = `gallery/${Date.now()}-${safeName}`;
  const uri = await writeCacheBase64File(path, base64);
  await PhotoGallery.saveToGallery({
    path: filePathFromUri(uri),
    isVideo: mime.startsWith('video/'),
  });
}

export async function saveMediaToGallery(
  src: string,
  fileName: string,
  mime?: string,
): Promise<void> {
  const blob = await fetchBlob(src);
  const type = mime ?? blob.type;
  const name = safeFileName(fileName || `media.${extFromMime(type)}`);

  if (isCapacitor()) {
    try {
      await saveNativeToGallery(blob, type, name);
      return;
    } catch {
      const { Share } = await import('@capacitor/share');
      const base64 = await blobToBase64(blob);
      const path = `gallery/${Date.now()}-${name}`;
      const uri = await writeCacheBase64File(path, base64);
      await Share.share({
        title: name,
        url: uri,
        dialogTitle: type.startsWith('video/') ? 'Save video to Photos' : 'Save to Photos',
      });
      return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadMedia(src: string, fileName: string, mime?: string): Promise<void> {
  await saveMediaToGallery(src, fileName, mime);
}

export async function shareMediaFile(
  src: string,
  fileName: string,
  mime?: string,
): Promise<void> {
  const blob = await fetchBlob(src);
  const name = safeFileName(fileName || 'media');
  const type = mime ?? blob.type;

  if (isCapacitor()) {
    const { Share } = await import('@capacitor/share');
    const base64 = await blobToBase64(blob);
    const path = `shared/${Date.now()}-${name}`;
    const uri = await writeCacheBase64File(path, base64);
    await Share.share({ title: name, url: uri, dialogTitle: 'Share' });
    return;
  }

  if (navigator.share && navigator.canShare?.({ files: [new File([blob], name, { type })] })) {
    await navigator.share({ files: [new File([blob], name, { type })], title: name });
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
