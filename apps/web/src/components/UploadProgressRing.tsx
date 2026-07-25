import type { ReactNode } from 'react';

const RING_R = 17;
const RING_C = 2 * Math.PI * RING_R;

export function uploadRingOffset(pct: number): number {
  return RING_C * (1 - pct / 100);
}

export function UploadProgressRing({
  size = 40,
  ringOffset,
  children,
}: {
  size?: number;
  ringOffset: number;
  children?: ReactNode;
}) {
  return (
    <div className="upload-progress-ring-wrap" style={{ width: size, height: size }}>
      <svg viewBox="0 0 40 40" className="upload-progress-ring" aria-hidden>
        <circle cx="20" cy="20" r={RING_R} fill="none" stroke="currentColor" strokeWidth="3" className="upload-progress-ring-track" />
        <circle
          cx="20"
          cy="20"
          r={RING_R}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={RING_C.toFixed(1)}
          strokeDashoffset={ringOffset}
          className="upload-progress-ring-progress"
        />
      </svg>
      {children ? <div className="upload-progress-ring-center">{children}</div> : null}
    </div>
  );
}
