import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  applyCropDrag,
  cropToScreenRect,
  drawSmoothStroke,
  exportEditedImage,
  FULL_CROP,
  getImageLayoutRect,
  loadEditableImage,
  screenBrushWidth,
  screenToImageNorm,
  type ImageEditCrop,
  type ImageEditPoint,
  type ImageLayoutRect,
} from '../lib/media-image-edit';

type Mode = 'crop' | 'draw';

export type MediaImageEditorHandle = {
  commit: () => Promise<Blob | null>;
};

type Props = {
  imageUrl: string;
  mode: Mode;
  onCancel: () => void;
  onApply: (blob: Blob) => void;
};

type CropHandle = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const CROP_HANDLES: { id: CropHandle; className: string }[] = [
  { id: 'nw', className: 'media-image-editor-crop-handle media-image-editor-crop-handle--nw' },
  { id: 'n', className: 'media-image-editor-crop-handle media-image-editor-crop-handle--n' },
  { id: 'ne', className: 'media-image-editor-crop-handle media-image-editor-crop-handle--ne' },
  { id: 'e', className: 'media-image-editor-crop-handle media-image-editor-crop-handle--e' },
  { id: 'se', className: 'media-image-editor-crop-handle media-image-editor-crop-handle--se' },
  { id: 's', className: 'media-image-editor-crop-handle media-image-editor-crop-handle--s' },
  { id: 'sw', className: 'media-image-editor-crop-handle media-image-editor-crop-handle--sw' },
  { id: 'w', className: 'media-image-editor-crop-handle media-image-editor-crop-handle--w' },
];

