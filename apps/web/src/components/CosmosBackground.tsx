import { useMemo } from 'react';
import { generateCosmosStars } from '../lib/cosmos-stars';

export function CosmosBackground({ seed }: { seed: string }) {
  const stars = useMemo(() => generateCosmosStars(seed), [seed]);

  return (
    <div className="cosmos-bg" aria-hidden>
      {stars.map((star, i) => (
        <span
          key={`${seed}-${i}`}
          className="cosmos-star"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.r,
            height: star.r,
            opacity: star.opacity,
          }}
        />
      ))}
    </div>
  );
}
