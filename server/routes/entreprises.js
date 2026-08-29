const express = require('express');
const { dbGet, dbAll, dbRun } = require('../../db/pg');
const { paginate } = require('../utils');

const router = express.Router();

async function attachExtras(ent) {
  if (!ent) return ent;
  ent.technologies = await dbAll(`
    SELECT t.id, t.nom, t.categorie, t.custom, et.weight
    FROM entreprise_technologies et JOIN technologies t ON t.id = et.technology_id
    WHERE et.entreprise_id = ? ORDER BY et.weight DESC
  `, [ent.id]);
  ent.contacts_count = (await dbGet(`SELECT COUNT(*) c FROM contacts WHERE entreprise_id = ? AND archived = false`, [ent.id])).c;
  ent.besoins_count = (await dbGet(`SELECT COUNT(*) c FROM besoins WHERE entreprise_id = ?`, [ent.id])).c;
  return ent;
}

router.get('/', async (req, res, next) => {
  try {
    const { search, archived } = req.query;
    const { page, pageSize, offset } = paginate(req.query);
    const where = [`archived = @archived`];
    const params = { archived: archived === 'true' };
    if (search) { where.push(`nom ILIKE @s`); params.s = `%${search}%`; }
    const total = (await dbGet(`SELECT COUNT(*) c FROM entreprises WHERE ${where.join(' AND ')}`, params)).c;
    const rows = await dbAll(`SELECT * FROM entreprises WHERE ${where.join(' AND ')} ORDER BY nom LIMIT @limit OFFSET @offset`,
      { ...params, limit: pageSize, offset });
    for (const r of rows) await attachExtras(r);
    res.json({ total, page, pageSize, results: rows });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const ent = await dbGet('SELECT * FROM entreprises WHERE id = ?', [req.params.id]);
    if (!ent) return res.status(404).json({ error: 'Entreprise introuvable' });
    await attachExtras(ent);
    ent.contacts = await dbAll('SELECT * FROM contacts WHERE entreprise_id = ? AND archived = false ORDER BY nom', [ent.id]);
    ent.besoins = await dbAll('SELECT * FROM besoins WHERE entreprise_id = ? ORDER BY created_at DESC', [ent.id]);
    res.json(ent);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.nom) return res.status(400).json({ error: 'Nom requis' });
    const nomNorm = String(b.nom).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '');
    const row = await dbGet(`
      INSERT INTO entreprises (nom, nom_normalise, secteur, adresse, site_web, notes, created_at, updated_at)
      VALUES (@nom, @nom_normalise, @secteur, @adresse, @site_web, @notes, now(), now()) RETURNING id
    `, { nom: b.nom, nom_normalise: nomNorm, secteur: b.secteur || '', adresse: b.adresse || '', site_web: b.site_web || '', notes: b.notes || '' });
    res.status(201).json(await attachExtras(await dbGet('SELECT * FROM entreprises WHERE id = ?', [row.id])));
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await dbGet('SELECT * FROM entreprises WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Entreprise introuvable' });
    const b = req.body;
    await dbRun(`
      UPDATE entreprises SET nom=@nom, secteur=@secteur, adresse=@adresse, site_web=@site_web, notes=@notes, updated_at=now()
      WHERE id=@id
    `, { id: req.params.id, nom: b.nom ?? existing.nom, secteur: b.secteur ?? existing.secteur, adresse: b.adresse ?? existing.adresse, site_web: b.site_web ?? existing.site_web, notes: b.notes ?? existing.notes });
    res.json(await attachExtras(await dbGet('SELECT * FROM entreprises WHERE id = ?', [req.params.id])));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await dbGet('SELECT * FROM entreprises WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Entreprise introuvable' });
    if (req.query.hard === 'true') {
      await dbRun('DELETE FROM entreprises WHERE id = ?', [req.params.id]);
      return res.json({ deleted: true });
    }
    await dbRun(`UPDATE entreprises SET archived = true, updated_at = now() WHERE id = ?`, [req.params.id]);
    res.json({ archived: true });
  } catch (err) { next(err); }
});

// ---- Gestion manuelle du nuage technologique ----
router.post('/:id/technologies', async (req, res, next) => {
  try {
    const { technology_name, category } = req.body;
    if (!technology_name) return res.status(400).json({ error: 'technology_name requis' });
    let tech = await dbGet('SELECT * FROM technologies WHERE nom = ?', [technology_name]);
    if (!tech) {
      const row = await dbGet(`INSERT INTO technologies (nom, categorie, custom, usage_count, created_at) VALUES (?, ?, true, 0, now()) RETURNING id`,
        [technology_name, category || 'autre']);
      tech = await dbGet('SELECT * FROM technologies WHERE id = ?', [row.id]);
    }
    await dbRun(`
      INSERT INTO entreprise_technologies (entreprise_id, technology_id, weight) VALUES (?, ?, 1)
      ON CONFLICT (entreprise_id, technology_id) DO UPDATE SET weight = entreprise_technologies.weight + 1
    `, [req.params.id, tech.id]);
    res.status(201).json({ added: tech });
  } catch (err) { next(err); }
});

router.delete('/:id/technologies/:techId', async (req, res, next) => {
  try {
    await dbRun('DELETE FROM entreprise_technologies WHERE entreprise_id = ? AND technology_id = ?', [req.params.id, req.params.techId]);
    res.json({ removed: true });
  } catch (err) { next(err); }
});

module.exports = router;
