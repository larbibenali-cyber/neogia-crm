const express = require('express');
const multer = require('multer');
const { dbGet, dbAll, dbRun } = require('../../db/pg');
const { paginate } = require('../utils');
const { uploadLogo } = require('../storage');

const router = express.Router();

// Upload de logo manuel (JPG/PNG/WEBP/SVG) — même pattern que l'upload de CV : le
// fichier ne transite qu'en mémoire, jamais écrit sur disque, puis part vers le
// bucket public Supabase Storage "logos".
const uploadLogoMw = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.mimetype)) {
      return cb(new Error('Formats acceptés : PNG, JPG, WEBP, SVG'));
    }
    cb(null, true);
  },
});

async function attachExtras(ent) {
  if (!ent) return ent;
  ent.technologies = await dbAll(`
    SELECT t.id, t.nom, t.categorie, t.custom, et.weight
    FROM entreprise_technologies et JOIN technologies t ON t.id = et.technology_id
    WHERE et.entreprise_id = ? ORDER BY et.weight DESC
  `, [ent.id]);
  ent.contacts_count = (await dbGet(`SELECT COUNT(*) c FROM contacts WHERE entreprise_id = ? AND archived = false`, [ent.id])).c;
  ent.besoins_count = (await dbGet(`SELECT COUNT(*) c FROM besoins WHERE entreprise_id = ?`, [ent.id])).c;
  ent.besoins_ouverts_count = (await dbGet(`
    SELECT COUNT(*) c FROM besoins WHERE entreprise_id = ? AND archived = false AND statut_synthese IN ('À venir', 'En cours')
  `, [ent.id])).c;
  return ent;
}

// ---- Liste : une ligne par entreprise (jamais de doublon), avec les agrégats
//      nécessaires à la vue "Entreprises" — tout calculé en base, jamais chargé
//      contact par contact. ----
router.get('/', async (req, res, next) => {
  try {
    const { search, tech, statut, archived } = req.query;
    const { page, pageSize, offset } = paginate(req.query);
    const where = [`e.archived = @archived`];
    const params = { archived: archived === 'true' };
    if (search) { where.push(`e.nom ILIKE @s`); params.s = `%${search}%`; }
    if (statut) { where.push(`e.statut = @statut`); params.statut = statut; }
    if (tech) {
      const techNames = String(tech).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
      if (techNames.length) {
        where.push(`EXISTS (
          SELECT 1 FROM entreprise_technologies et JOIN technologies t ON t.id = et.technology_id
          WHERE et.entreprise_id = e.id AND lower(t.nom) = ANY(@techNames::text[])
        )`);
        params.techNames = techNames;
      }
    }
    const whereSql = where.join(' AND ');
    const total = (await dbGet(`SELECT COUNT(*)::int c FROM entreprises e WHERE ${whereSql}`, params)).c;
    const rows = await dbAll(`
      SELECT e.* FROM entreprises e WHERE ${whereSql} ORDER BY e.nom LIMIT @limit OFFSET @offset
    `, { ...params, limit: pageSize, offset });

    const ids = rows.map((r) => r.id);
    let contactsById = {}, besoinsById = {}, besoinsOuvertsById = {}, techById = {}, lastExchangeById = {};
    if (ids.length) {
      const contactsCounts = await dbAll(`SELECT entreprise_id, COUNT(*)::int n FROM contacts WHERE entreprise_id = ANY(?::bigint[]) AND archived = false GROUP BY entreprise_id`, [ids]);
      contactsById = Object.fromEntries(contactsCounts.map((r) => [r.entreprise_id, r.n]));

      const besoinsCounts = await dbAll(`SELECT entreprise_id, COUNT(*)::int n FROM besoins WHERE entreprise_id = ANY(?::bigint[]) GROUP BY entreprise_id`, [ids]);
      besoinsById = Object.fromEntries(besoinsCounts.map((r) => [r.entreprise_id, r.n]));

      const besoinsOuverts = await dbAll(`
        SELECT entreprise_id, COUNT(*)::int n FROM besoins
        WHERE entreprise_id = ANY(?::bigint[]) AND archived = false AND statut_synthese IN ('À venir', 'En cours')
        GROUP BY entreprise_id
      `, [ids]);
      besoinsOuvertsById = Object.fromEntries(besoinsOuverts.map((r) => [r.entreprise_id, r.n]));

      const techRows = await dbAll(`
        SELECT et.entreprise_id, t.id, t.nom, t.categorie, et.weight
        FROM entreprise_technologies et JOIN technologies t ON t.id = et.technology_id
        WHERE et.entreprise_id = ANY(?::bigint[]) ORDER BY et.weight DESC
      `, [ids]);
      for (const r of techRows) {
        (techById[r.entreprise_id] = techById[r.entreprise_id] || []).push({ id: r.id, nom: r.nom, categorie: r.categorie, weight: r.weight });
      }

      const lastEx = await dbAll(`
        SELECT entreprise_id, MAX(COALESCE(date_echange, created_at::text)) AS last
        FROM echanges WHERE entreprise_id = ANY(?::bigint[]) GROUP BY entreprise_id
      `, [ids]);
      lastExchangeById = Object.fromEntries(lastEx.map((r) => [r.entreprise_id, r.last]));
    }

    const results = rows.map((e) => ({
      ...e,
      contacts_count: contactsById[e.id] || 0,
      besoins_count: besoinsById[e.id] || 0,
      besoins_ouverts_count: besoinsOuvertsById[e.id] || 0,
      technologies: (techById[e.id] || []).slice(0, 5),
      technologies_count: (techById[e.id] || []).length,
      dernier_echange_at: lastExchangeById[e.id] || null,
    }));

    res.json({ total, page, pageSize, results });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const ent = await dbGet('SELECT * FROM entreprises WHERE id = ?', [req.params.id]);
    if (!ent) return res.status(404).json({ error: 'Entreprise introuvable' });
    await attachExtras(ent);
    ent.contacts = await dbAll('SELECT * FROM contacts WHERE entreprise_id = ? AND archived = false ORDER BY nom', [ent.id]);
    // On n'affiche que les besoins actifs (non archivés) sur la fiche entreprise : les
    // besoins archivés — dont d'éventuels enregistrements de test — ne doivent jamais
    // se mélanger silencieusement aux besoins réels et actifs du client.
    ent.besoins = await dbAll('SELECT * FROM besoins WHERE entreprise_id = ? AND archived = false ORDER BY created_at DESC', [ent.id]);
    ent.echanges = await dbAll(`
      SELECT ech.*, c.nom as contact_nom, c.prenom as contact_prenom
      FROM echanges ech LEFT JOIN contacts c ON c.id = ech.contact_id
      WHERE ech.entreprise_id = ?
      ORDER BY (ech.date_echange IS NULL) ASC, COALESCE(ech.date_echange, ech.created_at::text) DESC
    `, [ent.id]);
    res.json(ent);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.nom) return res.status(400).json({ error: 'Nom requis' });
    const nomNorm = String(b.nom).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '');
    const row = await dbGet(`
      INSERT INTO entreprises (nom, nom_normalise, secteur, adresse, site_web, notes, statut, created_at, updated_at)
      VALUES (@nom, @nom_normalise, @secteur, @adresse, @site_web, @notes, @statut, now(), now()) RETURNING id
    `, { nom: b.nom, nom_normalise: nomNorm, secteur: b.secteur || '', adresse: b.adresse || '', site_web: b.site_web || '', notes: b.notes || '', statut: b.statut || 'prospect' });
    res.status(201).json(await attachExtras(await dbGet('SELECT * FROM entreprises WHERE id = ?', [row.id])));
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await dbGet('SELECT * FROM entreprises WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Entreprise introuvable' });
    const b = req.body;
    await dbRun(`
      UPDATE entreprises SET nom=@nom, secteur=@secteur, adresse=@adresse, site_web=@site_web, notes=@notes, statut=@statut, updated_at=now()
      WHERE id=@id
    `, {
      id: req.params.id, nom: b.nom ?? existing.nom, secteur: b.secteur ?? existing.secteur, adresse: b.adresse ?? existing.adresse,
      site_web: b.site_web ?? existing.site_web, notes: b.notes ?? existing.notes, statut: b.statut ?? existing.statut,
    });
    res.json(await attachExtras(await dbGet('SELECT * FROM entreprises WHERE id = ?', [req.params.id])));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await dbGet('SELECT * FROM entreprises WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Entreprise introuvable' });
    if (req.query.hard === 'true') {
      await dbRun('DELETE FROM entreprises WHERE id = ?', [req.params.id]);
      return res.json({ deleted: true });
    }
    await dbRun(`UPDATE entreprises SET archived = true, updated_at = now() WHERE id = ?`, [req.params.id]);
    res.json({ archived: true });
  } catch (err) { next(err); }
});

