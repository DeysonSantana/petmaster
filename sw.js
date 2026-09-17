/**
 * PetMaster PWA Service Worker
 * Estratégia: Cache-First com Network Fallback e Stale-While-Revalidate
 */

const CACHE_NAME = 'petmaster-cache-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './assets/icons/icon-192.svg',
  './assets/icons/icon-512.svg',
  './css/style.css',
  './css/pet-animations.css',
  './js/app.js',
  './js/pet.js',
  './js/speciesData.js',
  './js/audio.js',
  './js/themeManager.js',
  './js/authManager.js',
  './js/firebaseConfig.js',
  './js/minigames.js',
  './js/sanctuaryManager.js',
  './js/shareManager.js',
  './js/qrcodeEngine.js',
  './js/offlineManager.js',
  './js/pet3D.js',
  './js/three.min.js'
];

// Instalação: Pré-cache dos ativos estáticos fundamentais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pré-carregando ativos do PetMaster');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Ativação: Limpeza de caches obsoletos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[ServiceWorker] Removendo cache antigo:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Cache-First para arquivos locais; Network com fallback para CDNs externos
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Arquivos locais do mesmo domínio
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Atualiza o cache silenciosamente em background
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          }).catch(() => {});
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // CDNs externos (Tailwind, Lucide, Confetti, Google Fonts)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(request).then((networkResponse) => {
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return networkResponse;
      }).catch(() => {
        // Se falhar e for navegação, serve o index do cache
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
