const express = require('express');
const { dbGet, dbAll, dbRun } = require('../../db/pg');
const { paginate, generateReference, toTagsArray, computeSyntheseStatut } = require('../utils');
const { computeMatchScore } = require('../matching');

const router = express.Router();

async function attachExtras(b) {
  if (!b) return b;
  b.technologies = await dbAll(`
    SELECT t.id, t.nom, t.categorie, bt.obligatoire FROM besoin_technologies bt JOIN technologies t ON t.id = bt.technology_id
    WHERE bt.besoin_id = ?
  `, [b.id]);
  b.entreprise = await dbGet('SELECT id, nom FROM entreprises WHERE id = ?', [b.entreprise_id]);
  b.contact = b.contact_id ? await dbGet('SELECT id, nom, prenom, email FROM contacts WHERE id = ?', [b.contact_id]) : null;
  b.positionnements = await dbAll(`
    SELECT p.*, c.nom as candidat_nom, c.prenom as candidat_prenom
    FROM positionnements p JOIN candidats c ON c.id = p.candidat_id
    WHERE p.besoin_id = ? ORDER BY p.date_positionnement DESC
  `, [b.id]);
  for (const p of b.positionnements) {
    p.etapes = await dbAll(
      `SELECT * FROM positionnement_etapes WHERE positionnement_id = ? ORDER BY ordre ASC, id ASC`,
      [p.id]
    );
  }
  return b;
}

async function setTechnologies(besoinId, obligatoires, appreciees) {
  await dbRun('DELETE FROM besoin_technologies WHERE besoin_id = ?', [besoinId]);
  const add = async (names, obligatoire) => {
    for (const name of (names || [])) {
      const n = String(name).trim();
      if (!n) continue;
      let t = await dbGet('SELECT * FROM technologies WHERE nom = ?', [n]);
      if (!t) {
        const row = await dbGet(`INSERT INTO technologies (nom, categorie, custom, usage_count, created_at) VALUES (?, 'autre', true, 0, now()) RETURNING id`, [n]);
        t = { id: row.id };
      }
      await dbRun('INSERT INTO besoin_technologies (besoin_id, technology_id, obligatoire) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', [besoinId, t.id, obligatoire]);
    }
  };
  await add(obligatoires, true);
  await add(appreciees, false);
}

