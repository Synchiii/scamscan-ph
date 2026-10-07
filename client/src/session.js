export function watchSessionExpiry(expiresAt, onExpired, browser = window) {
  const deadline = new Date(expiresAt).getTime();
  if (!Number.isFinite(deadline)) return () => {};
  let timer;
  let stopped = false;
  const stop = () => {
    stopped = true;
    browser.clearTimeout(timer);
    browser.removeEventListener('focus', check);
    browser.document.removeEventListener('visibilitychange', onVisible);
  };
  const check = () => {
    if (stopped) return;
    browser.clearTimeout(timer);
    const remaining = deadline - Date.now();
    if (remaining <= 0) { stop(); onExpired(); }
    else timer = browser.setTimeout(check, Math.min(remaining, 2_147_483_647));
  };
  const onVisible = () => { if (browser.document.visibilityState === 'visible') check(); };
  browser.addEventListener('focus', check);
  browser.document.addEventListener('visibilitychange', onVisible);
  check();
  return stop;
}
