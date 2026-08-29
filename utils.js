function paginate(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 25));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function parseJsonSafe(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

function toTagsArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

async function generateReference(dbAll) {
  const year = new Date().getFullYear();
  const rows = await dbAll(`SELECT COUNT(*)::int c FROM besoins WHERE reference LIKE ?`, [`BES-${year}-%`]);
  const n = (rows[0]?.c || 0) + 1;
  return `BES-${year}-${String(n).padStart(4, '0')}`;
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = { paginate, parseJsonSafe, toTagsArray, generateReference, nowIso };
