// Vérifie que chaque requête API porte une session Supabase Auth valide.
// La clé service_role n'est utilisée que côté serveur (jamais exposée au
// navigateur) : elle sert uniquement à vérifier les jetons envoyés par le
// frontend et à administrer le stockage des CV.
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERREUR : SUPABASE_URL et/ou SUPABASE_SERVICE_ROLE_KEY sont absents des variables d\'environnement.');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentification requise.' });
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data || !data.user) {
      return res.status(401).json({ error: 'Session invalide ou expirée. Merci de vous reconnecter.' });
    }
    req.user = data.user;
    next();
  } catch (err) {
    console.error('Erreur de vérification de session :', err);
    res.status(401).json({ error: 'Authentification impossible.' });
  }
}

module.exports = { requireAuth, supabaseAdmin };
