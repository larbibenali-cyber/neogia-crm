// Route publique (montée AVANT requireAuth dans server.js) : c'est Google qui
// redirige le navigateur ici après l'écran de consentement, il n'y a donc pas
// de jeton Supabase disponible sur cette requête. La seule protection est le
// paramètre "state" (posé en cookie httpOnly lors du départ vers Google) —
// aucune donnée sensible n'est exposée dans cette réponse (une redirection).
const express = require('express');
const gmailService = require('../services/gmail');

const router = express.Router();

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  const found = raw.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
}

router.get('/oauth/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const expectedState = readCookie(req, 'gmail_oauth_state');
  res.clearCookie('gmail_oauth_state');
  const redirectTo = (params) => res.redirect(`/parametres?${new URLSearchParams(params).toString()}`);

  if (error) return redirectTo({ gmail: 'error', reason: String(error) });
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectTo({ gmail: 'error', reason: 'state_invalide' });
  }
  try {
    const { email } = await gmailService.handleOAuthCallback(code);
    redirectTo({ gmail: 'connected', email });
  } catch (err) {
    console.error('Erreur callback OAuth Gmail :', err.message);
    redirectTo({ gmail: 'error', reason: err.message });
  }
});

module.exports = router;
