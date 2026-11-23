// Routes Gmail authentifiées (montées après requireAuth dans server.js) :
// statut de connexion, démarrage du flux OAuth, déconnexion. Le callback
// OAuth lui-même vit dans gmailPublic.js (voir ce fichier pour le pourquoi).
const express = require('express');
const crypto = require('crypto');
const gmailService = require('../services/gmail');

const router = express.Router();

router.get('/status', async (req, res, next) => {
  try {
    const conn = await gmailService.getConnection();
    res.json({ connected: !!conn, email: conn ? conn.email : null, connectedAt: conn ? conn.connected_at : null });
  } catch (err) { next(err); }
});

router.get('/oauth/start', (req, res, next) => {
  try {
    const state = crypto.randomBytes(16).toString('hex');
    res.cookie('gmail_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      maxAge: 5 * 60 * 1000,
    });
    res.json({ url: gmailService.getAuthUrl(state) });
  } catch (err) { next(err); }
});

router.post('/disconnect', async (req, res, next) => {
  try {
    await gmailService.disconnect();
    res.json({ disconnected: true });
  } catch (err) { next(err); }
});

// Lecture seule des messages envoyés/reçus depuis une date donnée — réservée
// au module Priorisation activité, aucune écriture possible via cette route.
router.get('/messages', async (req, res, next) => {
  try {
    const since = req.query.since;
    if (!since) return res.status(400).json({ error: 'Paramètre "since" requis (date ISO).' });
    const result = await gmailService.listMessagesSince(since);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
