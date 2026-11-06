// Placeholder period: replaces the app's service worker on returning devices. It deletes every cache,
// unregisters itself and reloads open windows so they show the current page from the network.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) client.navigate(client.url).catch(() => {});
  })());
});
