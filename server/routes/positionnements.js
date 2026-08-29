const express = require('express');
const { dbGet, dbAll, dbRun } = require('../../db/pg');
const { computeMatchScore } = require('../matching');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { candidat_id, besoin_id } = req.query;
    const where = [];
    const params = {};
    if (candidat_id) { where.push('p.candidat_id = @candidat_id'); params.candidat_id = candidat_id; }
    if (besoin_id) { where.push('p.besoin_id = @besoin_id'); params.besoin_id = besoin_id; }
    const sql = `
      SELECT p.*, c.nom as candidat_nom, c.prenom as candidat_prenom, b.titre as besoin_titre, b.reference as besoin_reference,
        e.nom as entreprise_nom
      FROM positionnements p
      JOIN candidats c ON c.id = p.candidat_id
      JOIN besoins b ON b.id = p.besoin_id
      JOIN entreprises e ON e.id = b.entreprise_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY p.date_positionnement DESC
    `;
    res.json(await dbAll(sql, params));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const p = await dbGet(`
      SELECT p.*, c.nom as candidat_nom, c.prenom as candidat_prenom, b.titre as besoin_titre, b.reference as besoin_reference,
        e.nom as entreprise_nom
      FROM positionnements p
      JOIN candidats c ON c.id = p.candidat_id
      JOIN besoins b ON b.id = p.besoin_id
      JOIN entreprises e ON e.id = b.entreprise_id
      WHERE p.id = ?
    `, [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Positionnement introuvable' });
    p.etapes = await dbAll('SELECT * FROM positionnement_etapes WHERE positionnement_id = ? ORDER BY ordre ASC, id ASC', [p.id]);
    res.json(p);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.candidat_id || !b.besoin_id) return res.status(400).json({ error: 'candidat_id et besoin_id requis' });
    const candidat = await dbGet('SELECT * FROM candidats WHERE id = ?', [b.candidat_id]);
    const besoin = await dbGet('SELECT * FROM besoins WHERE id = ?', [b.besoin_id]);
    if (!candidat || !besoin) return res.status(404).json({ error: 'Candidat ou besoin introuvable' });

    let score = null;
    try {
      ({ score } = await computeMatchScore(besoin, candidat));
    } catch (e) {
      // Le score de compatibilité est une aide à la décision indicative : s'il ne
      // peut pas être calculé (données manquantes...), le positionnement doit
      // pouvoir être créé quand même plutôt que d'échouer entièrement.
      console.error('computeMatchScore a échoué, positionnement créé sans score :', e);
    }

    try {
      const row = await dbGet(`
        INSERT INTO positionnements (candidat_id, besoin_id, date_positionnement, tjm_propose, statut, commentaires, date_entretien, retour_client, score_compatibilite, created_at, updated_at)
        VALUES (@candidat_id, @besoin_id, @date_positionnement, @tjm_propose, @statut, @commentaires, @date_entretien, @retour_client, @score, now(), now()) RETURNING id
      `, {
        candidat_id: b.candidat_id, besoin_id: b.besoin_id,
        date_positionnement: b.date_positionnement || new Date().toISOString().slice(0, 10),
        tjm_propose: (b.tjm_propose === '' || b.tjm_propose === undefined) ? null : Number(b.tjm_propose),
        statut: b.statut || 'positionne',
        commentaires: b.commentaires || '', date_entretien: b.date_entretien || null,
        retour_client: b.retour_client || '', score,
      });
      // Historique : première étape automatique traçant la création du positionnement.
      await dbRun(`
        INSERT INTO positionnement_etapes (positionnement_id, ordre, date_etape, type_etape, commentaire_original, statut_apres, source, created_at)
        VALUES (?, 1, ?, 'positionnement', ?, ?, 'saisie_manuelle', now())
      `, [row.id, b.date_positionnement || new Date().toISOString().slice(0, 10), b.commentaires || '', b.statut || 'positionne']);
      // NB : le statut du BESOIN n'est jamais modifié automatiquement ici — l'avancement
      // des candidats se pilote uniquement via le statut du positionnement, comme demandé.
      if (['qualifie', 'disponible', 'a_contacter', 'contacte'].includes(candidat.statut)) {
        await dbRun(`UPDATE candidats SET statut = 'positionne', updated_at = now() WHERE id = ?`, [candidat.id]);
      }
      res.status(201).json(await dbGet('SELECT * FROM positionnements WHERE id = ?', [row.id]));
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Ce candidat est déjà positionné sur ce besoin.' });
      }
      throw err;
    }
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await dbGet('SELECT * FROM positionnements WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Positionnement introuvable' });
    const b = req.body;
    const tjm_propose = b.tjm_propose !== undefined ? (b.tjm_propose === '' ? null : Number(b.tjm_propose)) : existing.tjm_propose;
    await dbRun(`
      UPDATE positionnements SET tjm_propose=@tjm_propose, statut=@statut, commentaires=@commentaires,
        date_entretien=@date_entretien, retour_client=@retour_client, updated_at=now()
      WHERE id=@id
    `, {
      id: req.params.id,
      tjm_propose, statut: b.statut ?? existing.statut,
      commentaires: b.commentaires ?? existing.commentaires, date_entretien: b.date_entretien ?? existing.date_entretien,
      retour_client: b.retour_client ?? existing.retour_client,
    });
    // Si le statut change, on trace automatiquement une étape dans l'historique
    // (en plus des étapes ajoutées manuellement via /:id/etapes).
    if (b.statut && b.statut !== existing.statut) {
      const nextOrdre = ((await dbGet('SELECT COALESCE(MAX(ordre), 0)::int AS n FROM positionnement_etapes WHERE positionnement_id = ?', [req.params.id])).n) + 1;
      await dbRun(`
        INSERT INTO positionnement_etapes (positionnement_id, ordre, date_etape, type_etape, commentaire_original, statut_apres, source, created_at)
        VALUES (?, ?, ?, 'changement_statut', ?, ?, 'saisie_manuelle', now())
      `, [req.params.id, nextOrdre, new Date().toISOString().slice(0, 10), b.etape_commentaire || '', b.statut]);
    }
    res.json(await dbGet('SELECT * FROM positionnements WHERE id = ?', [req.params.id]));
  } catch (err) { next(err); }
});

