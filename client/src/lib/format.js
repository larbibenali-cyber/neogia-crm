export function formatDate(iso, withTime = false) {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') || iso.includes(' ') ? iso.replace(' ', 'T') : `${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  const opts = { day: '2-digit', month: '2-digit', year: 'numeric' };
  if (withTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
  return d.toLocaleDateString('fr-FR', opts);
}

export function timeAgo(iso) {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') || iso.includes(' ') ? iso.replace(' ', 'T') : `${iso}T00:00:00`);
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.round(diffMs / 86400000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays === -1) return 'Demain';
  if (diffDays > 1 && diffDays < 30) return `il y a ${diffDays} j`;
  if (diffDays < -1 && diffDays > -30) return `dans ${-diffDays} j`;
  return formatDate(iso);
}

export function formatMoney(v) {
  if (v === null || v === undefined || v === '') return '—';
  return `${Number(v).toLocaleString('fr-FR')} €`;
}

export function initials(prenom, nom) {
  return `${(prenom || '?')[0] || ''}${(nom || '')[0] || ''}`.toUpperCase();
}

// Normalise l'AFFICHAGE d'un numéro français ("06 99 51 88 12"), sans jamais
// modifier la valeur d'origine stockée en base. Gère les préfixes internationaux
// (+33 / 0033) et les doubles numéros séparés par "/" (on n'affiche que le premier).
// Si la valeur ne ressemble pas à un numéro FR à 10 chiffres, on la ré-affiche telle
// quelle plutôt que de risquer une mise en forme erronée.
export function formatPhoneFR(raw) {
  if (!raw) return '';
  const first = String(raw).split('/')[0].trim();
  let digits = first.replace(/\D/g, '');
  if (digits.startsWith('0033') && digits.length === 13) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith('33') && digits.length === 11) digits = `0${digits.slice(2)}`;
  if (digits.length !== 10 || !digits.startsWith('0')) return first;
  return digits.match(/.{1,2}/g).join(' ');
}

// Construit un lien tel: exploitable depuis un iPhone à partir de la valeur brute
// (gère les mêmes cas que formatPhoneFR : préfixe international, doubles numéros).
export function phoneHref(raw) {
  if (!raw) return null;
  const first = String(raw).split('/')[0].trim();
  let digits = first.replace(/\D/g, '');
  if (digits.startsWith('0033') && digits.length === 13) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith('33') && digits.length === 11) digits = `0${digits.slice(2)}`;
  if (!digits) return null;
  return `tel:${digits}`;
}
