// Neogia CRM — Adaptateur PostgreSQL (Supabase)
//
// Remplace better-sqlite3 (synchrone) par `pg` (asynchrone) tout en gardant
// une syntaxe de requête proche de l'existant (paramètres nommés @xxx ou
// positionnels ?) pour limiter la réécriture des routes.
//
// Connexion : chaîne de connexion Postgres fournie par Supabase
// (variable d'environnement DATABASE_URL), jamais codée en dur.
const { Pool, types } = require('pg');

// Postgres renvoie les BIGINT (type de nos colonnes id) sous forme de chaîne
// par défaut (pour ne pas perdre de précision au-delà de 2^53). Nos identifiants
// et compteurs restent largement dans la plage sûre d'un Number JS : on les
// convertit donc automatiquement pour que le code existant (comparaisons,
// arithmétique) continue de fonctionner sans changement.
types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));

if (!process.env.DATABASE_URL) {
  console.error('ERREUR : la variable d\'environnement DATABASE_URL est absente.');
  console.error('Elle doit contenir la chaîne de connexion PostgreSQL Supabase (Settings > Database > Connection string).');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

pool.on('error', (err) => {
  console.error('Erreur inattendue sur le pool PostgreSQL :', err);
});

/**
 * Convertit une requête à paramètres nommés (@foo) + un objet {foo: valeur}
 * en requête positionnelle Postgres ($1, $2...) + tableau de valeurs ordonné.
 */
function namedToPositional(sql, params = {}) {
  const values = [];
  const seen = {};
  const text = sql.replace(/@([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
    if (!(name in params)) {
      throw new Error(`Paramètre manquant @${name} pour la requête : ${sql.slice(0, 120)}...`);
    }
    if (name in seen) return `$${seen[name]}`;
    values.push(params[name]);
    seen[name] = values.length;
    return `$${values.length}`;
  });
  return { text, values };
}

/** Convertit une requête à paramètres positionnels (?) en $1, $2... */
function qMarkToPositional(sql, arr = []) {
  let i = 0;
  const text = sql.replace(/\?/g, () => `$${++i}`);
  return { text, values: arr };
}

function toPositional(sql, params) {
  if (Array.isArray(params)) return qMarkToPositional(sql, params);
  if (params === undefined) return { text: sql, values: [] };
  return namedToPositional(sql, params);
}

/** Retourne la première ligne ou undefined (équivalent .get()) */
async function dbGet(sql, params) {
  const { text, values } = toPositional(sql, params);
  const { rows } = await pool.query(text, values);
  return rows[0];
}

/** Retourne toutes les lignes (équivalent .all()) */
async function dbAll(sql, params) {
  const { text, values } = toPositional(sql, params);
  const { rows } = await pool.query(text, values);
  return rows;
}

/**
 * Exécute une requête d'écriture (équivalent .run()).
 * Retourne { rowCount, rows } — pour un INSERT, ajouter "RETURNING id" dans
 * le SQL et lire result.rows[0].id (équivalent de lastInsertRowid).
 */
async function dbRun(sql, params) {
  const { text, values } = toPositional(sql, params);
  const result = await pool.query(text, values);
  return result;
}

/** Exécute plusieurs requêtes au sein d'une même transaction. */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const scoped = {
      get: async (sql, params) => {
        const { text, values } = toPositional(sql, params);
        const { rows } = await client.query(text, values);
        return rows[0];
      },
      all: async (sql, params) => {
        const { text, values } = toPositional(sql, params);
        const { rows } = await client.query(text, values);
        return rows;
      },
      run: async (sql, params) => {
        const { text, values } = toPositional(sql, params);
        return client.query(text, values);
      },
    };
    const result = await fn(scoped);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, dbGet, dbAll, dbRun, withTransaction };
