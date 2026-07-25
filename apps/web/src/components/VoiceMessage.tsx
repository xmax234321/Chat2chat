import { useEffect, useRef, useState } from 'react';
import { readCachedMediaBytes } from '../lib/media-cache';

type Props = {
  messageId: string;
  durationMs?: number;
  direction: 'in' | 'out';
  previewUrl?: string;
  uploading?: boolean;
  onCancel?: () => void;
  guardTap?: () => boolean;
};

function formatMs(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function VoiceMessage({
  messageId,
  durationMs = 0,
  direction,
  previewUrl,
  uploading,
  onCancel,
  guardTap,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [src, setSrc] = useState(previewUrl ?? '');
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (previewUrl) {
      setSrc(previewUrl);
      return;
    }
    let revoke: string | null = null;
    let cancelled = false;
    void (async () => {
      const cached = await readCachedMediaBytes(messageId);
      if (cancelled || !cached?.data?.length) return;
      const url = URL.createObjectURL(new Blob([cached.data.slice()], { type: cached.mime }));
      revoke = url;
      setSrc(url);
    })();
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [messageId, previewUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      if (!audio.duration || !Number.isFinite(audio.duration)) return;
      setProgress(audio.currentTime / audio.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
    };
  }, [src]);

  const toggle = async () => {
    if (guardTap?.()) return;
    const audio = audioRef.current;
    if (!audio || !src || uploading) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  return (
    <div className={`voice-msg voice-msg--${direction}${uploading ? ' voice-msg-uploading' : ''}`}>
      <button type="button" className="voice-msg-play" onClick={() => void toggle()} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="voice-msg-body">
        <div className="voice-msg-track" aria-hidden>
          <div className="voice-msg-progress" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <span className="voice-msg-duration">{formatMs(durationMs)}</span>
      </div>
      {uploading && onCancel ? (
        <button type="button" className="voice-msg-cancel" onClick={onCancel} aria-label="Cancel upload">
          ×
        </button>
      ) : null}
      {src ? <audio className="voice-msg-audio" ref={audioRef} src={src} preload="metadata" playsInline /> : null}
    </div>
  );
}
