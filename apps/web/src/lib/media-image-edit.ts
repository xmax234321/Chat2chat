import type { PickedMedia } from './pick-media';

export type ImageEditCrop = { x: number; y: number; w: number; h: number };
export type ImageEditPoint = { x: number; y: number };
export type ImageLayoutRect = { x: number; y: number; w: number; h: number };

export const FULL_CROP: ImageEditCrop = { x: 0, y: 0, w: 1, h: 1 };

const MIN_CROP = 0.08;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getImageLayoutRect(
  containerW: number,
  containerH: number,
  imageW: number,
  imageH: number,
): ImageLayoutRect {
  if (!containerW || !containerH || !imageW || !imageH) {
    return { x: 0, y: 0, w: containerW, h: containerH };
  }
  const scale = Math.min(containerW / imageW, containerH / imageH);
  const w = imageW * scale;
  const h = imageH * scale;
  return { x: (containerW - w) / 2, y: (containerH - h) / 2, w, h };
}

export function screenToImageNorm(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  layout: ImageLayoutRect,
): ImageEditPoint {
  const x = (clientX - containerRect.left - layout.x) / layout.w;
  const y = (clientY - containerRect.top - layout.y) / layout.h;
  return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
}

export function imageNormToScreen(point: ImageEditPoint, layout: ImageLayoutRect): ImageEditPoint {
  return {
    x: layout.x + point.x * layout.w,
    y: layout.y + point.y * layout.h,
  };
}

export function cropToScreenRect(crop: ImageEditCrop, layout: ImageLayoutRect): ImageLayoutRect {
  return {
    x: layout.x + crop.x * layout.w,
    y: layout.y + crop.y * layout.h,
    w: crop.w * layout.w,
    h: crop.h * layout.h,
  };
}

type CropHandle = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export function applyCropDrag(
  handle: CropHandle,
  startCrop: ImageEditCrop,
  dxNorm: number,
  dyNorm: number,
): ImageEditCrop {
  let { x, y, w, h } = startCrop;

  if (handle === 'move') {
    return {
      x: clamp(x + dxNorm, 0, 1 - w),
      y: clamp(y + dyNorm, 0, 1 - h),
      w,
      h,
    };
  }

  if (handle.includes('w')) {
    const nextX = clamp(x + dxNorm, 0, x + w - MIN_CROP);
    w = x + w - nextX;
    x = nextX;
  }
  if (handle.includes('e')) {
    w = clamp(w + dxNorm, MIN_CROP, 1 - x);
  }
  if (handle.includes('n')) {
    const nextY = clamp(y + dyNorm, 0, y + h - MIN_CROP);
    h = y + h - nextY;
    y = nextY;
  }
  if (handle.includes('s')) {
    h = clamp(h + dyNorm, MIN_CROP, 1 - y);
  }

  return { x, y, w, h };
}

export function drawSmoothStroke(
  ctx: CanvasRenderingContext2D,
  points: ImageEditPoint[],
  mapPoint: (point: ImageEditPoint) => ImageEditPoint,
): void {
  if (!points.length) return;

  const mapped = points.map(mapPoint);
  if (mapped.length === 1) {
    ctx.beginPath();
    ctx.arc(mapped[0].x, mapped[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(mapped[0].x, mapped[0].y);
  if (mapped.length === 2) {
    ctx.lineTo(mapped[1].x, mapped[1].y);
    ctx.stroke();
    return;
  }

  for (let i = 1; i < mapped.length - 1; i += 1) {
    const current = mapped[i];
    const next = mapped[i + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    ctx.quadraticCurveTo(current.x, current.y, midX, midY);
  }
  const last = mapped[mapped.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

export function exportBrushWidth(imageWidth: number): number {
  return Math.max(3, Math.round(imageWidth / 120));
}

export function screenBrushWidth(): number {
  return 5;
}

export async function loadEditableImage(sourceUrl: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = sourceUrl;
  });
  return img;
}

export async function exportEditedImage(
  img: HTMLImageElement,
  crop: ImageEditCrop,
  strokes: ImageEditPoint[][],
  mime = 'image/jpeg',
): Promise<{ blob: Blob; fileName: string }> {
  const sx = Math.round(crop.x * img.naturalWidth);
  const sy = Math.round(crop.y * img.naturalHeight);
  const sw = Math.max(1, Math.round(crop.w * img.naturalWidth));
  const sh = Math.max(1, Math.round(crop.h * img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not edit image');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  if (strokes.length) {
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = exportBrushWidth(sw);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of strokes) {
      if (!stroke.length) continue;
      drawSmoothStroke(ctx, stroke, (point) => ({
        x: ((point.x - crop.x) / crop.w) * sw,
        y: ((point.y - crop.y) / crop.h) * sh,
      }));
    }
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.92));
  if (!blob) throw new Error('Could not export image');
  return { blob, fileName: 'edited.jpg' };
}

export async function applyEditToPickedMedia(item: PickedMedia, blob: Blob, fileName: string): Promise<PickedMedia> {
  const data = new Uint8Array(await blob.arrayBuffer());
  const file = new File([blob], fileName, { type: blob.type || item.mime });
  const previewUrl = URL.createObjectURL(blob);
  if (item.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
  return {
    ...item,
    file,
    mime: blob.type || item.mime || 'image/jpeg',
    previewUrl,
    data,
    nativePath: undefined,
    nativeSize: data.length,
  };
}
