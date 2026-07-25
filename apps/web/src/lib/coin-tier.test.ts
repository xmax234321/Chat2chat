import assert from 'node:assert/strict';
import test from 'node:test';
import { coinTierForCreatedAt } from './coin-tier.ts';

test('coinTierForCreatedAt assigns tiers by account age', () => {
  const now = Date.now();
  assert.equal(coinTierForCreatedAt(null), 'silver');
  assert.equal(coinTierForCreatedAt(now - 20 * 86_400_000), 'silver');
  assert.equal(coinTierForCreatedAt(now - 120 * 86_400_000), 'gold');
  assert.equal(coinTierForCreatedAt(now - 400 * 86_400_000), 'diamond');
});
