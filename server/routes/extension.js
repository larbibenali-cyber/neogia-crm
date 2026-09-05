// Routes utilisées par l'extension navigateur "Import LinkedIn" — protégées
// par un jeton d'accès personnel (requireApiToken), PAS par la session
// Supabase Auth classique (voir server.js : ce routeur est monté avant
// `app.use('/api', requireAuth)`, comme /api/gmail public pour l'OAuth).
//
// Principe : l'extension lit ce qui est déjà affiché sur la fiche LinkedIn
// (nom, poste, ville, URL du profil) puis, avant tout import, interroge ces
// routes pour proposer un rattachement à l'entreprise existante ou signaler
// un contact déjà présent — jamais de création silencieuse en double.
const express = require('express');
const { dbGet, dbAll, dbRun } = require('../../db/pg');
const { requireApiToken } = require('../middleware/apiToken');

const router = express.Router();
router.use(requireApiToken);

function normalizeNom(nom) {
  return String(nom || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '');
}

router.get('/ping', (req, res) => res.json({ ok: true }));

// ---- Recherche d'entreprise par nom (avant création éventuelle) ----
router.post('/lookup-entreprise', async (req, res, next) => {
  try {
    const nom = String(req.body.nom || '').trim();
    if (!nom) return res.json({ matches: [] });
    const norm = normalizeNom(nom);
    const matches = await dbAll(`
      SELECT id, nom FROM entreprises
      WHERE archived = false AND (nom_normalise = @norm OR nom ILIKE @like)
      ORDER BY (nom_normalise = @norm) DESC, nom ASC
      LIMIT 5
    `, { norm, like: `%${nom}%` });
    res.json({ matches });
  } catch (err) { next(err); }
});

// ---- Recherche de contact existant (même nom/prénom, éventuellement dans la même entreprise) ----
router.post('/lookup-contact', async (req, res, next) => {
  try {
    const nom = String(req.body.nom || '').trim();
    const prenom = String(req.body.prenom || '').trim();
    if (!nom && !prenom) return res.json({ matches: [] });
    const where = ['c.archived = false'];
    const params = {};
    if (nom) { where.push('UPPER(c.nom) = UPPER(@nom)'); params.nom = nom; }
    if (prenom) { where.push('UPPER(c.prenom) = UPPER(@prenom)'); params.prenom = prenom; }
    const matches = await dbAll(`
      SELECT c.id, c.nom, c.prenom, c.fonction, c.entreprise_id, ent.nom AS entreprise_nom
      FROM contacts c JOIN entreprises ent ON ent.id = c.entreprise_id
      WHERE ${where.join(' AND ')}
      LIMIT 5
    `, params);
    res.json({ matches });
  } catch (err) { next(err); }
});

// ---- Import effectif : crée ou rattache l'entreprise, puis crée ou met à
//      jour le contact. Chaque étape ambiguë (entreprise absente, contact en
//      double) doit avoir déjà été validée côté extension avant cet appel. ----
router.post('/import', async (req, res, next) => {
  try {
    const b = req.body;

    let entrepriseId = b.entreprise_id ? Number(b.entreprise_id) : null;
    if (!entrepriseId) {
      if (!b.createEntreprise || !b.entreprise_nom) {
        return res.status(400).json({ error: "entreprise_id, ou (createEntreprise + entreprise_nom), requis." });
      }
      const nom = String(b.entreprise_nom).trim();
      const row = await dbGet(`
        INSERT INTO entreprises (nom, nom_normalise, statut, source_import, created_at, updated_at)
        VALUES (@nom, @nom_normalise, 'prospect', 'Extension LinkedIn', now(), now())
        RETURNING id
      `, { nom, nom_normalise: normalizeNom(nom) });
      entrepriseId = row.id;
    } else {
      const ent = await dbGet('SELECT id FROM entreprises WHERE id = ?', [entrepriseId]);
      if (!ent) return res.status(404).json({ error: 'Entreprise introuvable.' });
    }

    let contact;
    if (b.contactId && b.updateExisting) {
      const existing = await dbGet('SELECT * FROM contacts WHERE id = ?', [b.contactId]);
      if (!existing) return res.status(404).json({ error: 'Contact introuvable.' });
      await dbRun(`
        UPDATE contacts SET
          fonction = @fonction, localisation = @localisation, linkedin_url = @linkedin_url,
          entreprise_id = @entreprise_id, updated_at = now()
        WHERE id = @id
      `, {
        id: b.contactId,
        fonction: b.fonction || existing.fonction,
        localisation: b.ville || existing.localisation,
        linkedin_url: b.linkedin_url || existing.linkedin_url,
        entreprise_id: entrepriseId,
      });
      contact = await dbGet('SELECT * FROM contacts WHERE id = ?', [b.contactId]);
    } else {
      if (!b.nom && !b.prenom) return res.status(400).json({ error: 'Nom ou prénom requis.' });
      const row = await dbGet(`
        INSERT INTO contacts (
          entreprise_id, nom, prenom, fonction, localisation, linkedin_url,
          source, statut, incomplete, created_at, updated_at
        ) VALUES (
          @entreprise_id, @nom, @prenom, @fonction, @localisation, @linkedin_url,
          'Extension LinkedIn', 'prospect_a_contacter', true, now(), now()
        ) RETURNING id
      `, {
        entreprise_id: entrepriseId,
        nom: b.nom || '', prenom: b.prenom || '', fonction: b.fonction || '',
        localisation: b.ville || '', linkedin_url: b.linkedin_url || '',
      });
      contact = await dbGet('SELECT * FROM contacts WHERE id = ?', [row.id]);
    }

    res.status(201).json({ contact, entreprise_id: entrepriseId, fiche_url: `/clients/contact/${contact.id}` });
  } catch (err) { next(err); }
});

module.exports = router;
