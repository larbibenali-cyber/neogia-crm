// Agent « Besoins scrappés » : annonces Data/IA lues sur les job boards
// (Free-Work, Monster, Indeed…) et client final probable de chaque annonce.
//
// L'agent tourne dans Claude (skill « attribution-annonces ») et écrit
// directement dans `annonces_scrapees` et `client_perimetres`. Cette route
// relit, permet de confirmer / corriger / écarter une attribution et de gérer
// les périmètres clients qui servent au calcul des probabilités.
const express = require('express');
const { dbGet, dbAll, dbRun } = require('../../db/pg');
const { paginate } = require('../utils');

const router = express.Router();

// ---------------------------------------------------------------- statistiques

router.get('/stats', async (req, res, next) => {
  try {
    const row = await dbGet(`
      SELECT
        (SELECT COUNT(*)::int FROM annonces_scrapees WHERE statut = 'a_traiter') AS a_traiter,
        (SELECT COUNT(*)::int FROM annonces_scrapees WHERE created_at > now() - interval '7 days') AS semaine,
        (SELECT COUNT(*)::int FROM annonces_scrapees WHERE statut = 'a_traiter' AND (client_nomme OR confiance >= 70)) AS fortes,
        (SELECT COUNT(*)::int FROM client_perimetres WHERE NOT archived) AS perimetres,
        (SELECT COUNT(*)::int FROM client_perimetres WHERE NOT archived AND NOT valide) AS perimetres_a_valider
    `);
    res.json(row);
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------- annonces

router.get('/', async (req, res, next) => {
  try {
    const { vue = 'a_traiter', search, site, force } = req.query;
    const { page, pageSize, offset } = paginate(req.query);
    const where = [];
    const params = {};
    if (vue === 'confirmees') where.push(`a.statut = 'confirmee'`);
    else if (vue === 'ecartees') where.push(`a.statut = 'ecartee'`);
    else if (vue !== 'toutes') where.push(`a.statut = 'a_traiter'`);
    if (site) { where.push(`a.site = @site`); params.site = site; }
    if (force === 'fortes') where.push(`(a.client_nomme OR a.confiance >= 70)`);
    if (search) {
      where.push(`(a.titre ILIKE @s OR a.intermediaire ILIKE @s OR a.extrait ILIKE @s OR e.nom ILIKE @s OR a.hypotheses::text ILIKE @s)`);
      params.s = `%${search}%`;
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const from = `FROM annonces_scrapees a
      LEFT JOIN entreprises e ON e.id = a.entreprise_id
      LEFT JOIN entreprises ec ON ec.id = a.entreprise_confirmee_id`;
    const total = (await dbGet(`SELECT COUNT(*)::int c ${from} ${w}`, params)).c;
    const results = await dbAll(`
      SELECT a.*, e.nom AS entreprise_nom, ec.nom AS entreprise_confirmee_nom
      ${from} ${w}
      ORDER BY COALESCE(a.date_publication, a.created_at::date) DESC, a.client_nomme DESC, COALESCE(a.confiance, 0) DESC, a.id DESC
      LIMIT @limit OFFSET @offset
    `, { ...params, limit: pageSize, offset });
    const sites = await dbAll(`SELECT site, COUNT(*)::int n FROM annonces_scrapees GROUP BY site ORDER BY n DESC`);
    res.json({ results, total, page, pageSize, sites });
  } catch (e) { next(e); }
});

async function getAnnonce(id) {
  return dbGet(`SELECT id FROM annonces_scrapees WHERE id = ?`, [id]);
}

// Confirme le client réel (une des hypothèses ou une autre entreprise du CRM).
router.post('/:id/confirmer', async (req, res, next) => {
  try {
    if (!(await getAnnonce(req.params.id))) return res.status(404).json({ error: 'Annonce introuvable' });
    const entrepriseId = Number(req.body?.entreprise_id);
    if (!entrepriseId) return res.status(400).json({ error: 'Choisissez le client concerné.' });
    if (!(await dbGet(`SELECT id FROM entreprises WHERE id = ?`, [entrepriseId]))) {
      return res.status(400).json({ error: 'Entreprise introuvable' });
    }
    await dbRun(`UPDATE annonces_scrapees SET statut = 'confirmee', entreprise_confirmee_id = ?, updated_at = now() WHERE id = ?`, [entrepriseId, req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/:id/ecarter', async (req, res, next) => {
  try {
    if (!(await getAnnonce(req.params.id))) return res.status(404).json({ error: 'Annonce introuvable' });
    await dbRun(`UPDATE annonces_scrapees SET statut = 'ecartee', updated_at = now() WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/:id/restaurer', async (req, res, next) => {
  try {
    if (!(await getAnnonce(req.params.id))) return res.status(404).json({ error: 'Annonce introuvable' });
    await dbRun(`UPDATE annonces_scrapees SET statut = 'a_traiter', entreprise_confirmee_id = NULL, updated_at = now() WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------- périmètres clients

const toArray = (v) => {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map((x) => x.trim()).filter(Boolean);
  return [];
};

router.get('/perimetres', async (req, res, next) => {
  try {
    const { search, vue = 'actifs', entreprise_id } = req.query;
    const where = ['NOT p.archived'];
    const params = {};
    if (vue === 'a_valider') where.push('NOT p.valide');
    if (entreprise_id) { where.push('p.entreprise_id = @eid'); params.eid = entreprise_id; }
    if (search) {
      where.push(`(e.nom ILIKE @s OR p.nom_equipe ILIKE @s OR p.direction ILIKE @s OR array_to_string(p.alias || p.technologies || p.mots_cles || p.sites, ' ') ILIKE @s)`);
      params.s = `%${search}%`;
    }
    const results = await dbAll(`
      SELECT p.*, e.nom AS entreprise_nom
      FROM client_perimetres p JOIN entreprises e ON e.id = p.entreprise_id
      WHERE ${where.join(' AND ')}
      ORDER BY e.nom, p.nom_equipe
      LIMIT 500
    `, params);
    res.json({ results });
  } catch (e) { next(e); }
});

function perimetreParams(body) {
  return {
    nom_equipe: String(body.nom_equipe || '').trim(),
    alias: toArray(body.alias),
    direction: body.direction ? String(body.direction).trim() : null,
    sites: toArray(body.sites),
    technologies: toArray(body.technologies),
    mots_cles: toArray(body.mots_cles),
    description: body.description ? String(body.description).trim() : null,
  };
}

router.post('/perimetres', async (req, res, next) => {
  try {
    const p = perimetreParams(req.body || {});
    const eid = Number(req.body?.entreprise_id);
    if (!eid || !p.nom_equipe) return res.status(400).json({ error: 'Entreprise et nom d\'équipe obligatoires.' });
    const row = await dbGet(`
      INSERT INTO client_perimetres (entreprise_id, nom_equipe, alias, direction, sites, technologies, mots_cles, description, source, valide)
      VALUES (@eid, @nom_equipe, @alias, @direction, @sites, @technologies, @mots_cles, @description, 'Larbi', true)
      RETURNING id
    `, { eid, ...p });
    res.json(row);
  } catch (e) { next(e); }
});

router.put('/perimetres/:id', async (req, res, next) => {
  try {
    const p = perimetreParams(req.body || {});
    if (!p.nom_equipe) return res.status(400).json({ error: 'Nom d\'équipe obligatoire.' });
    const r = await dbGet(`
      UPDATE client_perimetres SET nom_equipe = @nom_equipe, alias = @alias, direction = @direction, sites = @sites,
        technologies = @technologies, mots_cles = @mots_cles, description = @description, valide = true, updated_at = now()
      WHERE id = @id AND NOT archived RETURNING id
    `, { id: req.params.id, ...p });
    if (!r) return res.status(404).json({ error: 'Périmètre introuvable' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/perimetres/:id/valider', async (req, res, next) => {
  try {
    await dbRun(`UPDATE client_perimetres SET valide = true, updated_at = now() WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/perimetres/:id', async (req, res, next) => {
  try {
    await dbRun(`UPDATE client_perimetres SET archived = true, updated_at = now() WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
