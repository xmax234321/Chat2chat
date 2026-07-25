import { useCallback, useRef, useState } from 'react';
import { BackIcon } from './Icons';
import { CosmosBackground } from './CosmosBackground';
import { markPrivacyStorySeen, PRIVACY_STORY_SLIDES } from '../lib/privacy-story';

const SWIPE_THRESHOLD = 48;
const TRANSITION_MS = 680;
const TRANSITION_EASE = 'cubic-bezier(0.77, 0, 0.175, 1)';

export function PrivacyStory({ onComplete }: { onComplete: () => void }) {
  const slides = PRIVACY_STORY_SLIDES;
  const [index, setIndex] = useState(0);
  const [dragPx, setDragPx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const finish = useCallback(() => {
    markPrivacyStorySeen();
    onComplete();
  }, [onComplete]);

  const setSlide = (next: number) => {
    if (animating || next === index) return;
    if (next < 0 || next >= slides.length) return;
    if (next > index) setCanGoBack(true);
    setAnimating(true);
    setDragPx(0);
    setIndex(next);
    window.setTimeout(() => setAnimating(false), TRANSITION_MS);
  };

  const goNext = () => {
    if (index >= slides.length - 1) {
      finish();
      return;
    }
    setCanGoBack(true);
    setSlide(index + 1);
  };

  const goPrev = () => {
    if (index <= 0) return;
    setSlide(index - 1);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (animating) return;
    const t = e.changedTouches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const start = touchStart.current;
    if (!start || animating) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (index === 0 && dx > 0) {
      setDragPx(dx * 0.35);
      return;
    }
    if (index === slides.length - 1 && dx < 0) {
      setDragPx(dx * 0.35);
      return;
    }
    setDragPx(dx);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || animating) {
      setDragPx(0);
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    setDragPx(0);
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) goNext();
    else goPrev();
  };

  const width = viewportRef.current?.clientWidth ?? 1;
  const offsetPct = -(index * 100) + (dragPx / width) * 100;
  const isLast = index === slides.length - 1;
  const dotStep = 15;

  return (
    <div
      className="privacy-story privacy-story--fullscreen"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="privacy-story-cosmos" aria-hidden>
        <CosmosBackground seed="privacy-story-sky" />
      </div>
      <div className="privacy-story-viewport" ref={viewportRef}>
        <div
          className={`privacy-story-universe${dragPx !== 0 ? '' : ' privacy-story-universe--rest'}`}
          style={{
            transform: `translate3d(${offsetPct}%, 0, 0)`,
            transitionDuration: dragPx !== 0 ? '0ms' : `${TRANSITION_MS}ms`,
            transitionTimingFunction: TRANSITION_EASE,
          }}
        >
          {slides.map((item, slideIndex) => (
            <section
              key={item.id}
              className={`privacy-story-panel${item.id === 'welcome' ? ' privacy-story-panel--centered' : ''}`}
              aria-hidden={slideIndex !== index}
            >
              <CosmosBackground seed={item.cosmosSeed} />
              <div className="privacy-story-copy">
                <h1 className="privacy-story-title">{item.title}</h1>
                {item.body ? <p className="privacy-story-body">{item.body}</p> : null}
              </div>
            </section>
          ))}
        </div>
      </div>

      <footer className="privacy-story-footer">
        {canGoBack ? (
          <button type="button" className="privacy-story-back" onClick={goPrev} aria-label="Back">
            <BackIcon />
          </button>
        ) : (
          <span className="privacy-story-back-spacer" aria-hidden />
        )}

        <div className="privacy-story-dots" role="tablist" aria-label="Privacy story progress">
          <span
            className="privacy-story-dot-active"
            style={{ transform: `translateX(${index * dotStep}px)` }}
            aria-hidden
          />
          {slides.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1} of ${slides.length}`}
              className="privacy-story-dot"
              onClick={() => {
                if (i > index) setCanGoBack(true);
                setSlide(i);
              }}
            />
          ))}
        </div>

        <button type="button" className="privacy-story-next" onClick={goNext}>
          {isLast ? 'Finish' : 'Next'}
        </button>
      </footer>
    </div>
  );
}
