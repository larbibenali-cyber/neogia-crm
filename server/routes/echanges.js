const express = require('express');
const crypto = require('crypto');
const { dbGet, dbAll, dbRun } = require('../../db/pg');
const { generateReference } = require('../utils');

const router = express.Router();

router.get('/contacts/:contactId/echanges', async (req, res, next) => {
  try {
    const rows = await dbAll(`SELECT * FROM echanges WHERE contact_id = ? ORDER BY (date_echange IS NULL) ASC, COALESCE(date_echange, created_at::text) DESC`, [req.params.contactId]);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/contacts/:contactId/echanges', async (req, res, next) => {
  try {
    const contact = await dbGet('SELECT * FROM contacts WHERE id = ?', [req.params.contactId]);
    if (!contact) return res.status(404).json({ error: 'Contact introuvable' });
    const b = req.body;
    const dh = crypto.createHash('md5').update(`manual|${Date.now()}|${Math.random()}`).digest('hex');
    const dateEchange = b.date_echange || new Date().toISOString().slice(0, 10);
    const row = await dbGet(`
      INSERT INTO echanges (
        contact_id, entreprise_id, date_echange, date_approximative, type, objet, compte_rendu,
        prochaine_action, date_relance, auteur, source_import, dedup_hash, created_at, updated_at
      ) VALUES (
        @contact_id, @entreprise_id, @date_echange, false, @type, @objet, @compte_rendu,
        @prochaine_action, @date_relance, @auteur, false, @dedup_hash, now(), now()
      ) RETURNING id
    `, {
      contact_id: contact.id,
      entreprise_id: contact.entreprise_id,
      date_echange: dateEchange,
      type: b.type || 'autre',
      objet: b.objet || '',
      compte_rendu: b.compte_rendu || '',
      prochaine_action: b.prochaine_action || '',
      date_relance: b.date_relance || null,
      auteur: b.auteur || 'Administrateur Neogia',
      dedup_hash: dh,
    });
    await dbRun(`UPDATE contacts SET dernier_echange_at = @d, updated_at = now() WHERE id = @id AND (dernier_echange_at IS NULL OR dernier_echange_at < @d)`,
      { d: dateEchange, id: contact.id });
    res.status(201).json(await dbGet('SELECT * FROM echanges WHERE id = ?', [row.id]));
  } catch (err) { next(err); }
});

router.put('/echanges/:id', async (req, res, next) => {
  try {
    const existing = await dbGet('SELECT * FROM echanges WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Échange introuvable' });
    const b = req.body;
    await dbRun(`
      UPDATE echanges SET date_echange=@date_echange, type=@type, objet=@objet, compte_rendu=@compte_rendu,
        prochaine_action=@prochaine_action, date_relance=@date_relance, updated_at=now()
      WHERE id=@id
    `, {
      id: req.params.id,
      date_echange: b.date_echange ?? existing.date_echange,
      type: b.type ?? existing.type,
      objet: b.objet ?? existing.objet,
      compte_rendu: b.compte_rendu ?? existing.compte_rendu,
      prochaine_action: b.prochaine_action ?? existing.prochaine_action,
      date_relance: b.date_relance ?? existing.date_relance,
    });
    res.json(await dbGet('SELECT * FROM echanges WHERE id = ?', [req.params.id]));
  } catch (err) { next(err); }
});

router.delete('/echanges/:id', async (req, res, next) => {
  try {
    await dbRun('DELETE FROM echanges WHERE id = ?', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

// Créer un besoin directement depuis un échange
router.post('/echanges/:id/create-besoin', async (req, res, next) => {
  try {
    const echange = await dbGet('SELECT * FROM echanges WHERE id = ?', [req.params.id]);
    if (!echange) return res.status(404).json({ error: 'Échange introuvable' });
    const contact = await dbGet('SELECT * FROM contacts WHERE id = ?', [echange.contact_id]);
    const b = req.body || {};
    const reference = await generateReference(dbAll);
    const row = await dbGet(`
      INSERT INTO besoins (
        reference, titre, entreprise_id, contact_id, description_contexte, statut, priorite,
        source, echange_origine_id, created_at, updated_at
      ) VALUES (@reference, @titre, @entreprise_id, @contact_id, @description_contexte, 'a_venir', 'normale',
        'Échange client', @echange_origine_id, now(), now()) RETURNING id
    `, {
      reference,
      titre: b.titre || `Besoin identifié - ${contact.prenom} ${contact.nom}`,
      entreprise_id: echange.entreprise_id,
      contact_id: contact.id,
      description_contexte: b.description_contexte || echange.compte_rendu,
      echange_origine_id: echange.id,
    });
    res.status(201).json(await dbGet('SELECT * FROM besoins WHERE id = ?', [row.id]));
  } catch (err) { next(err); }
});

module.exports = router;
