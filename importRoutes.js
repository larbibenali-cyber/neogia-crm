const express = require('express');
const multer = require('multer');
const { dbAll } = require('../../db/pg');
const { runImport, previewImport } = require('../../import/run_import');

const router = express.Router();

// Fichier gardé en mémoire uniquement (jamais écrit sur disque tel quel avant validation).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Étape 1 de l'assistant d'import : aperçu + mapping de colonnes détecté, sans écriture en base.
router.post('/preview', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu (champ "file" attendu)' });
  try {
    const preview = previewImport(req.file.buffer);
    // Le fichier est réencodé en base64 et renvoyé au frontend : il sera repassé tel quel
    // à /api/import/commit une fois le mapping validé par l'utilisateur (aucun stockage
    // intermédiaire côté serveur entre les deux étapes).
    res.json({
      ...preview,
      file_token: req.file.buffer.toString('base64'),
      original_name: req.file.originalname,
    });
  } catch (err) {
    res.status(500).json({ error: `Analyse du fichier impossible : ${err.message}` });
  }
});

// Étape 2 : validation par l'utilisateur du mapping (éventuellement corrigé) -> import réel, idempotent.
router.post('/commit', async (req, res, next) => {
  try {
    const { file_token, original_name, column_overrides } = req.body;
    if (!file_token) return res.status(400).json({ error: 'file_token manquant : relancez l\'aperçu (/api/import/preview).' });
    const buffer = Buffer.from(file_token, 'base64');
    const summary = await runImport(buffer, { columnOverrides: column_overrides || null, originalName: original_name });
    res.json(summary);
  } catch (err) { next(err); }
});

// Réimport direct (utilisé par le CLI / ré-import rapide sans passer par l'assistant de mapping).
router.post('/excel', upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu (champ "file" attendu)' });
  try {
    const summary = await runImport(req.file.buffer, { originalName: req.file.originalname });
    res.json(summary);
  } catch (err) { next(err); }
});

router.get('/reports', async (req, res, next) => {
  try {
    const rows = await dbAll('SELECT id, created_at, filename, report_json FROM import_reports ORDER BY id DESC LIMIT 20');
    res.json(rows.map((r) => ({ id: r.id, created_at: r.created_at, filename: r.filename, report: JSON.parse(r.report_json) })));
  } catch (err) { next(err); }
});

module.exports = router;
