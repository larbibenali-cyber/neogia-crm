const express = require('express');
const { dbGet, dbAll, dbRun } = require('../../db/pg');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { category } = req.query;
    const rows = category
      ? await dbAll('SELECT * FROM pick_lists WHERE category = ? ORDER BY sort_order', [category])
      : await dbAll('SELECT * FROM pick_lists ORDER BY category, sort_order');
    if (category) return res.json(rows);
    const grouped = {};
    rows.forEach((r) => { (grouped[r.category] = grouped[r.category] || []).push(r); });
    res.json(grouped);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { category, value, label, color } = req.body;
    if (!category || !value || !label) return res.status(400).json({ error: 'category, value, label requis' });
    const maxRow = await dbGet('SELECT MAX(sort_order) m FROM pick_lists WHERE category = ?', [category]);
    const maxOrder = maxRow?.m || 0;
    const row = await dbGet(`INSERT INTO pick_lists (category, value, label, color, sort_order, active) VALUES (?, ?, ?, ?, ?, true) RETURNING id`,
      [category, value, label, color || '#94A3B8', maxOrder + 1]);
    res.status(201).json(await dbGet('SELECT * FROM pick_lists WHERE id = ?', [row.id]));
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await dbGet('SELECT * FROM pick_lists WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Introuvable' });
    const b = req.body;
    await dbRun(`UPDATE pick_lists SET label=@label, color=@color, sort_order=@sort_order, active=@active WHERE id=@id`, {
      id: req.params.id,
      label: b.label ?? existing.label,
      color: b.color ?? existing.color,
      sort_order: b.sort_order ?? existing.sort_order,
      active: b.active !== undefined ? !!b.active : existing.active,
    });
    res.json(await dbGet('SELECT * FROM pick_lists WHERE id = ?', [req.params.id]));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await dbRun('UPDATE pick_lists SET active = false WHERE id = ?', [req.params.id]);
    res.json({ deactivated: true });
  } catch (err) { next(err); }
});

module.exports = router;
