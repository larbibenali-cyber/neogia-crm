// Sauvegarde / restauration des données (hors CV, déjà stockés durablement
// dans Supabase Storage — voir server/storage.js). Exporte l'intégralité des
// tables au format JSON dans une archive zip téléchargeable, et sait
// réimporter cette même archive en remplaçant les données courantes au sein
// d'une transaction (aucun redémarrage requis, contrairement à l'ancienne
// version locale SQLite).
const express = require('express');
const multer = require('multer');
const archiver = require('archiver');
const unzipper = require('unzipper');
const { Readable } = require('stream');
const { dbAll, withTransaction } = require('../../db/pg');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// Ordre parents -> enfants (pour l'insertion) ; l'ordre inverse sert à la purge.
const TABLES = [
  'pick_lists', 'technologies', 'entreprises', 'contacts', 'echanges',
  'entreprise_technologies', 'candidats', 'cvs', 'candidat_technologies',
  'besoins', 'besoin_technologies', 'positionnements', 'import_reports',
];

router.get('/', async (req, res, next) => {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="neogia-crm-backup-${stamp}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => { res.status(500).end(String(err)); });
    archive.pipe(res);

    const manifest = { exported_at: new Date().toISOString(), tables: TABLES };
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    for (const table of TABLES) {
      const rows = await dbAll(`SELECT * FROM ${table}`);
      archive.append(JSON.stringify(rows), { name: `${table}.json` });
    }
    archive.append(
      "Cette archive contient les données structurées du CRM (tables Postgres).\n" +
      "Les CV (PDF) ne sont pas inclus ici : ils sont conservés séparément et durablement\n" +
      "dans le stockage privé Supabase (bucket 'cvs'), qui bénéficie de ses propres sauvegardes.\n",
      { name: 'LISEZ-MOI.txt' }
    );
    archive.finalize();
  } catch (err) { next(err); }
});

router.post('/restore', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu (champ "file" attendu, .zip de sauvegarde)' });

    const directory = await unzipper.Open.buffer(req.file.buffer);
    const dataByTable = {};
    for (const table of TABLES) {
      const entry = directory.files.find((f) => f.path === `${table}.json`);
      if (!entry) return res.status(400).json({ error: `Archive invalide : ${table}.json manquant.` });
      const content = await entry.buffer();
      dataByTable[table] = JSON.parse(content.toString('utf8'));
    }

    await withTransaction(async (tx) => {
      // Purge dans l'ordre inverse (enfants avant parents) pour respecter les clés étrangères.
      for (const table of [...TABLES].reverse()) {
        await tx.run(`DELETE FROM ${table}`);
      }
      for (const table of TABLES) {
        const rows = dataByTable[table];
        for (const row of rows) {
          const cols = Object.keys(row);
          if (!cols.length) continue;
          const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
          const colList = cols.map((c) => `"${c}"`).join(', ');
          await tx.run(
            `INSERT INTO ${table} (${colList}) OVERRIDING SYSTEM VALUE VALUES (${placeholders})`,
            cols.map((c) => row[c])
          );
        }
        // Resynchronise la séquence d'identité avec le plus grand id restauré.
        if (rows.length) {
          await tx.run(
            `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`
          );
        }
      }
    });

    res.json({ restored: true, message: 'Restauration appliquée avec succès. Les données sont à jour immédiatement, aucun redémarrage requis.' });
  } catch (err) {
    res.status(500).json({ error: `Échec de la restauration : ${err.message}` });
  }
});

module.exports = router;
