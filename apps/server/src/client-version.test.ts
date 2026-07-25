import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compareVersions, isClientVersionSupported } from './client-version.js';

describe('compareVersions', () => {
  it('orders semver tuples', () => {
    assert.equal(compareVersions('1.4.2', '1.4.1'), 1);
    assert.equal(compareVersions('1.4.1', '1.4.2'), -1);
    assert.equal(compareVersions('1.4.2', '1.4.2'), 0);
  });
});

describe('isClientVersionSupported', () => {
  const minimum = { version: '1.5', build: '52' };

  it('rejects missing version', () => {
    assert.equal(isClientVersionSupported(null, minimum), false);
    assert.equal(isClientVersionSupported({ version: '', build: '50' }, minimum), false);
  });

  it('rejects older marketing versions', () => {
    assert.equal(isClientVersionSupported({ version: '1.4.1', build: '99' }, minimum), false);
  });

  it('rejects same version with lower build', () => {
    assert.equal(isClientVersionSupported({ version: '1.5', build: '51' }, minimum), false);
    assert.equal(isClientVersionSupported({ version: '1.4.2', build: '99' }, minimum), false);
  });

  it('accepts minimum and newer builds', () => {
    assert.equal(isClientVersionSupported({ version: '1.5', build: '52' }, minimum), true);
    assert.equal(isClientVersionSupported({ version: '1.5', build: '53' }, minimum), true);
    assert.equal(isClientVersionSupported({ version: '1.6', build: '1' }, minimum), true);
  });
});
