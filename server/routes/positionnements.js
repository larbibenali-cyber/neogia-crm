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

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.candidat_id || !b.besoin_id) return res.status(400).json({ error: 'candidat_id et besoin_id requis' });
    const candidat = await dbGet('SELECT * FROM candidats WHERE id = ?', [b.candidat_id]);
    const besoin = await dbGet('SELECT * FROM besoins WHERE id = ?', [b.besoin_id]);
    if (!candidat || !besoin) return res.status(404).json({ error: 'Candidat ou besoin introuvable' });

    const { score } = await computeMatchScore(besoin, candidat);

    try {
      const row = await dbGet(`
        INSERT INTO positionnements (candidat_id, besoin_id, date_positionnement, tjm_propose, statut, commentaires, date_entretien, retour_client, score_compatibilite, created_at, updated_at)
        VALUES (@candidat_id, @besoin_id, @date_positionnement, @tjm_propose, @statut, @commentaires, @date_entretien, @retour_client, @score, now(), now()) RETURNING id
      `, {
        candidat_id: b.candidat_id, besoin_id: b.besoin_id,
        date_positionnement: b.date_positionnement || new Date().toISOString().slice(0, 10),
        tjm_propose: b.tjm_propose ?? null, statut: b.statut || 'a_etudier',
        commentaires: b.commentaires || '', date_entretien: b.date_entretien || null,
        retour_client: b.retour_client || '', score,
      });
      // Le besoin passe automatiquement en "candidats positionnés" s'il était encore en recherche
      if (['lead_a_qualifier', 'besoin_potentiel', 'besoin_confirme', 'recherche_en_cours'].includes(besoin.statut)) {
        await dbRun(`UPDATE besoins SET statut = 'candidats_positionnes', updated_at = now() WHERE id = ?`, [besoin.id]);
      }
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
    await dbRun(`
      UPDATE positionnements SET tjm_propose=@tjm_propose, statut=@statut, commentaires=@commentaires,
        date_entretien=@date_entretien, retour_client=@retour_client, updated_at=now()
      WHERE id=@id
    `, {
      id: req.params.id,
      tjm_propose: b.tjm_propose ?? existing.tjm_propose, statut: b.statut ?? existing.statut,
      commentaires: b.commentaires ?? existing.commentaires, date_entretien: b.date_entretien ?? existing.date_entretien,
      retour_client: b.retour_client ?? existing.retour_client,
    });
    res.json(await dbGet('SELECT * FROM positionnements WHERE id = ?', [req.params.id]));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await dbRun('DELETE FROM positionnements WHERE id = ?', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

module.exports = router;
