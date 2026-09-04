// Envoi individuel d'un e-mail de prospection à un contact, depuis sa fiche.
// Monté à la racine /api (comme echanges.js) pour exposer
// POST /api/contacts/:contactId/send-email.
const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const { dbGet, dbRun } = require('../../db/pg');
const gmailService = require('../services/gmail');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 5 } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TOTAL_ATTACHMENTS_BYTES = 20 * 1024 * 1024;

router.post('/contacts/:contactId/send-email', upload.array('attachments', 5), async (req, res, next) => {
  try {
    const contact = await dbGet(`
      SELECT c.*, e.nom AS entreprise_nom FROM contacts c JOIN entreprises e ON e.id = c.entreprise_id WHERE c.id = ?
    `, [req.params.contactId]);
    if (!contact) return res.status(404).json({ error: 'Contact introuvable' });
    if (!contact.email || !EMAIL_RE.test(contact.email)) {
      return res.status(400).json({ error: "Ce contact n'a pas d'adresse e-mail valide." });
    }
    if (contact.email_opt_out) {
      return res.status(403).json({ error: 'Ce contact est désinscrit des e-mails de prospection — envoi bloqué.' });
    }

    const { subject, body } = req.body;
    const templateId = req.body.template_id || null;
    if (!subject || !subject.trim()) return res.status(400).json({ error: "L'objet est requis." });
    if (!body || !body.trim()) return res.status(400).json({ error: 'Le contenu est requis.' });

    const files = req.files || [];
    const totalSize = files.reduce((s, f) => s + f.size, 0);
    if (totalSize > MAX_TOTAL_ATTACHMENTS_BYTES) {
      return res.status(400).json({ error: 'Taille totale des pièces jointes trop importante (20 Mo maximum au total).' });
    }

    const connection = await gmailService.getConnection();
    if (!connection) {
      const err = new Error('Aucun compte Gmail connecté. Connectez-le depuis Paramètres avant d\'envoyer un e-mail.');
      err.status = 409;
      throw err;
    }

    const attachments = files.map((f) => ({ filename: f.originalname, mimeType: f.mimetype, buffer: f.buffer }));

    let sendResult;
    try {
      sendResult = await gmailService.sendMessage({ to: contact.email, subject, body, attachments });
    } catch (err) {
      // On garde une trace de l'échec dans l'historique des envois, mais on
      // NE crée PAS d'échange : rien n'est réellement parti.
      await dbRun(`
        INSERT INTO email_sends (
          contact_id, entreprise_id, template_id, destinataire_email, expediteur_email,
          objet, contenu, statut, erreur, created_at, updated_at
        ) VALUES (@contact_id, @entreprise_id, @template_id, @dest, @exp, @objet, @contenu, 'echec', @erreur, now(), now())
      `, {
        contact_id: contact.id, entreprise_id: contact.entreprise_id, template_id: templateId,
        dest: contact.email, exp: connection.email, objet: subject, contenu: body, erreur: err.message,
      });
      const wrapped = new Error(`Échec de l'envoi via Gmail : ${err.message}`);
      wrapped.status = 502;
      throw wrapped;
    }

    await dbRun(`
      INSERT INTO email_sends (
        contact_id, entreprise_id, template_id, destinataire_email, expediteur_email,
        objet, contenu, statut, gmail_message_id, envoye_at, created_at, updated_at
      ) VALUES (@contact_id, @entreprise_id, @template_id, @dest, @exp, @objet, @contenu, 'envoye', @msgId, now(), now(), now())
    `, {
      contact_id: contact.id, entreprise_id: contact.entreprise_id, template_id: templateId,
      dest: contact.email, exp: sendResult.from, objet: subject, contenu: body, msgId: sendResult.messageId,
    });

    // Historisé comme un échange classique (type "email") : apparaît
    // immédiatement dans le journal et sur la fiche du prospect, sans écran
    // supplémentaire à construire pour "l'historique".
    const dh = crypto.createHash('md5').update(`email|${Date.now()}|${Math.random()}`).digest('hex');
    const nowIso = new Date().toISOString().slice(0, 16);
    const echangeRow = await dbGet(`
      INSERT INTO echanges (
        contact_id, entreprise_id, date_echange, date_approximative, type, objet, compte_rendu,
        auteur, source_import, dedup_hash, created_at, updated_at
      ) VALUES (
        @contact_id, @entreprise_id, @date_echange, false, 'email', @objet, @compte_rendu,
        'Administrateur Neogia', false, @dedup_hash, now(), now()
      ) RETURNING id
    `, {
      contact_id: contact.id, entreprise_id: contact.entreprise_id, date_echange: nowIso,
      objet: subject, compte_rendu: body, dedup_hash: dh,
    });
    await dbRun(`UPDATE contacts SET dernier_echange_at = @d, updated_at = now() WHERE id = @id`, { d: nowIso, id: contact.id });

    res.status(201).json({ sent: true, gmailMessageId: sendResult.messageId, echangeId: echangeRow.id });
  } catch (err) { next(err); }
});

module.exports = router;
