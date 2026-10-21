// Leads détectés par les agents Claude (veille commerciale Neogia).
//
// Les agents tournent dans Claude (abonnement de Larbi), pas dans cette
// application : ils écrivent directement dans la base Supabase. Cette route ne
// fait que relire et trier ce qu'ils ont produit :
//   - signaux de recrutement  → table `besoins`, source « Agent signaux – … »
//   - contacts trouvés        → table `contacts`, source « Agent contacts »
//                               (ou notes commençant par « Trouvé par l'agent »)
//   - briefs de compte        → table `agent_briefs`
const express = require('express');
const { dbGet, dbAll, dbRun } = require('../../db/pg');
const { paginate } = require('../utils');

const router = express.Router();

const SIGNAL_WHERE = `b.source ILIKE 'Agent signaux%'`;
const AGENT_CONTACT_WHERE = `(c.source = 'Agent contacts' OR c.notes ILIKE 'Trouvé par l''agent%')`;

// ---------------------------------------------------------------- statistiques

router.get('/stats', async (req, res, next) => {
  try {
    const row = await dbGet(`
      SELECT
        (SELECT COUNT(*)::int FROM besoins b WHERE ${SIGNAL_WHERE} AND NOT b.archived AND b.statut = 'a_venir') AS signaux_a_traiter,
        (SELECT COUNT(*)::int FROM besoins b WHERE ${SIGNAL_WHERE} AND b.created_at > now() - interval '7 days') AS signaux_7j,
        (SELECT COUNT(*)::int FROM contacts c WHERE ${AGENT_CONTACT_WHERE} AND NOT c.archived) AS contacts_total,
        (SELECT COUNT(*)::int FROM contacts c WHERE ${AGENT_CONTACT_WHERE} AND c.created_at > now() - interval '7 days') AS contacts_7j,
        (SELECT COUNT(*)::int FROM agent_briefs WHERE NOT archived) AS briefs_total,
        (SELECT COUNT(*)::int FROM agent_briefs WHERE NOT archived AND created_at > now() - interval '7 days') AS briefs_7j
    `);
    res.json(row);
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------- signaux

router.get('/signaux', async (req, res, next) => {
  try {
    const { vue = 'a_traiter', search, priorite } = req.query;
    const { page, pageSize, offset } = paginate(req.query);
    const where = [SIGNAL_WHERE];
    const params = {};
    if (vue === 'qualifies') where.push(`NOT b.archived AND b.statut = 'en_cours'`);
    else if (vue === 'ecartes') where.push(`b.archived`);
    else if (vue === 'tous') where.push(`NOT b.archived`);
    else where.push(`NOT b.archived AND b.statut = 'a_venir'`);
    if (search) { where.push(`(b.titre ILIKE @s OR e.nom ILIKE @s OR b.description_contexte ILIKE @s)`); params.s = `%${search}%`; }
    if (priorite) { where.push(`b.priorite = @priorite`); params.priorite = priorite; }
    const w = where.join(' AND ');
    const total = (await dbGet(`SELECT COUNT(*)::int c FROM besoins b LEFT JOIN entreprises e ON e.id = b.entreprise_id WHERE ${w}`, params)).c;
    const results = await dbAll(`
      SELECT b.id, b.reference, b.titre, b.entreprise_id, e.nom AS entreprise_nom, b.description_contexte,
             b.notes_internes, b.localisation, b.source, b.statut, b.priorite, b.archived,
             b.date_identification, b.created_at
      FROM besoins b LEFT JOIN entreprises e ON e.id = b.entreprise_id
      WHERE ${w}
      ORDER BY CASE b.priorite WHEN 'urgente' THEN 0 WHEN 'haute' THEN 1 WHEN 'normale' THEN 2 ELSE 3 END, b.created_at DESC
      LIMIT @limit OFFSET @offset
    `, { ...params, limit: pageSize, offset });
    res.json({ results, total, page, pageSize });
  } catch (e) { next(e); }
});

async function getSignal(id) {
  return dbGet(`SELECT b.id FROM besoins b WHERE b.id = ? AND ${SIGNAL_WHERE}`, [id]);
}

router.post('/signaux/:id/qualifier', async (req, res, next) => {
  try {
    if (!(await getSignal(req.params.id))) return res.status(404).json({ error: 'Signal introuvable' });
    await dbRun(`UPDATE besoins SET statut = 'en_cours', statut_synthese = 'Besoin détecté', archived = false, updated_at = now() WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/signaux/:id/ecarter', async (req, res, next) => {
  try {
    if (!(await getSignal(req.params.id))) return res.status(404).json({ error: 'Signal introuvable' });
    await dbRun(`UPDATE besoins SET archived = true, updated_at = now() WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/signaux/:id/restaurer', async (req, res, next) => {
  try {
    if (!(await getSignal(req.params.id))) return res.status(404).json({ error: 'Signal introuvable' });
    await dbRun(`UPDATE besoins SET archived = false, statut = 'a_venir', statut_synthese = 'À venir', updated_at = now() WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------- contacts trouvés

router.get('/contacts', async (req, res, next) => {
  try {
    const { vue = 'actifs', search } = req.query;
    const { page, pageSize, offset } = paginate(req.query);
    const where = [AGENT_CONTACT_WHERE, vue === 'ecartes' ? 'c.archived' : 'NOT c.archived'];
    const params = {};
    if (search) { where.push(`(c.nom ILIKE @s OR c.prenom ILIKE @s OR c.fonction ILIKE @s OR e.nom ILIKE @s)`); params.s = `%${search}%`; }
    const w = where.join(' AND ');
    const total = (await dbGet(`SELECT COUNT(*)::int c FROM contacts c LEFT JOIN entreprises e ON e.id = c.entreprise_id WHERE ${w}`, params)).c;
    const results = await dbAll(`
      SELECT c.id, c.prenom, c.nom, c.fonction, c.localisation, c.linkedin_url, c.email, c.statut, c.notes,
             c.entreprise_id, e.nom AS entreprise_nom, c.archived, c.created_at
      FROM contacts c LEFT JOIN entreprises e ON e.id = c.entreprise_id
      WHERE ${w}
      ORDER BY c.created_at DESC
      LIMIT @limit OFFSET @offset
    `, { ...params, limit: pageSize, offset });
    res.json({ results, total, page, pageSize });
  } catch (e) { next(e); }
});

async function getAgentContact(id) {
  return dbGet(`SELECT c.id FROM contacts c WHERE c.id = ? AND ${AGENT_CONTACT_WHERE}`, [id]);
}

router.post('/contacts/:id/ecarter', async (req, res, next) => {
  try {
    if (!(await getAgentContact(req.params.id))) return res.status(404).json({ error: 'Contact introuvable' });
    await dbRun(`UPDATE contacts SET archived = true, updated_at = now() WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/contacts/:id/restaurer', async (req, res, next) => {
  try {
    if (!(await getAgentContact(req.params.id))) return res.status(404).json({ error: 'Contact introuvable' });
    await dbRun(`UPDATE contacts SET archived = false, updated_at = now() WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------- briefs

router.get('/briefs', async (req, res, next) => {
  try {
    const { search, entreprise_id } = req.query;
    const where = ['NOT b.archived'];
    const params = {};
    if (search) { where.push(`(b.entreprise_nom ILIKE @s OR b.titre ILIKE @s)`); params.s = `%${search}%`; }
    if (entreprise_id) { where.push(`b.entreprise_id = @eid`); params.eid = entreprise_id; }
    const results = await dbAll(`
      SELECT b.id, b.entreprise_id, b.entreprise_nom, b.titre, b.created_at, left(b.contenu, 280) AS apercu
      FROM agent_briefs b WHERE ${where.join(' AND ')}
      ORDER BY b.created_at DESC LIMIT 200
    `, params);
    res.json({ results });
  } catch (e) { next(e); }
});

router.get('/briefs/:id', async (req, res, next) => {
  try {
    const b = await dbGet(`SELECT * FROM agent_briefs WHERE id = ? AND NOT archived`, [req.params.id]);
    if (!b) return res.status(404).json({ error: 'Brief introuvable' });
    res.json(b);
  } catch (e) { next(e); }
});

router.delete('/briefs/:id', async (req, res, next) => {
  try {
    await dbRun(`UPDATE agent_briefs SET archived = true WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
