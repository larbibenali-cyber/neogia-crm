// Routes de lecture du module « Priorisation activité ». Les bilans
// eux-mêmes sont écrits par une tâche planifiée Claude (en dehors de ce
// serveur) qui lit Gmail + ce CRM chaque soir — ce fichier ne fait que les
// exposer en lecture à l'interface.
const express = require('express');
const { dbGet, dbAll } = require('../../db/pg');

const router = express.Router();

// Les N derniers bilans (le plus récent en premier), pour l'historique.
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 14, 60);
    const rows = await dbAll('SELECT * FROM priorisation_activite ORDER BY date_bilan DESC LIMIT ?', [limit]);
    res.json(rows);
  } catch (err) { next(err); }
});

// Le dernier bilan disponible (celui affiché par défaut sur la page).
router.get('/latest', async (req, res, next) => {
  try {
    const row = await dbGet('SELECT * FROM priorisation_activite ORDER BY date_bilan DESC LIMIT 1');
    res.json(row || null);
  } catch (err) { next(err); }
});

router.get('/:date', async (req, res, next) => {
  try {
    const row = await dbGet('SELECT * FROM priorisation_activite WHERE date_bilan = ?', [req.params.date]);
    if (!row) return res.status(404).json({ error: 'Aucun bilan pour cette date.' });
    res.json(row);
  } catch (err) { next(err); }
});

module.exports = router;
