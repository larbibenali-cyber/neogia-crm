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
