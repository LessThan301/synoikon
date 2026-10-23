// Service worker registration + "Install app" button (Chromium's beforeinstallprompt).
export function setupPWA({ installButton } = {}) {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), { scope: new URL('../', import.meta.url).pathname })
      .catch((err) => console.info('Service worker not registered:', err.message));
  }
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();          // show our own button instead of the mini-infobar
    deferred = e;
    installButton?.classList.remove('hidden');
  });
  window.addEventListener('appinstalled', () => { deferred = null; installButton?.classList.add('hidden'); });
  installButton?.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') installButton.classList.add('hidden');
    deferred = null;
  });
  if (matchMedia('(display-mode: standalone)').matches) document.documentElement.classList.add('standalone');
}
