const express = require('express');
const multer = require('multer');
const { dbGet, dbAll, dbRun } = require('../../db/pg');
const { paginate, toTagsArray } = require('../utils');
const { uploadCv, downloadCv, deleteCv } = require('../storage');

const router = express.Router();

// Un champ numérique laissé vide arrive du formulaire comme '' (chaîne vide), pas
// comme undefined/null : SQLite l'acceptait silencieusement, mais Postgres rejette
// '' pour une colonne numeric/real ("invalid input syntax for type real"). On
// normalise donc systématiquement en null avant toute requête.
function numOrNull(v) {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// Le fichier transite en mémoire uniquement le temps de la requête, puis part
// directement vers le bucket privé Supabase Storage — jamais écrit sur disque.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Seuls les fichiers PDF sont acceptés'));
    cb(null, true);
  },
});

async function attachExtras(c) {
  if (!c) return c;
  c.technologies = await dbAll(`
    SELECT t.id, t.nom, t.categorie FROM candidat_technologies ct JOIN technologies t ON t.id = ct.technology_id
    WHERE ct.candidat_id = ?
  `, [c.id]);
  c.cvs = await dbAll('SELECT id, candidat_id, original_name, mime, size, active, uploaded_at FROM cvs WHERE candidat_id = ? ORDER BY uploaded_at DESC', [c.id]);
  c.positionnements = await dbAll(`
    SELECT p.*, b.titre as besoin_titre, b.reference as besoin_reference, b.statut as besoin_statut, e.nom as entreprise_nom
    FROM positionnements p JOIN besoins b ON b.id = p.besoin_id JOIN entreprises e ON e.id = b.entreprise_id
    WHERE p.candidat_id = ? ORDER BY p.date_positionnement DESC
  `, [c.id]);
  return c;
}

// Heuristique best-effort : sur un CV, le nom du candidat apparaît en général
// dans les toutes premières lignes, souvent en 2 à 4 mots avec majuscules. La
// convention française fréquente est un mot tout en MAJUSCULES pour le nom de
// famille ; à défaut on suppose l'ordre "Prénom Nom".
function extractName(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 15);
  const nameLineRe = /^[A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’-]+(?:\s+[A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’-]+){1,3}$/;
  for (const line of lines) {
    if (line.length > 45 || /[0-9@]/.test(line)) continue;
    if (!nameLineRe.test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 4) continue;
    const isUpper = (w) => w === w.toUpperCase() && w !== w.toLowerCase();
    const upperWords = words.filter(isUpper);
    const otherWords = words.filter((w) => !isUpper(w));
    if (upperWords.length > 0 && otherWords.length > 0) {
      return { nom: upperWords.join(' '), prenom: otherWords.join(' ') };
    }
    return { prenom: words.slice(0, -1).join(' '), nom: words[words.length - 1] };
  }
  return { prenom: null, nom: null };
}

// Repli si aucune ligne ne ressemble à un nom : on tente de déduire prénom/nom
// depuis l'adresse e-mail détectée (ex: jean.dupont@... -> Jean / Dupont).
function nameFromEmail(email) {
  if (!email) return { prenom: null, nom: null };
  const local = email.split('@')[0];
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2 && parts.every((p) => /^[a-zA-Z]+$/.test(p))) {
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    return { prenom: cap(parts[0]), nom: cap(parts[parts.length - 1]) };
  }
  return { prenom: null, nom: null };
}

// Repère dans le texte du CV les technologies déjà connues en base (table
// `technologies`, alimentée par les fiches existantes) pour pré-remplir
// l'environnement technique du candidat.
async function matchTechnologies(text) {
  const known = await dbAll('SELECT nom FROM technologies', []);
  const found = [];
  for (const { nom } of known) {
    if (!nom || nom.length < 2) continue;
    const escaped = nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = /^[a-z0-9]+$/i.test(nom) ? new RegExp(`\\b${escaped}\\b`, 'i') : new RegExp(escaped, 'i');
    if (re.test(text)) found.push(nom);
  }
  return found.slice(0, 20);
}