// ---- Logo manuel de l'entreprise ----
router.post('/:id/logo', uploadLogoMw.single('logo'), async (req, res, next) => {
  try {
    const ent = await dbGet('SELECT * FROM entreprises WHERE id = ?', [req.params.id]);
    if (!ent) return res.status(404).json({ error: 'Entreprise introuvable' });
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu (champ "logo" attendu : PNG, JPG, WEBP ou SVG)' });
    const { publicUrl } = await uploadLogo(ent.id, req.file.buffer, req.file.mimetype);
    await dbRun('UPDATE entreprises SET logo_url = ?, updated_at = now() WHERE id = ?', [publicUrl, ent.id]);
    res.status(201).json({ logo_url: publicUrl });
  } catch (err) { next(err); }
});

// ---- Gestion manuelle du nuage technologique ----
router.post('/:id/technologies', async (req, res, next) => {
  try {
    const { technology_name, category } = req.body;
    if (!technology_name) return res.status(400).json({ error: 'technology_name requis' });
    let tech = await dbGet('SELECT * FROM technologies WHERE nom = ?', [technology_name]);
    if (!tech) {
      const row = await dbGet(`INSERT INTO technologies (nom, categorie, custom, usage_count, created_at) VALUES (?, ?, true, 0, now()) RETURNING id`,
        [technology_name, category || 'autre']);
      tech = await dbGet('SELECT * FROM technologies WHERE id = ?', [row.id]);
    }
    await dbRun(`
      INSERT INTO entreprise_technologies (entreprise_id, technology_id, weight) VALUES (?, ?, 1)
      ON CONFLICT (entreprise_id, technology_id) DO UPDATE SET weight = entreprise_technologies.weight + 1
    `, [req.params.id, tech.id]);
    res.status(201).json({ added: tech });
  } catch (err) { next(err); }
});

router.delete('/:id/technologies/:techId', async (req, res, next) => {
  try {
    await dbRun('DELETE FROM entreprise_technologies WHERE entreprise_id = ? AND technology_id = ?', [req.params.id, req.params.techId]);
    res.json({ removed: true });
  } catch (err) { next(err); }
});

module.exports = router;
