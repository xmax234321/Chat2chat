import { useEffect, useRef, useState } from 'react';
import type { PickedMedia } from '../lib/pick-media';
import { formatRecordMs } from '../hooks/useVoiceHoldRecord';

type Props = {
  preview: PickedMedia;
  onDelete: () => void;
};

export function VoiceRecordPreview({ preview, onDelete }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

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
  }, [preview.previewUrl]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || !preview.previewUrl) return;
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
    <div className="voice-preview-wrap">
      <div className="voice-preview-player">
        <button type="button" className="voice-preview-play" onClick={() => void toggle()} aria-label={playing ? 'Pause' : 'Play'}>
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
        <div className="voice-preview-body">
          <div className="voice-preview-track" aria-hidden>
            <div className="voice-preview-progress" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <span className="voice-preview-duration">{formatRecordMs(preview.durationMs ?? 0)}</span>
        </div>
        {preview.previewUrl ? (
          <audio ref={audioRef} className="voice-preview-audio" src={preview.previewUrl} preload="metadata" playsInline />
        ) : null}
      </div>
      <button type="button" className="voice-preview-delete" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
}
