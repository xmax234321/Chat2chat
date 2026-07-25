import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  clearChatWallpaper,
  loadChatWallpaper,
  normalizeWallpaperFile,
  saveChatWallpaper,
} from '../lib/chat-wallpaper';
import { hapticImpact } from '../lib/haptics';

const CHROME_PRESETS = ['#0b0b0c', '#121214', '#1a1520', '#0f1418', '#141a12', '#1a1212'] as const;

export function ChatWallpaperEditor() {
  const [hasWallpaper, setHasWallpaper] = useState(false);
  const [blur, setBlur] = useState(12);
  const [chromeColor, setChromeColor] = useState('#0b0b0c');
  const [busy, setBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftImage, setDraftImage] = useState('');
  const [draftBlur, setDraftBlur] = useState(12);
  const hapticStepRef = useRef(0);

  useEffect(() => {
    void loadChatWallpaper().then((w) => {
      setHasWallpaper(Boolean(w.imageDataUrl));
      setBlur(w.blur);
      setChromeColor(w.chromeColor);
    });
  }, []);

  const persistChrome = async (next: string) => {
    setChromeColor(next);
    const current = await loadChatWallpaper();
    if (!current.imageDataUrl) return;
    await saveChatWallpaper({ ...current, chromeColor: next });
  };

  const onPick = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await normalizeWallpaperFile(file);
      setDraftImage(dataUrl);
      setDraftBlur(blur);
      hapticStepRef.current = 0;
      setEditorOpen(true);
    } finally {
      setBusy(false);
    }
  };

  const onDraftBlurChange = (next: number) => {
    setDraftBlur(next);
    const step = Math.floor(next / 2);
    if (step > hapticStepRef.current) {
      hapticStepRef.current = step;
      void hapticImpact('light');
    }
  };

  const applyDraft = async () => {
    setBusy(true);
    try {
      await saveChatWallpaper({ imageDataUrl: draftImage, blur: draftBlur, chromeColor });
      setHasWallpaper(true);
      setBlur(draftBlur);
      setEditorOpen(false);
      void hapticImpact('medium');
    } finally {
      setBusy(false);
    }
  };

  const onBlurChange = async (next: number) => {
    setBlur(next);
    const current = await loadChatWallpaper();
    if (!current.imageDataUrl) return;
    await saveChatWallpaper({ ...current, blur: next });
  };

  const onRemove = async () => {
    setHasWallpaper(false);
    setBlur(12);
    await clearChatWallpaper();
  };

  return (
    <>
      <div className="chat-wallpaper-editor">
        <label className="btn-secondary chat-wallpaper-pick">
          {busy ? 'Processing…' : 'Choose photo'}
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              e.target.value = '';
              void onPick(file);
            }}
          />
        </label>

        {hasWallpaper ? (
          <>
            <label className="chat-wallpaper-blur-row">
              <span>Blur</span>
              <input
                type="range"
                min={0}
                max={40}
                step={1}
                value={blur}
                onChange={(e) => void onBlurChange(Number(e.target.value))}
              />
              <span className="chat-wallpaper-blur-value">{blur}</span>
            </label>

            <div className="chat-wallpaper-chrome">
              <span className="chat-wallpaper-chrome-label">Header &amp; input color</span>
              <div className="chat-wallpaper-chrome-swatches">
                {CHROME_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`chat-wallpaper-chrome-swatch${chromeColor === color ? ' active' : ''}`}
                    style={{ background: color }}
                    aria-label={`Color ${color}`}
                    onClick={() => void persistChrome(color)}
                  />
                ))}
                <label className="chat-wallpaper-chrome-custom" aria-label="Custom color">
                  <input
                    type="color"
                    value={chromeColor}
                    onChange={(e) => void persistChrome(e.target.value)}
                  />
                </label>
              </div>
            </div>

            <button type="button" className="btn-ghost chat-wallpaper-remove" onClick={() => void onRemove()}>
              Remove wallpaper
            </button>
          </>
        ) : null}
      </div>

      {editorOpen
        ? createPortal(
            <div className="share-contact-backdrop" onClick={() => setEditorOpen(false)} role="presentation">
              <div
                className="share-contact-sheet chat-wallpaper-editor-sheet"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Edit wallpaper"
              >
                <div className="share-contact-handle" aria-hidden />
                <h2 className="chat-wallpaper-editor-sheet-title">Edit wallpaper</h2>
                <div className="chat-wallpaper-editor-sheet-preview">
                  <div
                    className="chat-wallpaper-preview"
                    style={{
                      backgroundImage: `url(${draftImage})`,
                      filter: draftBlur > 0 ? `blur(${draftBlur}px)` : undefined,
                    }}
                  />
                </div>
                <label className="chat-wallpaper-blur-row chat-wallpaper-blur-row--sheet">
                  <span>Blur</span>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    step={1}
                    value={draftBlur}
                    onChange={(e) => onDraftBlurChange(Number(e.target.value))}
                  />
                  <span className="chat-wallpaper-blur-value">{draftBlur}</span>
                </label>
                <button
                  type="button"
                  className="btn-primary chat-wallpaper-editor-apply"
                  disabled={busy}
                  onClick={() => void applyDraft()}
                >
                  {busy ? 'Saving…' : 'Apply'}
                </button>
                <button
                  type="button"
                  className="attach-sheet-group attach-sheet-cancel logout-sheet-cancel"
                  onClick={() => setEditorOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
