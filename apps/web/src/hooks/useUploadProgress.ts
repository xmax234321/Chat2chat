import { useEffect, useState } from 'react';
import { formatFileSize } from '../lib/file-mini-badge';

const RING_C = 2 * Math.PI * 17;

export function useUploadProgress(
  uploading: boolean,
  fileSize?: number,
  reportedProgress?: number,
) {
  const [fallback, setFallback] = useState(0);
  const [showDelivered, setShowDelivered] = useState(false);

  const hasReported = reportedProgress !== undefined && reportedProgress >= 0;

  useEffect(() => {
    if (uploading) {
      setShowDelivered(false);
      if (hasReported) {
        setFallback(0);
        return;
      }
      setFallback(0);
      const id = window.setInterval(() => {
        setFallback((p) => Math.min(88, p + 2));
      }, 48);
      return () => window.clearInterval(id);
    }

    if (hasReported || fallback > 0) {
      setShowDelivered(true);
      const t = window.setTimeout(() => setShowDelivered(false), 700);
      return () => window.clearTimeout(t);
    }
  }, [uploading, hasReported, fallback]);

  const progress = uploading
    ? hasReported
      ? reportedProgress!
      : fallback
    : 100;

  const pct = Math.min(100, Math.round(progress));
  const sizeStr = formatFileSize(fileSize ?? 0);

  let subLabel: string;
  if (showDelivered && !uploading) {
    subLabel = 'Delivered ✓';
  } else if (pct < 12) {
    subLabel = 'Preparing video…';
  } else if (pct < 30) {
    subLabel = `Encrypting · ${pct}%`;
  } else if (pct >= 96) {
    subLabel = 'Finishing…';
  } else if (sizeStr) {
    subLabel = `${pct}% · ${sizeStr}`;
  } else {
    subLabel = `${pct}%`;
  }

  return {
    pct,
    subLabel,
    ringOffset: RING_C * (1 - pct / 100),
    showDelivered: showDelivered && !uploading,
  };
}
