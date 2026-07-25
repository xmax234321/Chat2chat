import { useEffect, useRef, useState } from 'react';
import { AppIconBadge } from './brand/AppIconBadge';
import { Chat2ChatWordmark } from './brand/Chat2ChatWordmark';
import { isEntryAnimationEnabled } from '../lib/app-lock-settings';

const HOLD_MS = 520;
const FADE_MS = 360;
const SEQUENCE_MS = 1180;

export type EntryAnimationVariant = 'app' | 'lock';

export function EntryAnimation({
  onComplete,
}: {
  variant?: EntryAnimationVariant;
  onComplete: () => void;
}) {
  const [exiting, setExiting] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!isEntryAnimationEnabled()) {
      onCompleteRef.current();
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      onCompleteRef.current();
      return;
    }

    const exitTimer = window.setTimeout(() => setExiting(true), SEQUENCE_MS + HOLD_MS);
    const doneTimer = window.setTimeout(() => onCompleteRef.current(), SEQUENCE_MS + HOLD_MS + FADE_MS);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  if (!isEntryAnimationEnabled()) return null;

  return (
    <div
      className={`entry-splash${exiting ? ' entry-splash--exit' : ''}`}
      role="presentation"
      aria-hidden
    >
      <div className="entry-splash-inner">
        <AppIconBadge tile={52} mark={30} className="entry-splash-icon auth-welcome-icon" />
        <Chat2ChatWordmark className="entry-splash-title auth-welcome-title" size="md" />
        <p className="entry-splash-byline">by jobless</p>
      </div>
    </div>
  );
}
