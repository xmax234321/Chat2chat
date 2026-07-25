import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldBlockScreenshots } from './screenshot-protection-routes.ts';

describe('shouldBlockScreenshots', () => {
  it('blocks chat list and conversations', () => {
    assert.equal(shouldBlockScreenshots('/chats'), true);
    assert.equal(shouldBlockScreenshots('/chat/c2c_abc'), true);
  });

  it('blocks contact and group profiles', () => {
    assert.equal(shouldBlockScreenshots('/contact/c2c_abc/profile'), true);
    assert.equal(shouldBlockScreenshots('/group/grp_abc/profile'), true);
    assert.equal(shouldBlockScreenshots('/settings/profile'), true);
  });

  it('blocks desktop messenger', () => {
    assert.equal(shouldBlockScreenshots('/app'), true);
    assert.equal(shouldBlockScreenshots('/app/c2c_abc'), true);
  });

  it('allows settings and onboarding', () => {
    assert.equal(shouldBlockScreenshots('/settings'), false);
    assert.equal(shouldBlockScreenshots('/settings/backup'), false);
    assert.equal(shouldBlockScreenshots('/onboarding/seed'), false);
    assert.equal(shouldBlockScreenshots('/add-contact'), false);
    assert.equal(shouldBlockScreenshots('/calls'), false);
  });
});
