export type CosmosStar = {
  x: number;
  y: number;
  r: number;
  opacity: number;
};

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic star field per slide — matches Figma's seeded cosmos layers. */
export function generateCosmosStars(seed: string, count = 140): CosmosStar[] {
  const rand = mulberry32(hashSeed(seed));
  const stars: CosmosStar[] = [];
  for (let i = 0; i < count; i += 1) {
    const roll = rand();
    stars.push({
      x: rand() * 100,
      y: rand() * 100,
      r: roll > 0.92 ? 2.2 : roll > 0.75 ? 1.6 : roll > 0.45 ? 1.1 : 0.7,
      opacity: 0.35 + rand() * 0.65,
    });
  }
  return stars;
}
