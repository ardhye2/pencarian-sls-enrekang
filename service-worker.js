/**
 * SERVICE WORKER — Pencarian SLS & Desa Enrekang (PWA)
 * -----------------------------------------------------
 * Tujuan: agar situs bisa di-"Add to Home Screen" dan tetap bisa dibuka saat
 * offline, menampilkan data dusun/SLS & desa terakhir yang tersimpan di
 * dalam file index.html itu sendiri (karena datanya sudah tertanam langsung
 * di HTML, bukan diambil lewat request terpisah).
 *
 * PENTING kalau Anda mengganti/upload ulang index.html versi baru:
 *   naikkan angka CACHE_VERSION di bawah supaya browser pengguna mengambil
 *   ulang file yang sudah diperbarui, bukan memakai cache lama selamanya.
 */
const CACHE_VERSION = 'v2';
const CACHE_NAME = 'sls-enrekang-' + CACHE_VERSION;

// Berkas inti aplikasi (app shell) yang wajib tersedia offline.
// Path relatif terhadap lokasi service-worker.js ini di GitHub Pages.
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './peta_wilayah_enrekang.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        CORE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            // Jangan gagalkan instalasi SW hanya karena satu file gagal di-cache
            // (misalnya peta_wilayah_enrekang.svg belum diupload ke folder yang sama).
            console.warn('[SW] Gagal cache:', url, err);
          })
        )
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Hanya tangani request GET ke origin sendiri (file-file aplikasi ini).
  // Request ke luar (tile peta MapLibre/OpenFreeMap/Esri, Google Sheets Apps
  // Script, Google Fonts, Photon, dsb.) dibiarkan berjalan langsung lewat
  // jaringan seperti biasa — supaya data selalu yang terbaru saat online, dan
  // tidak membuat aplikasi terlihat "nyangkut" pakai data basi saat offline.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => cached); // offline & belum ada di cache -> gagal total, tidak apa

      // Cache-first: kalau sudah ada di cache, tampilkan langsung (cepat + offline-ready),
      // sambil tetap mengambil versi terbaru di latar belakang untuk kunjungan berikutnya.
      return cached || networkFetch;
    })
  );
});
