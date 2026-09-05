// Authentification par jeton d'accès personnel — utilisée UNIQUEMENT par les
// routes de l'extension navigateur LinkedIn (server/routes/extension.js).
// Distincte de la session Supabase Auth (server/middleware/auth.js) : ce
// jeton est généré depuis Paramètres > Extension LinkedIn, stocké haché
// (SHA-256, jamais en clair) dans app_settings, et permet à l'extension de
// créer/mettre à jour des fiches sans authentification Supabase dans le
// navigateur où tourne l'extension.
const crypto = require('crypto');
const { dbGet } = require('../../db/pg');

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

async function requireApiToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return res.status(401).json({ error: "Jeton d'accès requis." });
  try {
    const row = await dbGet('SELECT value FROM app_settings WHERE key = ?', ['extension_api_token_hash']);
    if (!row || !row.value) {
      return res.status(401).json({ error: "Aucun jeton actif. Générez-en un depuis Paramètres > Extension LinkedIn." });
    }
    const providedHash = hashToken(token);
    const a = Buffer.from(providedHash, 'hex');
    const b = Buffer.from(row.value, 'hex');
    // Comparaison en temps constant pour éviter une attaque par timing.
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: 'Jeton invalide ou révoqué.' });
    }
    next();
  } catch (err) {
    console.error("Erreur de vérification du jeton d'extension :", err);
    res.status(401).json({ error: 'Authentification impossible.' });
  }
}

module.exports = { requireApiToken, hashToken };
