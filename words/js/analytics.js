// Cloudflare Web Analytics (cookieless, no personal data). Loaded only on the
// production host so local development and automated tests don't send beacons.
export const CF_ANALYTICS = {
  token: 'fd0db7a5d3e946f39be6ce44cc1c35dc', // empty string = off
  hosts: ['synoikon.com', 'www.synoikon.com', 'lessthan301.github.io'],
  src: 'https://static.cloudflareinsights.com/beacon.min.js',
};

export function loadAnalytics(cfg = CF_ANALYTICS) {
  if (!cfg.token || !cfg.hosts.includes(location.hostname) || document.querySelector('script[data-cf-beacon]')) return false;
  const s = document.createElement('script');
  s.defer = true;
  s.src = cfg.src;
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: cfg.token, spa: true }));
  document.head.appendChild(s);
  return true;
}
