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

// Normalise le statut d'un besoin vers 4 catégories synthétiques stables, utilisées
// par le tableau de bord ("Besoins par statut") — distinctes du pick-list interne
// `statut` (lead_a_qualifier, besoin_confirme, ...) et du `statut_source` brut importé
// (qui peut contenir des variantes de casse/espaces : "A venir ", "a venir ", ...).
function computeSyntheseStatut(statut, statutSource) {
  const src = (statutSource || '').trim().toLowerCase();
  if (src) {
    if (src === 'a venir' || src === 'à venir') return 'À venir';
    if (src === 'en cours') return 'En cours';
    if (src === 'perdu') return 'Perdu';
    if (src === 'gagne' || src === 'gagné') return 'Gagné';
    if (src === 'cloture' || src === 'clôturé') return 'Clôturé';
  }
  const s = statut || '';
  if (['lead_a_qualifier', 'besoin_potentiel', 'besoin_confirme'].includes(s)) return 'À venir';
  if (['recherche_en_cours', 'candidats_positionnes', 'entretiens_en_cours'].includes(s)) return 'En cours';
  if (s === 'candidat_retenu' || s === 'gagne') return 'Gagné';
  if (s === 'perdu') return 'Perdu';
  if (s === 'suspendu' || s === 'cloture') return 'Clôturé';
  return 'À venir';
}

module.exports = { paginate, parseJsonSafe, toTagsArray, generateReference, nowIso, computeSyntheseStatut };
