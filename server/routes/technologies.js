const express = require('express');
const { dbAll } = require('../../db/pg');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { search, category } = req.query;
    const where = [];
    const params = {};
    if (search) { where.push('nom ILIKE @s'); params.s = `%${search}%`; }
    if (category) { where.push('categorie = @c'); params.c = category; }
    const sql = `SELECT * FROM technologies ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY usage_count DESC, nom ASC`;
    res.json(await dbAll(sql, params));
  } catch (err) { next(err); }
});

// Clients utilisant une technologie donnée
router.get('/:id/entreprises', async (req, res, next) => {
  try {
    const rows = await dbAll(`
      SELECT e.*, et.weight FROM entreprise_technologies et
      JOIN entreprises e ON e.id = et.entreprise_id
      WHERE et.technology_id = ? AND e.archived = false
      ORDER BY et.weight DESC
    `, [req.params.id]);
    res.json(rows);
  } catch (err) { next(err); }
});

// Candidats maîtrisant une technologie donnée
router.get('/:id/candidats', async (req, res, next) => {
  try {
    const rows = await dbAll(`
      SELECT c.* FROM candidat_technologies ct
      JOIN candidats c ON c.id = ct.candidat_id
      WHERE ct.technology_id = ? AND c.archived = false
    `, [req.params.id]);
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
