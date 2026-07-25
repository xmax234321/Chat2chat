import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import QRCode from 'qrcode';
import { contactDeepLink } from '@chat2chat/crypto/browser';
import { qrRenderOptions } from '../lib/contact-qr';

/** Keep QR payload short — long IDs break SVG renderers in Electron. */
export function contactQrValue(userId: string): string {
  return userId;
}

export function contactShareLink(userId: string): string {
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    const base = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '');
    return `${base}#/?add=${encodeURIComponent(userId)}`;
  }
  return contactDeepLink(userId);
}

export function QrCodeBox({
  value,
  size = 160,
  label,
  expandable = false,
  expandSize = 280,
}: {
  value: string;
  size?: number;
  label?: string;
  expandable?: boolean;
  expandSize?: number;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [expandedSrc, setExpandedSrc] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!value) {
      setSrc(null);
      return;
    }

    let cancelled = false;
    QRCode.toDataURL(value, qrRenderOptions(size, value))
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  useEffect(() => {
    if (!open || !value) {
      setExpandedSrc(null);
      return;
    }

    let cancelled = false;
    QRCode.toDataURL(value, qrRenderOptions(expandSize, value))
      .then((url) => {
        if (!cancelled) setExpandedSrc(url);
      })
      .catch(() => {
        if (!cancelled) setExpandedSrc(null);
      });

    return () => {
      cancelled = true;
    };
  }, [open, value, expandSize]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!value) return null;

  const box = (
    <div
      className={`qr-code-box${expandable ? ' qr-code-box-expandable' : ''}`}
      style={{ width: size + 24, height: size + 24 }}
      onClick={expandable ? () => setOpen(true) : undefined}
      onKeyDown={
        expandable
          ? (e: ReactKeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setOpen(true);
              }
            }
          : undefined
      }
      role={expandable ? 'button' : undefined}
      tabIndex={expandable ? 0 : undefined}
      aria-label={expandable ? 'Enlarge QR code' : undefined}
    >
      {src ? (
        <img src={src} width={size} height={size} alt={label ?? 'QR code'} draggable={false} />
      ) : (
        <div className="qr-code-skeleton" style={{ width: size, height: size }} aria-hidden />
      )}
      {expandable && <span className="qr-code-expand-hint">Tap to enlarge</span>}
    </div>
  );

  return (
    <>
      {box}
      {expandable && open && (
        <div className="qr-lightbox" role="dialog" aria-modal="true" aria-label={label ?? 'QR code'} onClick={() => setOpen(false)}>
          <div className="qr-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="qr-lightbox-close" onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
            {expandedSrc ? (
              <img src={expandedSrc} width={expandSize} height={expandSize} alt={label ?? 'QR code'} draggable={false} />
            ) : (
              <div className="qr-code-skeleton" style={{ width: expandSize, height: expandSize }} aria-hidden />
            )}
            {label && <p className="qr-lightbox-label">{label}</p>}
          </div>
        </div>
      )}
    </>
  );
}
