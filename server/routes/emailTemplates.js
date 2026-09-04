const express = require('express');
const { dbGet, dbAll, dbRun } = require('../../db/pg');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { actif } = req.query;
    const where = [];
    const params = {};
    if (actif === 'true' || actif === 'false') {
      where.push('actif = @actif');
      params.actif = actif === 'true';
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await dbAll(`SELECT * FROM email_templates ${whereSql} ORDER BY nom ASC`, params);
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await dbGet('SELECT * FROM email_templates WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Modèle introuvable' });
    res.json(row);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.nom) return res.status(400).json({ error: 'Le nom du modèle est requis' });
    const row = await dbGet(`
      INSERT INTO email_templates (nom, objet, contenu, actif, created_at, updated_at)
      VALUES (@nom, @objet, @contenu, @actif, now(), now()) RETURNING id
    `, { nom: b.nom, objet: b.objet || '', contenu: b.contenu || '', actif: b.actif !== false });
    res.status(201).json(await dbGet('SELECT * FROM email_templates WHERE id = ?', [row.id]));
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await dbGet('SELECT * FROM email_templates WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Modèle introuvable' });
    const b = req.body;
    await dbRun(`
      UPDATE email_templates SET nom=@nom, objet=@objet, contenu=@contenu, actif=@actif, updated_at=now() WHERE id=@id
    `, {
      id: req.params.id,
      nom: b.nom ?? existing.nom,
      objet: b.objet ?? existing.objet,
      contenu: b.contenu ?? existing.contenu,
      actif: b.actif ?? existing.actif,
    });
    res.json(await dbGet('SELECT * FROM email_templates WHERE id = ?', [req.params.id]));
  } catch (err) { next(err); }
});

// Duplication : utile pour partir d'un modèle existant sans risquer de
// modifier celui déjà utilisé dans l'historique des campagnes passées.
router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const existing = await dbGet('SELECT * FROM email_templates WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Modèle introuvable' });
    const row = await dbGet(`
      INSERT INTO email_templates (nom, objet, contenu, actif, created_at, updated_at)
      VALUES (@nom, @objet, @contenu, true, now(), now()) RETURNING id
    `, { nom: `${existing.nom} (copie)`, objet: existing.objet, contenu: existing.contenu });
    res.status(201).json(await dbGet('SELECT * FROM email_templates WHERE id = ?', [row.id]));
  } catch (err) { next(err); }
});

// Suppression définitive du modèle (les campagnes/envois passés qui le
// référençaient gardent leur objet/contenu déjà enregistré — voir
// email_sends.objet/contenu — donc l'historique n'est jamais perdu).
router.delete('/:id', async (req, res, next) => {
  try {
    await dbRun('DELETE FROM email_templates WHERE id = ?', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

module.exports = router;
