// Moteur de rapprochement candidat <-> besoin.
// Fournit un score d'aide à la décision (jamais un positionnement automatique).
const { dbAll } = require('../db/pg');

function normWord(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .trim();
}

function tokenSet(s) {
  return new Set(normWord(s).split(/\s+/).filter((w) => w.length > 2));
}

function jaccard(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const w of setA) if (setB.has(w)) inter++;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : inter / union;
}

function parseMinExperience(niveau) {
  if (!niveau) return null;
  const m = String(niveau).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

async function getBesoinTechIds(besoinId) {
  return dbAll(`SELECT technology_id, obligatoire FROM besoin_technologies WHERE besoin_id = ?`, [besoinId]);
}
async function getCandidatTechIds(candidatId) {
  const rows = await dbAll(`SELECT technology_id FROM candidat_technologies WHERE candidat_id = ?`, [candidatId]);
  return rows.map((r) => r.technology_id);
}
async function getEntrepriseTechIds(entrepriseId) {
  const rows = await dbAll(`SELECT technology_id FROM entreprise_technologies WHERE entreprise_id = ?`, [entrepriseId]);
  return rows.map((r) => r.technology_id);
}

async function computeMatchScore(besoin, candidat) {
  const besoinTechs = await getBesoinTechIds(besoin.id);
  const obligatoires = besoinTechs.filter((t) => t.obligatoire).map((t) => t.technology_id);
  const appreciees = besoinTechs.filter((t) => !t.obligatoire).map((t) => t.technology_id);
  const candTechIds = new Set(await getCandidatTechIds(candidat.id));
  const entTechIds = new Set(await getEntrepriseTechIds(besoin.entreprise_id));

  const matched = [];
  const missing = [];
  let score = 0;

  // Compétences obligatoires (45 pts)
  if (obligatoires.length > 0) {
    const hit = obligatoires.filter((id) => candTechIds.has(id));
    const ratio = hit.length / obligatoires.length;
    score += ratio * 45;
    if (hit.length > 0) matched.push(`${hit.length}/${obligatoires.length} compétence(s) obligatoire(s)`);
    const missingIds = obligatoires.filter((id) => !candTechIds.has(id));
    if (missingIds.length) {
      const names = (await dbAll(
        `SELECT nom FROM technologies WHERE id = ANY(?::bigint[])`,
        [missingIds]
      )).map((r) => r.nom);
      missing.push(...names);
    }
  } else {
    score += 20; // pas d'exigence stricte -> neutre
  }

  // Compétences appréciées + stack client (15 pts)
  const bonusPool = new Set([...appreciees, ...entTechIds]);
  if (bonusPool.size > 0) {
    const hit = [...bonusPool].filter((id) => candTechIds.has(id));
    score += Math.min(1, hit.length / Math.max(1, bonusPool.size)) * 15;
    if (hit.length > 0) matched.push(`${hit.length} techno(s) appréciée(s)/environnement client en commun`);
  }

  // Métier / intitulé (15 pts)
  const besoinText = tokenSet(`${besoin.titre || ''} ${besoin.missions || ''} ${besoin.niveau_experience || ''}`);
  const candText = tokenSet(`${candidat.metier || ''} ${candidat.intitule_profil || ''} ${candidat.competences_principales || ''}`);
  const sim = jaccard(besoinText, candText);
  score += sim * 15;
  if (sim > 0.15) matched.push('Intitulé / métier cohérent');

  // Expérience (15 pts)
  const minExp = parseMinExperience(besoin.niveau_experience);
  if (minExp !== null && candidat.annees_experience !== null && candidat.annees_experience !== undefined) {
    if (candidat.annees_experience >= minExp) {
      score += 15;
      matched.push(`Expérience suffisante (${candidat.annees_experience} ans)`);
    } else {
      score += Math.max(0, (candidat.annees_experience / minExp)) * 15;
      missing.push(`Expérience (${candidat.annees_experience} ans vs ${minExp}+ attendus)`);
    }
  } else {
    score += 7;
  }

  // Disponibilité (10 pts)
  if (candidat.statut === 'disponible') { score += 10; matched.push('Disponible immédiatement'); }
  else if (candidat.statut === 'prochainement_disponible') { score += 6; matched.push('Prochainement disponible'); }
  else { score += 2; }

  // Localisation / mobilité (10 pts)
  const locB = normWord(besoin.localisation);
  const locC = normWord(candidat.localisation);
  const mob = normWord(candidat.mobilite);
  if (!locB) {
    score += 5;
  } else if (locC && (locC.includes(locB) || locB.includes(locC))) {
    score += 10; matched.push('Localisation compatible');
  } else if (mob.includes('remote') || mob.includes('teletravail') || mob.includes('france entiere') || mob.includes('national')) {
    score += 8; matched.push('Mobilité / télétravail compatible');
  } else {
    score += 2;
    missing.push('Localisation à confirmer');
  }

  return {
    score: Math.round(Math.max(0, Math.min(100, score))),
    matched,
    missing: [...new Set(missing)],
  };
}

module.exports = { computeMatchScore };
