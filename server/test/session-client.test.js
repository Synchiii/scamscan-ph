import test from 'node:test';
import assert from 'node:assert/strict';
import { watchSessionExpiry } from '../../client/src/session.js';

function fakeBrowser() {
  const browser = new EventTarget();
  browser.document = new EventTarget();
  browser.document.visibilityState = 'visible';
  const timers = new Map();
  let sequence = 0;
  browser.setTimeout = (callback, delay) => { const id = ++sequence; timers.set(id, { callback, delay }); return id; };
  browser.clearTimeout = (id) => timers.delete(id);
  browser.timers = timers;
  return browser;
}

test('an idle browser expires after 30 minutes without an API call', (context) => {
  let now = 1000000;
  context.mock.method(Date, 'now', () => now);
  const browser = fakeBrowser();
  let expirations = 0;
  watchSessionExpiry(new Date(now + 30 * 60000).toISOString(), () => expirations++, browser);
  const scheduled = [...browser.timers.values()][0];
  assert.equal(scheduled.delay, 30 * 60000);
  now += 29 * 60000;
  browser.dispatchEvent(new Event('focus'));
  assert.equal(expirations, 0);
  const remaining = [...browser.timers.values()][0];
  assert.equal(remaining.delay, 60000);
  now += 60000;
  remaining.callback();
  assert.equal(expirations, 1);
  assert.equal(browser.timers.size, 0);
  browser.dispatchEvent(new Event('focus'));
  assert.equal(expirations, 1);
});
test('a background tab checks expiry immediately on focus or visibility restoration', (context) => {
  let now = 1000000;
  context.mock.method(Date, 'now', () => now);
  for (const event of ['focus', 'visibilitychange']) {
    const browser = fakeBrowser();
    let expirations = 0;
    watchSessionExpiry(new Date(now + 60000).toISOString(), () => expirations++, browser);
    now += 120000;
    (event === 'focus' ? browser : browser.document).dispatchEvent(new Event(event));
    assert.equal(expirations, 1);
    assert.equal(browser.timers.size, 0);
  }
});
test('sign-out or account change cancels the previous session timer', (context) => {
  const now = 1000000;
  context.mock.method(Date, 'now', () => now);
  const browser = fakeBrowser();
  let expirations = 0;
  const stop = watchSessionExpiry(new Date(now + 60000).toISOString(), () => expirations++, browser);
  stop();
  assert.equal(browser.timers.size, 0);
  browser.dispatchEvent(new Event('focus'));
  assert.equal(expirations, 0);
});
