import { supabase } from './supabaseClient';

const BASE = '/api';

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const auth = await authHeader();
  const hadToken = Boolean(auth.Authorization);
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...auth,
    },
    ...options,
  });
  if (res.status === 401) {
    // On ne force une reconnexion (déconnexion + retour à /login) que si on avait
    // réellement un jeton qui a été rejeté (session expirée). Si l'appel a été fait
    // sans jeton (utilisateur pas encore connecté, ex. sur /login), on se contente de
    // signaler l'erreur sans recharger la page : sinon un appel API déclenché en
    // arrière-plan avant la connexion (ex. chargement des listes de statuts) provoque
    // une boucle de rechargement infinie.
    if (hadToken && window.location.pathname !== '/login') {
      await supabase.auth.signOut();
      window.location.href = '/login';
    }
    throw new Error('Session expirée, merci de vous reconnecter.');
  }
  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    try {
      const data = await res.json();
      message = data.error || message;
    } catch { /* ignore */ }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' }),
};

// Déclenche le téléchargement d'un fichier depuis une route API protégée
// (un lien <a href="/api/..."> classique n'enverrait pas le jeton de session).
export async function downloadFile(path, filenameFallback) {
  const auth = await authHeader();
  const res = await fetch(`${BASE}${path}`, { headers: auth });
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : filenameFallback;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function qs(params) {
  const clean = Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const s = new URLSearchParams(clean).toString();
  return s ? `?${s}` : '';
}
