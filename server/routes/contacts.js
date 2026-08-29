const express = require('express');
const { dbGet, dbAll, dbRun } = require('../../db/pg');
const { paginate, toTagsArray, parseJsonSafe } = require('../utils');

const router = express.Router();

async function attachExtras(contact) {
  if (!contact) return contact;
  contact.tags = parseJsonSafe(contact.tags, []);
  contact.technologies = await dbAll(`
    SELECT t.id, t.nom, t.categorie, et.weight
    FROM entreprise_technologies et JOIN technologies t ON t.id = et.technology_id
    WHERE et.entreprise_id = ? ORDER BY et.weight DESC
  `, [contact.entreprise_id]);
  return contact;
}

// ---- Détection de doublon (utilisée avant création) ----
router.get('/check-duplicate', async (req, res, next) => {
  try {
    const { email, telephone, nom, prenom, entreprise_id } = req.query;
    const matches = [];
    if (email) {
      const e = String(email).trim().toLowerCase();
      matches.push(...await dbAll(`
        SELECT c.*, ent.nom as entreprise_nom FROM contacts c JOIN entreprises ent ON ent.id = c.entreprise_id
        WHERE c.email_normalise = ? AND c.archived = false
      `, [e]));
    }
    if (telephone) {
      const t = String(telephone).replace(/\D/g, '');
      if (t.length >= 6) {
        const all = await dbAll(`SELECT c.*, ent.nom as entreprise_nom FROM contacts c JOIN entreprises ent ON ent.id = c.entreprise_id WHERE c.archived = false`);
        all.forEach((c) => {
          const cm = (c.telephone_mobile || '').replace(/\D/g, '');
          const cf = (c.telephone_fixe || '').replace(/\D/g, '');
          if ((cm && cm === t) || (cf && cf === t)) matches.push(c);
        });
      }
    }
    if (nom && prenom && entreprise_id) {
      matches.push(...await dbAll(`
        SELECT c.*, ent.nom as entreprise_nom FROM contacts c JOIN entreprises ent ON ent.id = c.entreprise_id
        WHERE c.entreprise_id = ? AND UPPER(c.nom) = UPPER(?) AND UPPER(c.prenom) = UPPER(?) AND c.archived = false
      `, [entreprise_id, nom, prenom]));
    }
    const uniq = Object.values(Object.fromEntries(matches.map((m) => [m.id, m])));
    res.json({ duplicates: uniq });
  } catch (err) { next(err); }
});

