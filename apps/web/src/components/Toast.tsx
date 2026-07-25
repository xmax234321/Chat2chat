import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { registerNotificationSink } from '../lib/notify';

interface ToastContextValue {
  show: (message: string) => void;
}

interface Banner {
  id: number;
  kind: 'toast' | 'message';
  title?: string;
  body: string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_MS = 2500;
const MESSAGE_MS = 4200;
const MAX_VISIBLE_BANNERS = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const timeoutsRef = useRef<Map<number, number>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timeoutId = timeoutsRef.current.get(id);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      timeoutsRef.current.delete(id);
    }
    setBanners((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutsRef.current.clear();
    setBanners([]);
  }, []);

  const pushBanner = useCallback(
    (kind: Banner['kind'], body: string, title?: string) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setBanners((prev) => {
        const next = [...prev, { id, kind, title, body }];
        if (next.length <= MAX_VISIBLE_BANNERS) return next;
        const dropped = next.slice(0, next.length - MAX_VISIBLE_BANNERS);
        for (const banner of dropped) {
          const timeoutId = timeoutsRef.current.get(banner.id);
          if (timeoutId !== undefined) {
            window.clearTimeout(timeoutId);
            timeoutsRef.current.delete(banner.id);
          }
        }
        return next.slice(-MAX_VISIBLE_BANNERS);
      });
      const timeoutId = window.setTimeout(
        () => dismiss(id),
        kind === 'message' ? MESSAGE_MS : TOAST_MS,
      );
      timeoutsRef.current.set(id, timeoutId);
    },
    [dismiss],
  );

  const show = useCallback(
    (message: string) => {
      pushBanner('toast', message);
    },
    [pushBanner],
  );

  const handleBannerClick = useCallback(
    async (banner: Banner) => {
      const text = banner.title ? `${banner.title}: ${banner.body}` : banner.body;
      if (/error|failed|upload failed|download failed|could not/i.test(text) && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          pushBanner('toast', 'Error copied');
        } catch {
          /* clipboard blocked */
        }
      }
      dismiss(banner.id);
    },
    [dismiss, pushBanner],
  );

  useEffect(() => {
    registerNotificationSink({
      toast: show,
      message: (title, body) => pushBanner('message', body, title),
    });
    return () => registerNotificationSink(null);
  }, [show, pushBanner]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {banners.length > 0 &&
        createPortal(
          <div className="notification-stack" aria-live="polite">
            {banners.map((banner) => (
              <button
                key={banner.id}
                type="button"
                className={`notification-banner${banner.kind === 'message' ? ' notification-banner--message' : ''}`}
                onClick={() => void handleBannerClick(banner)}
                onDoubleClick={() => dismissAll()}
                aria-label="Dismiss notification"
              >
                {banner.title && <div className="notification-banner-title">{banner.title}</div>}
                <div className="notification-banner-body">{banner.body}</div>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast outside provider');
  return ctx;
}