// Extraction (best-effort) des infos principales d'un CV PDF, utilisée à la
// fois pour pré-remplir une fiche candidat existante et pour pré-remplir le
// formulaire de création d'un nouveau candidat.
async function extractCvFields(buffer) {
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);
  const text = data.text || '';
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(/(0|\+33\s?)[1-9](?:[\s.-]?\d{2}){4}/);
  const expMatch = text.match(/(\d{1,2})\s*(?:ans|an|years?)\s*(?:d['’]?exp[ée]rience)?/i);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const email = emailMatch ? emailMatch[0] : null;
  let { prenom, nom } = extractName(text);
  if (!prenom && !nom) ({ prenom, nom } = nameFromEmail(email));
  const technologies = await matchTechnologies(text);
  return {
    prenom, nom, email,
    telephone: phoneMatch ? phoneMatch[0] : null,
    annees_experience: expMatch ? parseInt(expMatch[1], 10) : null,
    intitule_profil: lines.length ? lines[0].slice(0, 120) : null,
    technologies,
    texte_brut_apercu: text.slice(0, 2000),
  };
}

async function setTechnologies(candidatId, techNames) {
  await dbRun('DELETE FROM candidat_technologies WHERE candidat_id = ?', [candidatId]);
  for (const name of (techNames || [])) {
    const n = String(name).trim();
    if (!n) continue;
    let t = await dbGet('SELECT * FROM technologies WHERE nom = ?', [n]);
    if (!t) {
      const row = await dbGet(`INSERT INTO technologies (nom, categorie, custom, usage_count, created_at) VALUES (?, 'autre', true, 0, now()) RETURNING id`, [n]);
      t = { id: row.id };
    }
    await dbRun('INSERT INTO candidat_technologies (candidat_id, technology_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [candidatId, t.id]);
  }
}

router.get('/', async (req, res, next) => {
  try {
    const { search, tech, metier, experience_min, experience_max, disponibilite, localisation, statut, besoin_id, archived } = req.query;
    const { page, pageSize, offset } = paginate(req.query);
    const where = [`c.archived = @archived`];
    const params = { archived: archived === 'true' };
    if (search) { where.push(`(c.nom ILIKE @s OR c.prenom ILIKE @s OR c.intitule_profil ILIKE @s OR c.competences_principales ILIKE @s OR c.metier ILIKE @s)`); params.s = `%${search}%`; }
    if (metier) { where.push(`c.metier ILIKE @metier`); params.metier = `%${metier}%`; }
    if (disponibilite) { where.push(`c.disponibilite = @disponibilite`); params.disponibilite = disponibilite; }
    if (localisation) { where.push(`c.localisation ILIKE @loc`); params.loc = `%${localisation}%`; }
    if (statut) { where.push(`c.statut = @statut`); params.statut = statut; }
    if (experience_min) { where.push(`c.annees_experience >= @expmin`); params.expmin = experience_min; }
    if (experience_max) { where.push(`c.annees_experience <= @expmax`); params.expmax = experience_max; }

    let rows = await dbAll(`SELECT c.* FROM candidats c WHERE ${where.join(' AND ')}`, params);

    if (tech) {
      const techNames = String(tech).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
      const filtered = [];
      for (const c of rows) {
        const names = (await dbAll(`SELECT t.nom FROM candidat_technologies ct JOIN technologies t ON t.id=ct.technology_id WHERE ct.candidat_id=?`, [c.id]))
          .map((r) => r.nom.toLowerCase());
        if (techNames.some((t) => names.includes(t))) filtered.push(c);
      }
      rows = filtered;
    }
    if (besoin_id) {
      const candIds = new Set((await dbAll('SELECT candidat_id FROM positionnements WHERE besoin_id = ?', [besoin_id])).map((r) => r.candidat_id));
      rows = rows.filter((c) => candIds.has(c.id));
    }

    const total = rows.length;
    rows.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
    const pageSlice = rows.slice(offset, offset + pageSize);
    const page_rows = [];
    for (const c of pageSlice) page_rows.push(await attachExtras(c));
    res.json({ total, page, pageSize, results: page_rows });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const c = await dbGet('SELECT * FROM candidats WHERE id = ?', [req.params.id]);
    if (!c) return res.status(404).json({ error: 'Candidat introuvable' });
    res.json(await attachExtras(c));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    const email = (b.email || '').trim().toLowerCase();
    const incomplete = (!b.prenom || !b.nom || !email);
    const row = await dbGet(`
      INSERT INTO candidats (
        prenom, nom, email, email_normalise, telephone, intitule_profil, metier, annees_experience,
        competences_principales, secteurs, localisation, mobilite, disponibilite, disponibilite_date,
        tjm, niveau_anglais, statut, source, notes, incomplete, created_at, updated_at
      ) VALUES (
        @prenom, @nom, @email, @email_normalise, @telephone, @intitule_profil, @metier, @annees_experience,
        @competences_principales, @secteurs, @localisation, @mobilite, @disponibilite, @disponibilite_date,
        @tjm, @niveau_anglais, @statut, @source, @notes, @incomplete, now(), now()
      ) RETURNING id
    `, {
      prenom: b.prenom || '', nom: b.nom || '', email: b.email || '', email_normalise: email,
      telephone: b.telephone || '', intitule_profil: b.intitule_profil || '', metier: b.metier || '',
      annees_experience: numOrNull(b.annees_experience), competences_principales: b.competences_principales || '',
      secteurs: b.secteurs || '', localisation: b.localisation || '', mobilite: b.mobilite || '',
      disponibilite: b.disponibilite || '', disponibilite_date: b.disponibilite_date || null,
      tjm: numOrNull(b.tjm), niveau_anglais: b.niveau_anglais || '', statut: b.statut || 'a_contacter',
      source: b.source || 'Saisie manuelle', notes: b.notes || '', incomplete,
    });
    if (b.technologies) await setTechnologies(row.id, toTagsArray(b.technologies));
    res.status(201).json(await attachExtras(await dbGet('SELECT * FROM candidats WHERE id = ?', [row.id])));
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await dbGet('SELECT * FROM candidats WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Candidat introuvable' });
    const b = req.body;
    const email = b.email !== undefined ? String(b.email).trim().toLowerCase() : existing.email_normalise;
    await dbRun(`
      UPDATE candidats SET
        prenom=@prenom, nom=@nom, email=@email, email_normalise=@email_normalise, telephone=@telephone,
        intitule_profil=@intitule_profil, metier=@metier, annees_experience=@annees_experience,
        competences_principales=@competences_principales, secteurs=@secteurs, localisation=@localisation,
        mobilite=@mobilite, disponibilite=@disponibilite, disponibilite_date=@disponibilite_date, tjm=@tjm,
        niveau_anglais=@niveau_anglais, statut=@statut, source=@source, notes=@notes, updated_at=now()
      WHERE id=@id
    `, {
      id: req.params.id,
      prenom: b.prenom ?? existing.prenom, nom: b.nom ?? existing.nom, email: b.email ?? existing.email, email_normalise: email,
      telephone: b.telephone ?? existing.telephone, intitule_profil: b.intitule_profil ?? existing.intitule_profil,
      metier: b.metier ?? existing.metier,
      annees_experience: b.annees_experience !== undefined ? numOrNull(b.annees_experience) : existing.annees_experience,
      competences_principales: b.competences_principales ?? existing.competences_principales, secteurs: b.secteurs ?? existing.secteurs,
      localisation: b.localisation ?? existing.localisation, mobilite: b.mobilite ?? existing.mobilite,
      disponibilite: b.disponibilite ?? existing.disponibilite,
      disponibilite_date: b.disponibilite_date !== undefined ? (b.disponibilite_date || null) : existing.disponibilite_date,
      tjm: b.tjm !== undefined ? numOrNull(b.tjm) : existing.tjm, niveau_anglais: b.niveau_anglais ?? existing.niveau_anglais,
      statut: b.statut ?? existing.statut, source: b.source ?? existing.source, notes: b.notes ?? existing.notes,
    });
    if (b.technologies) await setTechnologies(req.params.id, toTagsArray(b.technologies));
    res.json(await attachExtras(await dbGet('SELECT * FROM candidats WHERE id = ?', [req.params.id])));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await dbGet('SELECT * FROM candidats WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Candidat introuvable' });
    if (req.query.hard === 'true') {
      // Supprime aussi les CV du stockage pour ne rien laisser d'orphelin.
      const cvs = await dbAll('SELECT storage_path FROM cvs WHERE candidat_id = ?', [req.params.id]);
      for (const cv of cvs) { try { await deleteCv(cv.storage_path); } catch (e) { console.error(e); } }
      await dbRun('DELETE FROM candidats WHERE id = ?', [req.params.id]);
      return res.json({ deleted: true });
    }
    await dbRun(`UPDATE candidats SET archived = true, statut = 'archive', updated_at = now() WHERE id = ?`, [req.params.id]);
    res.json({ archived: true });
  } catch (err) { next(err); }
});

// Extraction à la volée pour pré-remplir le formulaire de CRÉATION d'un
// candidat (aucune fiche n'existe encore à ce stade) : le fichier n'est ni
// stocké ni rattaché à quoi que ce soit ici, seul le texte est analysé.
router.post('/cv-extract', upload.single('cv'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu (champ "cv" attendu, PDF uniquement)' });
    const suggestion = await extractCvFields(req.file.buffer);
    res.json({ suggestion, note: 'Extraction automatique indicative : merci de vérifier et compléter les champs avant de créer la fiche.' });
  } catch (err) {
    res.status(500).json({ error: `Extraction impossible : ${err.message}` });
  }
});

