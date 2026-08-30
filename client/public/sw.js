/*
 * Service worker Neogia CRM — PWA installable (iOS/Android).
 *
 * RÈGLE DE SÉCURITÉ (données confidentielles clients/candidats) :
 *   - Ce service worker ne met JAMAIS en cache les appels /api/*, ni aucune
 *     requête vers Supabase (auth, base de données, storage/CV). Ces
 *     requêtes passent toujours directement au réseau, sans lecture ni
 *     écriture de cache, et sans repli sur une réponse en cache en cas
 *     d'échec.
 *   - Seuls les fichiers statiques nécessaires à l'interface (JS/CSS/police/
 *     icônes/manifest/page hors-ligne) sont mis en cache : c'est le
 *     "coquille" (app shell) de l'application, jamais son contenu.
 *   - Hors connexion, une page dédiée explique clairement la situation au
 *     lieu d'afficher des données potentiellement obsolètes.
 */

const CACHE_VERSION = 'neogia-crm-shell-v1';
const OFFLINE_URL = '/offline.html';

// Fichiers du "coquille" connus à l'installation. Les bundles JS/CSS générés
// par Vite (noms hashés) sont mis en cache à la volée lors de leur premier
// chargement réussi (voir handleAsset ci-dessous) — impossible de connaître
// leurs noms exacts à l'avance depuis ce fichier statique.
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.json',
  '/icons/icon-96.png',
  '/icons/icon-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isApiOrData(url) {
  // Jamais de cache pour l'API applicative ni pour Supabase (auth/DB/storage).
  if (url.pathname.startsWith('/api/')) return true;
  if (url.hostname.endsWith('.supabase.co')) return true;
  return false;
}

function isStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json' ||
    /\.(?:js|css|woff2?|ttf|svg|png|jpg|jpeg|ico)$/.test(url.pathname)
  );
}

async function handleNavigation(request) {
  try {
    // Toujours privilégier le réseau pour la page elle-même : jamais de
    // contenu applicatif obsolète servi depuis le cache.
    return await fetch(request);
  } catch (err) {
    const cache = await caches.open(CACHE_VERSION);
    const offline = await cache.match(OFFLINE_URL);
    return offline || new Response('Hors ligne', { status: 503 });
  }
}

async function handleAsset(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) {
    // Stale-while-revalidate : sert immédiatement, rafraîchit en arrière-plan.
    fetch(request)
      .then((res) => {
        if (res && res.ok) cache.put(request, res.clone());
      })
      .catch(() => {});
    return cached;
  }
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    return new Response('', { status: 504 });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // laisser passer POST/PUT/DELETE sans interception

  const url = new URL(request.url);

  if (isApiOrData(url)) return; // jamais intercepté : direct au réseau, jamais de cache

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(handleAsset(request));
  }
  // Tout le reste (autres origines non listées, etc.) : comportement réseau par défaut.
});
