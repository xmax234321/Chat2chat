import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RELAY_CANDIDATES, RELAY_HTTP_URL, RELAY_WS_URL } from './relay-config.js';

describe('relay-config', () => {
  it('uses HTTPS production relay, not legacy IP', () => {
    assert.ok(RELAY_HTTP_URL.startsWith('https://'));
    assert.ok(RELAY_WS_URL.startsWith('wss://'));
    assert.ok(!RELAY_HTTP_URL.includes('161.104.17.85'));
    assert.ok(!RELAY_WS_URL.includes('161.104.17.85'));
  });

  it('does not ship dev relay in production candidate list', () => {
    for (const c of RELAY_CANDIDATES) {
      assert.ok(!c.http.includes('161.104.17.85'));
      assert.ok(!c.ws.includes('161.104.17.85'));
    }
    if (!import.meta.env?.DEV) {
      assert.equal(RELAY_CANDIDATES.length, 1);
    }
  });
});