router.get('/', async (req, res, next) => {
  try {
    const { search, statut, groupe, statut_synthese, entreprise_id, priorite, tech, date_limite_before, archived } = req.query;
    const { page, pageSize, offset } = paginate(req.query);
    const where = [`b.archived = @archived`];
    const params = { archived: archived === 'true' };
    if (search) { where.push(`(b.titre ILIKE @s OR b.reference ILIKE @s OR b.description_contexte ILIKE @s)`); params.s = `%${search}%`; }
    if (statut) { where.push(`b.statut = @statut`); params.statut = statut; }
    // `groupe`/`statut_synthese` : filtre sur le statut normalisé affiché dans le
    // widget "Besoins par statut" du tableau de bord (À venir / En cours / Perdu / ...).
    // Valeur spéciale "ouverts" = À venir + En cours (utilisée par le compteur
    // "Besoins ouverts" du tableau de bord).
    const groupeFilter = groupe || statut_synthese;
    if (groupeFilter === 'ouverts') {
      where.push(`b.statut_synthese IN ('À venir', 'En cours')`);
    } else if (groupeFilter) {
      where.push(`b.statut_synthese = @groupe`); params.groupe = groupeFilter;
    }
    if (entreprise_id) { where.push(`b.entreprise_id = @eid`); params.eid = entreprise_id; }
    if (priorite) { where.push(`b.priorite = @priorite`); params.priorite = priorite; }
    if (date_limite_before) { where.push(`b.date_limite_reponse <= @dlb`); params.dlb = date_limite_before; }
    if (tech) {
      const techNames = String(tech).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
      if (techNames.length) {
        where.push(`EXISTS (
          SELECT 1 FROM besoin_technologies bt JOIN technologies t ON t.id = bt.technology_id
          WHERE bt.besoin_id = b.id AND lower(t.nom) = ANY(@techNames::text[])
        )`);
        params.techNames = techNames;
      }
    }

    const whereSql = where.join(' AND ');
    const total = (await dbGet(`SELECT COUNT(*)::int AS total FROM besoins b WHERE ${whereSql}`, params)).total;
    const pageSlice = await dbAll(`
      SELECT b.* FROM besoins b WHERE ${whereSql} ORDER BY b.created_at DESC LIMIT @limit OFFSET @offset
    `, { ...params, limit: pageSize, offset });

    const page_rows = [];
    for (const b of pageSlice) page_rows.push(await attachExtras(b));
    res.json({ total, page, pageSize, results: page_rows });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const b = await dbGet('SELECT * FROM besoins WHERE id = ?', [req.params.id]);
    if (!b) return res.status(404).json({ error: 'Besoin introuvable' });
    res.json(await attachExtras(b));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.entreprise_id) return res.status(400).json({ error: 'entreprise_id requis' });
    if (!b.titre) return res.status(400).json({ error: 'titre requis' });
    const reference = await generateReference(dbAll);
    const tjm_client = b.tjm_client !== undefined && b.tjm_client !== '' ? Number(b.tjm_client) : null;
    const tjm_candidat = b.tjm_candidat !== undefined && b.tjm_candidat !== '' ? Number(b.tjm_candidat) : null;
    const marge = (tjm_client !== null && tjm_candidat !== null) ? tjm_client - tjm_candidat : null;

    const statutInitial = b.statut || 'a_venir';
    const row = await dbGet(`
      INSERT INTO besoins (
        reference, titre, entreprise_id, contact_id, description_contexte, missions, competences_obligatoires,
        competences_appreciees, niveau_experience, localisation, teletravail, date_demarrage, duree_estimee,
        tjm_client, tjm_candidat, marge_estimee, priorite, date_limite_reponse, source, notes_internes, statut,
        statut_source, statut_synthese, echange_origine_id, created_at, updated_at
      ) VALUES (
        @reference, @titre, @entreprise_id, @contact_id, @description_contexte, @missions, @competences_obligatoires,
        @competences_appreciees, @niveau_experience, @localisation, @teletravail, @date_demarrage, @duree_estimee,
        @tjm_client, @tjm_candidat, @marge_estimee, @priorite, @date_limite_reponse, @source, @notes_internes, @statut,
        @statut_source, @statut_synthese, @echange_origine_id, now(), now()
      ) RETURNING id
    `, {
      reference, titre: b.titre, entreprise_id: b.entreprise_id, contact_id: b.contact_id || null,
      description_contexte: b.description_contexte || '', missions: b.missions || '',
      competences_obligatoires: b.competences_obligatoires || '', competences_appreciees: b.competences_appreciees || '',
      niveau_experience: b.niveau_experience || '', localisation: b.localisation || '', teletravail: b.teletravail || '',
      date_demarrage: b.date_demarrage || null, duree_estimee: b.duree_estimee || '',
      tjm_client, tjm_candidat, marge_estimee: marge, priorite: b.priorite || 'normale',
      date_limite_reponse: b.date_limite_reponse || null, source: b.source || 'Module Besoins',
      notes_internes: b.notes_internes || '', statut: statutInitial,
      statut_source: b.statut_source || null,
      statut_synthese: computeSyntheseStatut(statutInitial, b.statut_source || null),
      echange_origine_id: b.echange_origine_id || null,
    });
    if (b.technologies_obligatoires || b.technologies_appreciees) {
      await setTechnologies(row.id, toTagsArray(b.technologies_obligatoires), toTagsArray(b.technologies_appreciees));
    }
    res.status(201).json(await attachExtras(await dbGet('SELECT * FROM besoins WHERE id = ?', [row.id])));
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await dbGet('SELECT * FROM besoins WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Besoin introuvable' });
    const b = req.body;
    const tjm_client = b.tjm_client !== undefined ? (b.tjm_client === '' ? null : Number(b.tjm_client)) : existing.tjm_client;
    const tjm_candidat = b.tjm_candidat !== undefined ? (b.tjm_candidat === '' ? null : Number(b.tjm_candidat)) : existing.tjm_candidat;
    const marge = (tjm_client !== null && tjm_candidat !== null) ? tjm_client - tjm_candidat : null;

    const statutFinal = b.statut ?? existing.statut;
    const statutSourceFinal = b.statut_source ?? existing.statut_source;
    await dbRun(`
      UPDATE besoins SET titre=@titre, contact_id=@contact_id, description_contexte=@description_contexte, missions=@missions,
        competences_obligatoires=@competences_obligatoires, competences_appreciees=@competences_appreciees,
        niveau_experience=@niveau_experience, localisation=@localisation, teletravail=@teletravail,
        date_demarrage=@date_demarrage, duree_estimee=@duree_estimee, tjm_client=@tjm_client, tjm_candidat=@tjm_candidat,
        marge_estimee=@marge_estimee, priorite=@priorite, date_limite_reponse=@date_limite_reponse, source=@source,
        notes_internes=@notes_internes, statut=@statut, statut_source=@statut_source, statut_synthese=@statut_synthese,
        updated_at=now()
      WHERE id=@id
    `, {
      id: req.params.id,
      titre: b.titre ?? existing.titre, contact_id: b.contact_id ?? existing.contact_id,
      description_contexte: b.description_contexte ?? existing.description_contexte, missions: b.missions ?? existing.missions,
      competences_obligatoires: b.competences_obligatoires ?? existing.competences_obligatoires,
      competences_appreciees: b.competences_appreciees ?? existing.competences_appreciees,
      niveau_experience: b.niveau_experience ?? existing.niveau_experience, localisation: b.localisation ?? existing.localisation,
      teletravail: b.teletravail ?? existing.teletravail, date_demarrage: b.date_demarrage ?? existing.date_demarrage,
      duree_estimee: b.duree_estimee ?? existing.duree_estimee, tjm_client, tjm_candidat, marge_estimee: marge,
      priorite: b.priorite ?? existing.priorite, date_limite_reponse: b.date_limite_reponse ?? existing.date_limite_reponse,
      source: b.source ?? existing.source, notes_internes: b.notes_internes ?? existing.notes_internes,
      statut: statutFinal, statut_source: statutSourceFinal,
      statut_synthese: b.statut_synthese || computeSyntheseStatut(statutFinal, statutSourceFinal),
    });
    if (b.technologies_obligatoires || b.technologies_appreciees) {
      await setTechnologies(req.params.id, toTagsArray(b.technologies_obligatoires), toTagsArray(b.technologies_appreciees));
    }
    res.json(await attachExtras(await dbGet('SELECT * FROM besoins WHERE id = ?', [req.params.id])));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await dbGet('SELECT * FROM besoins WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Besoin introuvable' });
    if (req.query.hard === 'true') {
      await dbRun('DELETE FROM besoins WHERE id = ?', [req.params.id]);
      return res.json({ deleted: true });
    }
    await dbRun(`UPDATE besoins SET archived = true, statut='cloture', statut_synthese='Clôturé', updated_at = now() WHERE id = ?`, [req.params.id]);
    res.json({ archived: true });
  } catch (err) { next(err); }
});

// ---- Suggestions de candidats (aide à la décision, jamais automatique) ----
router.get('/:id/suggestions', async (req, res, next) => {
  try {
    const besoin = await dbGet('SELECT * FROM besoins WHERE id = ?', [req.params.id]);
    if (!besoin) return res.status(404).json({ error: 'Besoin introuvable' });
    const candidats = await dbAll('SELECT * FROM candidats WHERE archived = false');
    const scored = [];
    for (const c of candidats) {
      const result = await computeMatchScore(besoin, c);
      scored.push({ candidat: c, ...result });
    }
    scored.sort((a, b) => b.score - a.score);
    res.json(scored.slice(0, 20));
  } catch (err) { next(err); }
});

module.exports = router;