// ---- CV (stockage privé Supabase Storage) ----
router.post('/:id/cv', upload.single('cv'), async (req, res, next) => {
  try {
    const candidat = await dbGet('SELECT * FROM candidats WHERE id = ?', [req.params.id]);
    if (!candidat) return res.status(404).json({ error: 'Candidat introuvable' });
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu (champ "cv" attendu, PDF uniquement)' });

    const storagePath = await uploadCv(candidat.id, req.file.buffer, req.file.mimetype);

    await dbRun('UPDATE cvs SET active = false WHERE candidat_id = ?', [candidat.id]);
    const row = await dbGet(`
      INSERT INTO cvs (candidat_id, storage_path, original_name, mime, size, active, uploaded_at)
      VALUES (?, ?, ?, ?, ?, true, now()) RETURNING id
    `, [candidat.id, storagePath, req.file.originalname, req.file.mimetype, req.file.size]);

    const cv = await dbGet('SELECT id, candidat_id, original_name, mime, size, active, uploaded_at FROM cvs WHERE id = ?', [row.id]);
    res.status(201).json(cv);
  } catch (err) { next(err); }
});

router.get('/:id/cv/:cvId/download', async (req, res, next) => {
  try {
    const cv = await dbGet('SELECT * FROM cvs WHERE id = ? AND candidat_id = ?', [req.params.cvId, req.params.id]);
    if (!cv) return res.status(404).json({ error: 'CV introuvable' });
    const buffer = await downloadCv(cv.storage_path);
    res.setHeader('Content-Type', cv.mime || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(cv.original_name)}"`);
    res.send(buffer);
  } catch (err) { next(err); }
});

router.delete('/:id/cv/:cvId', async (req, res, next) => {
  try {
    const cv = await dbGet('SELECT * FROM cvs WHERE id = ? AND candidat_id = ?', [req.params.cvId, req.params.id]);
    if (!cv) return res.status(404).json({ error: 'CV introuvable' });
    await deleteCv(cv.storage_path);
    await dbRun('DELETE FROM cvs WHERE id = ?', [cv.id]);
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

// Extraction (best-effort) des infos principales du CV pour préremplissage — nécessite validation manuelle
router.post('/:id/cv/:cvId/extract', async (req, res) => {
  try {
    const cv = await dbGet('SELECT * FROM cvs WHERE id = ? AND candidat_id = ?', [req.params.cvId, req.params.id]);
    if (!cv) return res.status(404).json({ error: 'CV introuvable' });
    const buffer = await downloadCv(cv.storage_path);
    const suggestion = await extractCvFields(buffer);
    res.json({ suggestion, note: 'Extraction automatique indicative : merci de vérifier et valider chaque champ avant enregistrement.' });
  } catch (err) {
    res.status(500).json({ error: `Extraction impossible : ${err.message}` });
  }
});

module.exports = router;
