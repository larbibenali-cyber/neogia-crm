#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { requireAuth } = require('./server/middleware/auth');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

// ---- Vérification de configuration au démarrage ----
const REQUIRED_ENV = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length) {
  console.error(`ATTENTION : variables d'environnement manquantes : ${missingEnv.join(', ')}`);
  console.error('L\'application ne pourra pas fonctionner correctement tant qu\'elles ne sont pas configurées.');
}

// ---- Contrôle de santé (public — ne renvoie aucune donnée, utilisé par l'hébergeur) ----
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ---- Toutes les routes API suivantes exigent une session Supabase Auth valide ----
app.use('/api', requireAuth);

app.use('/api/entreprises', require('./server/routes/entreprises'));
app.use('/api/contacts', require('./server/routes/contacts'));
app.use('/api', require('./server/routes/echanges')); // /api/contacts/:id/echanges, /api/echanges/:id
app.use('/api/technologies', require('./server/routes/technologies'));
app.use('/api/picklists', require('./server/routes/picklists'));
app.use('/api/candidats', require('./server/routes/candidats'));
app.use('/api/besoins', require('./server/routes/besoins'));
app.use('/api/positionnements', require('./server/routes/positionnements'));
app.use('/api/dashboard', require('./server/routes/dashboard'));
app.use('/api/search', require('./server/routes/search'));
app.use('/api/export', require('./server/routes/exportRoutes'));
app.use('/api/import', require('./server/routes/importRoutes'));
app.use('/api/backup', require('./server/routes/backupRoutes'));

// ---- Frontend statique (build Vite) ----
// Le frontend applique lui-même sa propre protection (redirection vers /login
// si aucune session Supabase valide) ; les données, elles, restent de toute
// façon inaccessibles tant que l'API n'a pas reçu de jeton valide ci-dessus.
const CLIENT_DIST = path.join(__dirname, 'public');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

// ---- Gestion des erreurs ----
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' });
});

app.listen(PORT, () => {
  console.log(`\nNeogia CRM démarré : http://localhost:${PORT}\n`);
});
