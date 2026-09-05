// Paramètres simples clé/valeur (ex. signature e-mail utilisée par la
// variable {{signature}} des modèles), plus la gestion du jeton d'accès de
// l'extension navigateur LinkedIn (routes dédiées ci-dessous, distinctes du
// magasin clé/valeur générique : le jeton en clair n'est renvoyé qu'une
// seule fois, à la génération).
const express = require('express');
const crypto = require('crypto');
const { dbGet, dbRun } = require('../../db/pg');
const { hashToken } = require('../middleware/apiToken');

const router = express.Router();

const ALLOWED_KEYS = ['signature'];

// ---- Jeton d'accès personnel pour l'extension navigateur LinkedIn ----
// Doit être déclaré AVANT les routes génériques /:key ci-dessous, sinon
// Express les intercepterait en les prenant pour une clé nommée
// "extension-token".
router.get('/extension-token', async (req, res, next) => {
  try {
    const row = await dbGet('SELECT value, updated_at FROM app_settings WHERE key = ?', ['extension_api_token_hash']);
    res.json({ exists: Boolean(row && row.value), createdAt: row ? row.updated_at : null });
  } catch (err) { next(err); }
});

router.post('/extension-token', async (req, res, next) => {
  try {
    const token = crypto.randomBytes(24).toString('hex');
    const hash = hashToken(token);
    await dbRun(`
      INSERT INTO app_settings (key, value, updated_at) VALUES ('extension_api_token_hash', @hash, now())
      ON CONFLICT (key) DO UPDATE SET value = @hash, updated_at = now()
    `, { hash });
    // Seul moment où le jeton en clair est renvoyé : ni stocké, ni récupérable ensuite.
    res.status(201).json({ token });
  } catch (err) { next(err); }
});

router.delete('/extension-token', async (req, res, next) => {
  try {
    await dbRun('DELETE FROM app_settings WHERE key = ?', ['extension_api_token_hash']);
    res.json({ revoked: true });
  } catch (err) { next(err); }
});

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
