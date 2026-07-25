import { useCallback, useRef, useState } from 'react';
import { formatAccountCreatedAt } from '../lib/account-created';
import type { CoinTier } from '../lib/coin-tier';
import { coinTierLabel } from '../lib/coin-tier';
import { profileInitials } from '../lib/user-profile';

type Props = {
  displayName: string;
  tier: CoinTier;
  createdAt: number | null;
  size?: number;
};

const TAP_MOVE_PX = 12;

export function ProfileCoinAvatar({ displayName, tier, createdAt, size = 112 }: Props) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const coinRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startRotX: number;
    startRotY: number;
  } | null>(null);
  const rotationRef = useRef({ x: 0, y: 0 });
  const flipYRef = useRef(0);
  const [settling, setSettling] = useState(false);

  const letters = profileInitials(displayName);
  const memberSince = formatAccountCreatedAt(createdAt);
  const fontSize = Math.round(size * 0.34);

  const applyTransform = useCallback((x: number, y: number, animate = false) => {
    const coin = coinRef.current;
    if (!coin) return;
    coin.style.transition = animate ? 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
    coin.style.transform = `rotateX(${x}deg) rotateY(${y + flipYRef.current}deg)`;
  }, []);

  const finishDrag = useCallback(
    (pointerId?: number, tapped = false) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (pointerId !== undefined) sceneRef.current?.releasePointerCapture(pointerId);
      dragRef.current = null;

      if (tapped) {
        flipYRef.current = flipYRef.current === 0 ? 180 : 0;
      }

      rotationRef.current = { x: 0, y: 0 };
      setSettling(true);
      applyTransform(0, 0, true);
      window.setTimeout(() => setSettling(false), 520);
    },
    [applyTransform],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const scene = sceneRef.current;
    if (!scene) return;
    event.preventDefault();
    scene.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRotX: rotationRef.current.x,
      startRotY: rotationRef.current.y,
    };
    setSettling(false);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    const rotY = drag.startRotY + deltaX * 0.9;
    const rotX = drag.startRotX - deltaY * 0.9;
    rotationRef.current = { x: rotX, y: rotY };
    applyTransform(rotX, rotY, false);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    finishDrag(event.pointerId, moved < TAP_MOVE_PX);
  };

  const onPointerCancel = (event: React.PointerEvent<HTMLDivElement>) => finishDrag(event.pointerId);

  return (
    <div
      ref={sceneRef}
      className={`user-profile-coin-scene user-profile-coin-scene--${tier}${settling ? ' user-profile-coin-scene--settling' : ''}`}
      style={{ width: size, height: size }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      role="img"
      aria-label={`${coinTierLabel(tier)} member avatar. Tap to flip or drag to spin.`}
    >
      <div ref={coinRef} className={`user-profile-coin user-profile-coin--${tier}`}>
        <div className="user-profile-coin-rim" aria-hidden />
        <div className="user-profile-coin-face user-profile-coin-face--front">
          <span className="user-profile-coin-initials" style={{ fontSize }} aria-hidden>
            {letters}
          </span>
        </div>
        <div className="user-profile-coin-face user-profile-coin-face--back" aria-hidden>
          <div className="user-profile-coin-back-copy">
            <span className="user-profile-coin-back-kicker">Member since</span>
            <span className="user-profile-coin-back-date">{memberSince}</span>
            <span className="user-profile-coin-back-tier">{coinTierLabel(tier)}</span>
          </div>
        </div>
        <div className="user-profile-coin-shine" aria-hidden />
      </div>
    </div>
  );
}
