import { useCallback, useEffect, useRef, useState } from 'react';

function formatVideoTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function MediaViewerVideo({
  src,
  chrome,
  onToggleChrome,
}: {
  src: string;
  chrome: boolean;
  onToggleChrome: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [seeking, setSeeking] = useState(false);

  useEffect(() => {
    setPlaying(true);
    setBuffering(true);
    setCurrent(0);
    setDuration(0);
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = muted;

    const tryPlay = () => {
      if (!playing) return;
      void video
        .play()
        .then(() => {
          setPlaying(true);
          setBuffering(false);
        })
        .catch(() => {
          setPlaying(false);
          setBuffering(false);
        });
    };

    if (playing) {
      if (video.readyState >= 2) tryPlay();
      else video.addEventListener('canplay', tryPlay, { once: true });
    } else {
      video.pause();
    }

    return () => {
      video.removeEventListener('canplay', tryPlay);
    };
  }, [playing, muted, src]);

  const onLoaded = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration || 0);
    setCurrent(video.currentTime || 0);
    if (playing) setBuffering(false);
  };

  const onTimeUpdate = () => {
    if (seeking) return;
    const video = videoRef.current;
    if (!video) return;
    setCurrent(video.currentTime);
    setDuration(video.duration || 0);
  };

  const togglePlay = useCallback(() => {
    setPlaying((p) => !p);
  }, []);

  const onVideoTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleChrome();
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const next = Number(e.target.value);
    setCurrent(next);
    video.currentTime = next;
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;
  const showPlayOverlay = !playing && !buffering && chrome;

  return (
    <div className="media-viewer-video-wrap">
      <video
        ref={videoRef}
        src={src}
        className="media-viewer-video"
        playsInline
        autoPlay
        preload="auto"
        onLoadedMetadata={onLoaded}
        onTimeUpdate={onTimeUpdate}
        onPlaying={() => {
          setPlaying(true);
          setBuffering(false);
        }}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onEnded={() => setPlaying(false)}
        onClick={onVideoTap}
      />
      {buffering && (
        <div className="media-viewer-video-buffering" aria-hidden>
          <span className="media-viewer-video-spinner" />
        </div>
      )}
      {showPlayOverlay && (
        <button type="button" className="media-viewer-video-play" onClick={togglePlay} aria-label="Play">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}
      <div className={`media-viewer-video-controls${chrome ? '' : ' media-viewer-video-controls-hidden'}`}>
        <input
          type="range"
          className="media-viewer-video-scrubber"
          min={0}
          max={duration || 0}
          step={0.05}
          value={current}
          style={{ '--progress': `${progress}%` } as React.CSSProperties}
          onChange={onSeek}
          onPointerDown={() => setSeeking(true)}
          onPointerUp={() => setSeeking(false)}
          onClick={(e) => e.stopPropagation()}
          aria-label="Seek"
        />
        <div className="media-viewer-video-row">
          <button type="button" className="media-viewer-video-btn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <span className="media-viewer-video-time">
            {formatVideoTime(current)} / {formatVideoTime(duration)}
          </span>
          <button
            type="button"
            className="media-viewer-video-btn media-viewer-video-btn-end"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5 6 9H2v6h4l5 4V5z" />
                <path d="m22 9-6 6M16 9l6 6" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5 6 9H2v6h4l5 4V5z" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
