/**
 * sw.js — Service Worker（PWA 离线缓存）
 * 策略：网络优先（保证内容最新），网络不可用时回退缓存（离线/弱网可玩）。
 * Strategy: network-first with cache fallback (offline-friendly).
 * 注意：只缓存本站同源静态资源；WebLLM 模型权重由引擎自己存 IndexedDB。
 */
const CACHE = 'ai-studio-v2';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/panel.css',
  './js/config.js',
  './js/main.js',
  './js/scene.js',
  './js/agents.js',
  './js/avatar.js',
  './js/uiPanels.js',
  './js/webllm.js',
  './js/memory.js',
  './js/compiler.js',
  './js/vfs.js',
  './js/logPanel.js',
  './js/detailPanel.js',
  './js/player.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 只处理同源（CDN/模型走网络）
  e.respondWith(
    fetch(req)
      .then((resp) => {
        // 网络成功：更新缓存副本
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return resp;
      })
      .catch(async () => {
        // 网络失败：缓存兜底（导航请求回退到 index.html）
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') {
          const idx = await caches.match('./index.html');
          if (idx) return idx;
        }
        return new Response('', { status: 504, statusText: 'offline' });
      })
  );
});