// ---- Historique (étapes) d'un positionnement ----
router.post('/:id/etapes', async (req, res, next) => {
  try {
    const existing = await dbGet('SELECT * FROM positionnements WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Positionnement introuvable' });
    const b = req.body || {};
    const nextOrdre = ((await dbGet('SELECT COALESCE(MAX(ordre), 0)::int AS n FROM positionnement_etapes WHERE positionnement_id = ?', [req.params.id])).n) + 1;
    const row = await dbGet(`
      INSERT INTO positionnement_etapes (positionnement_id, ordre, date_etape, heure, type_etape, commentaire_original, statut_apres, source, created_at)
      VALUES (@positionnement_id, @ordre, @date_etape, @heure, @type_etape, @commentaire_original, @statut_apres, 'saisie_manuelle', now())
      RETURNING id
    `, {
      positionnement_id: req.params.id, ordre: nextOrdre,
      date_etape: b.date_etape || new Date().toISOString().slice(0, 10), heure: b.heure || null,
      type_etape: b.type_etape || 'note', commentaire_original: b.commentaire || '',
      statut_apres: b.nouveau_statut || null,
    });
    if (b.nouveau_statut) {
      await dbRun('UPDATE positionnements SET statut = ?, updated_at = now() WHERE id = ?', [b.nouveau_statut, req.params.id]);
    }
    res.status(201).json(await dbGet('SELECT * FROM positionnement_etapes WHERE id = ?', [row.id]));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await dbGet('SELECT * FROM positionnements WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Positionnement introuvable' });
    await dbRun('DELETE FROM positionnement_etapes WHERE positionnement_id = ?', [req.params.id]);
    await dbRun('DELETE FROM positionnements WHERE id = ?', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

module.exports = router;