// ---- Liste + recherche + filtres combinés (pagination et filtres 100% côté SQL :
//      aucune requête ne charge l'ensemble des ~2300 contacts en mémoire) ----
router.get('/', async (req, res, next) => {
  try {
    const { search, entreprise_id, statut, fonction, responsable, tech, tech_mode, tech_exclude,
      last_exchange_before, last_exchange_after, archived, incomplete, sort, sortDir } = req.query;
    const { page, pageSize, offset } = paginate(req.query);

    const where = [];
    const params = {};

    where.push(`c.archived = @archived`);
    params.archived = archived === 'true';

    if (search) {
      where.push(`(
        c.nom ILIKE @s OR c.prenom ILIKE @s OR c.email ILIKE @s OR c.telephone_mobile ILIKE @s OR
        c.telephone_fixe ILIKE @s OR c.fonction ILIKE @s OR ent.nom ILIKE @s OR c.notes ILIKE @s
      )`);
      params.s = `%${search}%`;
    }
    if (entreprise_id) { where.push(`c.entreprise_id = @entreprise_id`); params.entreprise_id = entreprise_id; }
    if (statut) { where.push(`c.statut = @statut`); params.statut = statut; }
    if (fonction) { where.push(`c.fonction ILIKE @fonction`); params.fonction = `%${fonction}%`; }
    if (responsable) { where.push(`c.responsable ILIKE @responsable`); params.responsable = `%${responsable}%`; }
    if (incomplete === 'true') where.push(`c.incomplete = true`);
    if (last_exchange_before) { where.push(`c.dernier_echange_at <= @leb`); params.leb = last_exchange_before; }
    if (last_exchange_after) { where.push(`c.dernier_echange_at >= @lea`); params.lea = last_exchange_after; }

    // Filtre technologie : porté par l'environnement technique de l'ENTREPRISE du contact
    // (entreprise_technologies), résolu en une seule sous-requête SQL — plus de boucle
    // par ligne (c'était la cause du blocage "Chargement" lors d'une recherche par techno).
    if (tech) {
      const techNames = String(tech).split(',').map((t) => t.trim()).filter(Boolean);
      const mode = tech_mode === 'all' ? 'all' : 'any';
      if (techNames.length) {
        if (mode === 'all') {
          where.push(`(
            SELECT COUNT(DISTINCT t.id) FROM entreprise_technologies et JOIN technologies t ON t.id = et.technology_id
            WHERE et.entreprise_id = c.entreprise_id AND lower(t.nom) = ANY(@techNames::text[])
          ) = @techCount`);
          params.techNames = techNames.map((t) => t.toLowerCase());
          params.techCount = techNames.length;
        } else {
          where.push(`EXISTS (
            SELECT 1 FROM entreprise_technologies et JOIN technologies t ON t.id = et.technology_id
            WHERE et.entreprise_id = c.entreprise_id AND lower(t.nom) = ANY(@techNames::text[])
          )`);
          params.techNames = techNames.map((t) => t.toLowerCase());
        }
      }
    }
    if (tech_exclude) {
      const excludeNames = String(tech_exclude).split(',').map((t) => t.trim()).filter(Boolean);
      if (excludeNames.length) {
        where.push(`NOT EXISTS (
          SELECT 1 FROM entreprise_technologies et JOIN technologies t ON t.id = et.technology_id
          WHERE et.entreprise_id = c.entreprise_id AND lower(t.nom) = ANY(@excludeNames::text[])
        )`);
        params.excludeNames = excludeNames.map((t) => t.toLowerCase());
      }
    }

    const whereSql = where.join(' AND ');
    const total = (await dbGet(`
      SELECT COUNT(*)::int AS total FROM contacts c JOIN entreprises ent ON ent.id = c.entreprise_id
      WHERE ${whereSql}
    `, params)).total;

    const sortCol = ['nom', 'prenom', 'entreprise_nom', 'statut', 'dernier_echange_at', 'created_at'].includes(sort) ? sort : 'nom';
    const sortExpr = sortCol === 'entreprise_nom' ? 'ent.nom' : `c.${sortCol}`;
    const dir = sortDir === 'desc' ? 'DESC' : 'ASC';

    const pageParams = { ...params, limit: pageSize, offset };
    const pageSlice = await dbAll(`
      SELECT c.*, ent.nom as entreprise_nom
      FROM contacts c JOIN entreprises ent ON ent.id = c.entreprise_id
      WHERE ${whereSql}
      ORDER BY ${sortExpr} ${dir} NULLS LAST, c.id ASC
      LIMIT @limit OFFSET @offset
    `, pageParams);

    // Technologies de la page courante : une seule requête groupée (pas une par ligne).
    const entIds = [...new Set(pageSlice.map((c) => c.entreprise_id).filter(Boolean))];
    const techRows = entIds.length ? await dbAll(`
      SELECT et.entreprise_id, t.id, t.nom, t.categorie, et.weight
      FROM entreprise_technologies et JOIN technologies t ON t.id = et.technology_id
      WHERE et.entreprise_id = ANY(?::bigint[])
      ORDER BY et.weight DESC
    `, [entIds]) : [];
    const techByEnt = {};
    for (const r of techRows) {
      (techByEnt[r.entreprise_id] = techByEnt[r.entreprise_id] || []).push({ id: r.id, nom: r.nom, categorie: r.categorie, weight: r.weight });
    }

    const page_rows = pageSlice.map((c) => ({
      ...c,
      tags: parseJsonSafe(c.tags, []),
      technologies: techByEnt[c.entreprise_id] || [],
    }));

    res.json({ total, page, pageSize, results: page_rows });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const contact = await dbGet(`
      SELECT c.*, ent.nom as entreprise_nom FROM contacts c JOIN entreprises ent ON ent.id = c.entreprise_id WHERE c.id = ?
    `, [req.params.id]);
    if (!contact) return res.status(404).json({ error: 'Contact introuvable' });
    await attachExtras(contact);
    contact.echanges = await dbAll(`SELECT * FROM echanges WHERE contact_id = ? ORDER BY (date_echange IS NULL) ASC, COALESCE(date_echange, created_at::text) DESC`, [contact.id]);
    contact.besoins = await dbAll(`SELECT * FROM besoins WHERE contact_id = ? ORDER BY created_at DESC`, [contact.id]);
    res.json(contact);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.entreprise_id) return res.status(400).json({ error: 'entreprise_id est requis' });
    if (!b.nom && !b.prenom) return res.status(400).json({ error: 'Nom ou prénom requis' });

    const email = (b.email || '').trim().toLowerCase();
    const row = await dbGet(`
      INSERT INTO contacts (
        entreprise_id, nom, prenom, fonction, email, email_normalise, telephone_mobile, telephone_fixe,
        localisation, source, statut, responsable, notes, tags, incomplete, created_at, updated_at
      ) VALUES (
        @entreprise_id, @nom, @prenom, @fonction, @email, @email_normalise, @telephone_mobile, @telephone_fixe,
        @localisation, @source, @statut, @responsable, @notes, @tags, @incomplete, now(), now()
      ) RETURNING id
    `, {
      entreprise_id: b.entreprise_id,
      nom: b.nom || '', prenom: b.prenom || '', fonction: b.fonction || '',
      email: b.email || '', email_normalise: email,
      telephone_mobile: b.telephone_mobile || '', telephone_fixe: b.telephone_fixe || '',
      localisation: b.localisation || '', source: b.source || 'Saisie manuelle',
      statut: b.statut || 'prospect_a_contacter', responsable: b.responsable || '',
      notes: b.notes || '', tags: JSON.stringify(toTagsArray(b.tags)),
      incomplete: (!email && !b.telephone_mobile && !b.telephone_fixe),
    });
    const created = await dbGet('SELECT * FROM contacts WHERE id = ?', [row.id]);
    res.status(201).json(await attachExtras(created));
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await dbGet('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Contact introuvable' });
    const b = req.body;
    const email = b.email !== undefined ? String(b.email).trim().toLowerCase() : existing.email_normalise;
    await dbRun(`
      UPDATE contacts SET
        nom = @nom, prenom = @prenom, fonction = @fonction, email = @email, email_normalise = @email_normalise,
        telephone_mobile = @telephone_mobile, telephone_fixe = @telephone_fixe, localisation = @localisation,
        source = @source, statut = @statut, responsable = @responsable, notes = @notes, tags = @tags,
        updated_at = now()
      WHERE id = @id
    `, {
      id: req.params.id,
      nom: b.nom ?? existing.nom, prenom: b.prenom ?? existing.prenom, fonction: b.fonction ?? existing.fonction,
      email: b.email ?? existing.email, email_normalise: email,
      telephone_mobile: b.telephone_mobile ?? existing.telephone_mobile, telephone_fixe: b.telephone_fixe ?? existing.telephone_fixe,
      localisation: b.localisation ?? existing.localisation, source: b.source ?? existing.source,
      statut: b.statut ?? existing.statut, responsable: b.responsable ?? existing.responsable,
      notes: b.notes ?? existing.notes, tags: JSON.stringify(toTagsArray(b.tags ?? parseJsonSafe(existing.tags, []))),
    });
    res.json(await attachExtras(await dbGet('SELECT * FROM contacts WHERE id = ?', [req.params.id])));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await dbGet('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Contact introuvable' });
    if (req.query.hard === 'true') {
      await dbRun('DELETE FROM contacts WHERE id = ?', [req.params.id]);
      return res.json({ deleted: true });
    }
    await dbRun(`UPDATE contacts SET archived = true, statut = 'archive', updated_at = now() WHERE id = ?`, [req.params.id]);
    res.json({ archived: true });
  } catch (err) { next(err); }
});

router.post('/:id/restore', async (req, res, next) => {
  try {
    await dbRun(`UPDATE contacts SET archived = false, updated_at = now() WHERE id = ?`, [req.params.id]);
    res.json(await attachExtras(await dbGet('SELECT * FROM contacts WHERE id = ?', [req.params.id])));
  } catch (err) { next(err); }
});

module.exports = router;
