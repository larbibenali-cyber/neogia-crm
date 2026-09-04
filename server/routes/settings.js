// Paramètres simples clé/valeur (ex. signature e-mail utilisée par la
// variable {{signature}} des modèles). Volontairement minimal : une seule
// clé exposée pour l'instant.
const express = require('express');
const { dbGet, dbRun } = require('../../db/pg');

const router = express.Router();

const ALLOWED_KEYS = ['signature'];

router.get('/:key', async (req, res, next) => {
  try {
    if (!ALLOWED_KEYS.includes(req.params.key)) return res.status(404).json({ error: 'Paramètre inconnu' });
    const row = await dbGet('SELECT value FROM app_settings WHERE key = ?', [req.params.key]);
    res.json({ key: req.params.key, value: row ? row.value : '' });
  } catch (err) { next(err); }
});

router.put('/:key', async (req, res, next) => {
  try {
    if (!ALLOWED_KEYS.includes(req.params.key)) return res.status(404).json({ error: 'Paramètre inconnu' });
    const value = req.body.value ?? '';
    await dbRun(`
      INSERT INTO app_settings (key, value, updated_at) VALUES (@key, @value, now())
      ON CONFLICT (key) DO UPDATE SET value = @value, updated_at = now()
    `, { key: req.params.key, value });
    res.json({ key: req.params.key, value });
  } catch (err) { next(err); }
});

module.exports = router;
