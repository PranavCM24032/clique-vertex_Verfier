/*
 * Offline support for the verifier app.
 *
 * This worker is served from the site root, so alongside the app it also
 * intercepts the download landing page. Left unfiltered that causes two real
 * problems: index.html gets pinned to whatever copy happened to be cached on
 * the first visit, so later edits to the landing page never reach returning
 * visitors; and the multi-megabyte .apk/.exe release binaries get pushed into
 * Cache Storage every time somebody clicks a download link. Both are avoided by
 * handling only the app shell and leaving every other request to the browser.
 */

const CACHE = 'np-verifier-v2';
const BASE = new URL('./', self.location.href);

const APP = './app.html';

// Everything the app needs to start offline, including the icons the installed
// PWA asks for. logo.png is cached for that reason only — see SERVED below.
const ASSETS = [
  APP,
  './manifest.webmanifest',
  './logo.png',
  './res/mipmap-xxxhdpi/ic_launcher.png',
  './res/mipmap-xxxhdpi/ic_launcher_foreground.png'
];

// The subset the fetch handler will actually serve. logo.png is deliberately
// excluded: the app page never displays it, the landing page does, and letting
// this worker answer that request would hand the landing page a cached copy of
// its own artwork. It stays in the cache so the installed PWA can still reach
// its icon offline.
const SERVED = ASSETS.filter(p => p !== './logo.png');

const OFFLINE_PATHS = new Set(SERVED.map(p => new URL(p, BASE).pathname));
const APP_PATH = new URL(APP, BASE).pathname;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // One at a time rather than addAll: a single missing icon must not fail the
      // whole install, because a failed install means the worker never activates
      // and the app silently loses offline support.
      .then(c => Promise.all(ASSETS.map(url => c.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      // Drops the v1 cache, which is where the stale landing page copy and any
      // cached release binaries were being kept.
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isAppAsset(url) {
  return url.origin === self.location.origin && OFFLINE_PATHS.has(url.pathname);
}

async function fetchAndCache(request, url) {
  const res = await fetch(request);
  // 'basic' means same-origin. Opaque cross-origin responses are never worth storing.
  if (res && res.ok && res.type === 'basic') {
    const cache = await caches.open(CACHE);
    cache.put(url.href, res.clone());
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // No respondWith for anything else: the landing page and the GitHub release
  // downloads go straight to the network, exactly as if this worker were absent.
  if (!isAppAsset(url)) return;
  e.respondWith(serveAppAsset(e.request, url));
});

async function serveAppAsset(request, url) {
  const cached = await caches.match(request, { ignoreVary: true });
  if (url.pathname === APP_PATH) {
    // The app is a single self-contained file, so cache-first keeps it instant
    // and working offline. A new build refreshes it on the next worker install.
    return cached || fetchAndCache(request, url);
  }
  // Icons and the manifest: answer instantly, then refresh in the background so
  // they don't go stale.
  const network = fetchAndCache(request, url);
  if (cached) network.catch(() => {});
  return cached || network;
}
