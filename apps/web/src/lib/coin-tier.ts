export type CoinTier = 'silver' | 'gold' | 'diamond';

const GOLD_MIN_DAYS = 90;
const DIAMOND_MIN_DAYS = 365;

export function coinTierForCreatedAt(createdAt: number | null): CoinTier {
  if (!createdAt) return 'silver';
  const ageDays = (Date.now() - createdAt) / 86_400_000;
  if (ageDays >= DIAMOND_MIN_DAYS) return 'diamond';
  if (ageDays >= GOLD_MIN_DAYS) return 'gold';
  return 'silver';
}

export function coinTierLabel(tier: CoinTier): string {
  switch (tier) {
    case 'diamond':
      return 'Diamond';
    case 'gold':
      return 'Gold';
    case 'silver':
      return 'Silver';
  }
}
