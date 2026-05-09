const CACHE_NAME = 'ai-security-pwa-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './manifest.json',
    './icon.svg',
    './js/app.js',
    './js/camera.js',
    './js/ai-analyzer.js',
    './js/alert-system.js',
    './js/voice-recognition.js',
    './js/dashboard.js'
];

// Install Event: Dosyaları önbelleğe al
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(ASSETS);
            })
    );
});

// Activate Event: Eski önbellekleri temizle
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch Event: İnternet yoksa önbellekten, varsa ağdan getir (Network First, Cache Fallback stratejisi)
// Not: MediaPipe CDN linkleri harici olduğu için ve boyutu büyük olduğu için onları cache'lemeyeceğiz.
// İnternet zorunlu olacağı için (AI modeli indirmek için) basit bir passthrough kullanıyoruz.
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});