export const MediaImageEditorOverlay = forwardRef<MediaImageEditorHandle, Props>(function MediaImageEditorOverlay(
  { imageUrl, mode, onCancel, onApply },
  ref,
) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const layoutRef = useRef<ImageLayoutRect>({ x: 0, y: 0, w: 0, h: 0 });
  const strokesRef = useRef<ImageEditPoint[][]>([]);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<ImageEditPoint[]>([]);
  const rafRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [crop, setCrop] = useState<ImageEditCrop>(FULL_CROP);
  const [layoutTick, setLayoutTick] = useState(0);
  const [strokeLen, setStrokeLen] = useState(0);
  const [dragging, setDragging] = useState<CropHandle | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0, crop: FULL_CROP });

  const syncLayout = useCallback(() => {
    const viewport = viewportRef.current;
    const img = imageRef.current;
    if (!viewport || !img) return;
    const rect = viewport.getBoundingClientRect();
    layoutRef.current = getImageLayoutRect(rect.width, rect.height, img.naturalWidth, img.naturalHeight);
    setLayoutTick((v) => v + 1);
  }, []);

  const paintAllStrokes = useCallback(() => {
    const canvas = drawCanvasRef.current;
    const viewport = viewportRef.current;
    const img = imageRef.current;
    if (!canvas || !viewport || !img) return;

    const rect = viewport.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const nextW = Math.round(rect.width * dpr);
    const nextH = Math.round(rect.height * dpr);
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const layout = layoutRef.current;
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = screenBrushWidth();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of strokesRef.current) {
      if (!stroke.length) continue;
      drawSmoothStroke(ctx, stroke, (point) => ({
        x: layout.x + point.x * layout.w,
        y: layout.y + point.y * layout.h,
      }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setCrop(FULL_CROP);
    strokesRef.current = [];
    currentStrokeRef.current = [];
    setStrokeLen(0);

    void (async () => {
      try {
        const img = await loadEditableImage(imageUrl);
        if (cancelled) return;
        imageRef.current = img;
        setReady(true);
      } catch {
        if (!cancelled) onCancel();
      }
    })();

    return () => {
      cancelled = true;
      imageRef.current = null;
    };
  }, [imageUrl, onCancel]);

  useEffect(() => {
    if (!ready) return;
    syncLayout();
    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver(() => {
      syncLayout();
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [ready, syncLayout]);

  useEffect(() => {
    if (!ready) return;
    paintAllStrokes();
  }, [ready, layoutTick, strokeLen, paintAllStrokes]);

  const scheduleRepaint = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      paintAllStrokes();
    });
  }, [paintAllStrokes]);

  const appendDrawPoint = useCallback((clientX: number, clientY: number) => {
    const viewport = viewportRef.current;
    if (!viewport || !drawingRef.current) return;
    const rect = viewport.getBoundingClientRect();
    const point = screenToImageNorm(clientX, clientY, rect, layoutRef.current);
    const stroke = currentStrokeRef.current;
    const last = stroke[stroke.length - 1];
    if (last) {
      const dx = point.x - last.x;
      const dy = point.y - last.y;
      if (dx * dx + dy * dy < 0.00002) return;
    }
    stroke.push(point);
    scheduleRepaint();
  }, [scheduleRepaint]);

  const commit = useCallback(async (): Promise<Blob | null> => {
    const img = imageRef.current;
    if (!img) return null;
    const hasStrokes = strokesRef.current.some((stroke) => stroke.length > 0);
    const cropChanged = crop.x !== 0 || crop.y !== 0 || crop.w !== 1 || crop.h !== 1;
    if (!hasStrokes && !cropChanged) return null;
    const { blob } = await exportEditedImage(img, crop, strokesRef.current);
    return blob;
  }, [crop]);

  useImperativeHandle(ref, () => ({ commit }), [commit]);

  const apply = async () => {
    const blob = await commit();
    if (!blob) {
      onCancel();
      return;
    }
    onApply(blob);
  };

  const undoStroke = () => {
    if (!strokesRef.current.length) return;
    strokesRef.current.pop();
    setStrokeLen(strokesRef.current.length);
  };

  const clearStrokes = () => {
    strokesRef.current = [];
    setStrokeLen(0);
  };

  const beginCropDrag = (handle: CropHandle, clientX: number, clientY: number) => {
    setDragging(handle);
    dragStartRef.current = { x: clientX, y: clientY, crop: { ...crop } };
  };

  const moveCropDrag = (clientX: number, clientY: number) => {
    if (!dragging) return;
    const layout = layoutRef.current;
    if (!layout.w || !layout.h) return;
    const dxNorm = (clientX - dragStartRef.current.x) / layout.w;
    const dyNorm = (clientY - dragStartRef.current.y) / layout.h;
    setCrop(applyCropDrag(dragging, dragStartRef.current.crop, dxNorm, dyNorm));
  };

  const cropScreenRect = ready
    ? cropToScreenRect(crop, layoutRef.current)
    : { x: 0, y: 0, w: 0, h: 0 };

  void layoutTick;

  return (
    <div className="media-image-editor-overlay">
      <div className="media-image-editor-overlay-toolbar">
        <button type="button" className="btn-ghost media-image-editor-overlay-btn" onClick={onCancel}>
          Cancel
        </button>
        <span className="media-image-editor-overlay-title">{mode === 'crop' ? 'Crop' : 'Draw'}</span>
        <button
          type="button"
          className="btn-ghost media-image-editor-overlay-btn media-image-editor-overlay-done"
          onClick={() => void apply()}
          disabled={!ready}
        >
          Done
        </button>
      </div>

      <div
        ref={viewportRef}
        className="media-image-editor-overlay-viewport"
        onPointerMove={(e) => {
          if (mode === 'crop') moveCropDrag(e.clientX, e.clientY);
        }}
        onPointerUp={() => setDragging(null)}
        onPointerCancel={() => setDragging(null)}
      >
        {!ready ? <div className="media-image-editor-loading">Loading…</div> : null}
        {ready && imageRef.current ? (
          <img src={imageRef.current.src} alt="" className="media-image-editor-image" draggable={false} />
        ) : null}

        {ready && mode === 'crop' ? (
          <div
            className="media-image-editor-crop"
            style={{
              left: cropScreenRect.x,
              top: cropScreenRect.y,
              width: cropScreenRect.w,
              height: cropScreenRect.h,
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              beginCropDrag('move', e.clientX, e.clientY);
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
          >
            <div className="media-image-editor-crop-grid" aria-hidden />
            {CROP_HANDLES.map((handle) => (
              <span
                key={handle.id}
                className={handle.className}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  beginCropDrag(handle.id, e.clientX, e.clientY);
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
              />
            ))}
          </div>
        ) : null}

        {ready ? (
          <canvas
            ref={drawCanvasRef}
            className={`media-image-editor-draw${mode === 'draw' ? ' media-image-editor-draw--active' : ''}`}
            onPointerDown={(e) => {
              if (mode !== 'draw') return;
              const viewport = viewportRef.current;
              const img = imageRef.current;
              if (!viewport || !img) return;
              const rect = viewport.getBoundingClientRect();
              const point = screenToImageNorm(e.clientX, e.clientY, rect, layoutRef.current);
              drawingRef.current = true;
              currentStrokeRef.current = [point];
              strokesRef.current.push(currentStrokeRef.current);
              e.currentTarget.setPointerCapture(e.pointerId);
              scheduleRepaint();
            }}
            onPointerMove={(e) => {
              if (!drawingRef.current || mode !== 'draw') return;
              const native = e.nativeEvent;
              const events =
                typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [native];
              for (const moveEvent of events) {
                appendDrawPoint(moveEvent.clientX, moveEvent.clientY);
              }
            }}
            onPointerUp={(e) => {
              if (!drawingRef.current) return;
              drawingRef.current = false;
              currentStrokeRef.current = [];
              setStrokeLen(strokesRef.current.length);
              e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            onPointerCancel={(e) => {
              drawingRef.current = false;
              currentStrokeRef.current = [];
              e.currentTarget.releasePointerCapture(e.pointerId);
            }}
          />
        ) : null}
      </div>

      {mode === 'draw' ? (
        <div className="media-image-editor-overlay-footer">
          <button type="button" className="btn-secondary" onClick={undoStroke} disabled={strokeLen === 0}>
            Undo
          </button>
          <button type="button" className="btn-secondary" onClick={clearStrokes} disabled={strokeLen === 0}>
            Clear
          </button>
        </div>
      ) : null}
    </div>
  );
});
