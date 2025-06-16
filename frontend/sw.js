self.addEventListener('install', (e) => {
  console.log('✅ Service Worker instalado');
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Offline fallback o control de red si quisieras agregar más adelante
});