import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QrScannerProps {
  onScan: (raw: string) => void;
  onError?: (message: string) => void;
  className?: string;
  fullScreen?: boolean;
}

export function QrScanner({ onScan, onError, className, fullScreen = false }: QrScannerProps) {
  const reactId = useId().replace(/:/g, '');
  const containerId = `qr-scan-${reactId}`;
  const [starting, setStarting] = useState(true);
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  const lastScanRef = useRef(0);

  useEffect(() => {
    onScanRef.current = onScan;
    onErrorRef.current = onError;
  }, [onScan, onError]);

  useEffect(() => {
    const el = document.getElementById(containerId);
    if (!el) return;

    const scanner = new Html5Qrcode(containerId, { verbose: false });
    let active = true;

    const pickCamera = async (): Promise<string | { facingMode: string }> => {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras.length) return { facingMode: 'environment' };
        const back = cameras.find((c) => /back|rear|environment/i.test(c.label));
        return back?.id ?? cameras[cameras.length - 1]!.id;
      } catch {
        return { facingMode: 'environment' };
      }
    };

    const start = async () => {
      try {
        const camera = await pickCamera();
        await scanner.start(
          camera,
          {
            fps: 12,
            qrbox: (viewW, viewH) => {
              const edge = Math.floor(Math.min(viewW, viewH) * (fullScreen ? 0.68 : 0.72));
              return { width: edge, height: edge };
            },
            aspectRatio: fullScreen ? 1.777 : 1,
            disableFlip: true,
          },
          (decoded) => {
            const now = Date.now();
            if (now - lastScanRef.current < 1500) return;
            lastScanRef.current = now;
            onScanRef.current(decoded);
          },
          () => {},
        );
        if (active) setStarting(false);
      } catch (err) {
        if (active) {
          onErrorRef.current?.(err instanceof Error ? err.message : 'Camera unavailable');
          setStarting(false);
        }
      }
    };

    void start();

    return () => {
      active = false;
      void scanner.stop().catch(() => {});
    };
  }, [containerId, fullScreen]);

  return (
    <div className={`qr-scanner${fullScreen ? ' qr-scanner--fullscreen' : ''}${className ? ` ${className}` : ''}`}>
      <div id={containerId} className="qr-scanner-view" />
      {starting && <div className="qr-scanner-loading">Starting camera…</div>}
    </div>
  );
}
