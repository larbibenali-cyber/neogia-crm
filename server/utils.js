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

// Normalise le statut d'un besoin vers les catégories synthétiques utilisées par le
// tableau de bord ("Besoins par statut"). Depuis la simplification du pick-list
// `besoin_status` à 3 valeurs (en_cours / a_venir / perdu, alignées sur le fichier
// Excel d'origine), `statut` et `statut_synthese` portent la même classification —
// cette fonction ne fait plus que traduire le slug technique vers le libellé
// affiché, tout en restant tolérante aux anciennes valeurs (imports existants,
// `statut_source` brut) pour ne rien casser sur les données déjà en base.
function computeSyntheseStatut(statut, statutSource) {
  const s = (statut || '').trim().toLowerCase();
  if (s === 'en_cours') return 'En cours';
  if (s === 'a_venir') return 'À venir';
  if (s === 'perdu') return 'Perdu';
  if (s === 'cloture') return 'Clôturé';

  // Anciennes valeurs du pick-list (avant simplification) — conservées pour
  // ne pas casser d'éventuelles données non encore migrées.
  if (['lead_a_qualifier', 'besoin_potentiel', 'besoin_confirme'].includes(s)) return 'À venir';
  if (['recherche_en_cours', 'candidats_positionnes', 'entretiens_en_cours'].includes(s)) return 'En cours';
  if (s === 'candidat_retenu' || s === 'gagne') return 'Gagné';
  if (s === 'suspendu') return 'Suspendu';

  // Repli sur le statut brut importé (variantes de casse/espaces : "A venir ", ...)
  const src = (statutSource || '').trim().toLowerCase();
  if (src === 'a venir' || src === 'à venir') return 'À venir';
  if (src === 'en cours') return 'En cours';
  if (src === 'perdu') return 'Perdu';
  if (src === 'gagne' || src === 'gagné') return 'Gagné';
  if (src === 'cloture' || src === 'clôturé') return 'Clôturé';

  return 'À venir';
}

module.exports = { paginate, parseJsonSafe, toTagsArray, generateReference, nowIso, computeSyntheseStatut };
