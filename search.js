const express = require('express');
const { dbAll } = require('../../db/pg');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) return res.json({ entreprises: [], contacts: [], candidats: [], besoins: [], technologies: [], echanges: [] });
    const like = `%${q}%`;

    const entreprises = await dbAll(`SELECT id, nom FROM entreprises WHERE nom ILIKE ? AND archived = false LIMIT 8`, [like]);

    const contacts = await dbAll(`
      SELECT c.id, c.nom, c.prenom, c.email, e.nom as entreprise_nom FROM contacts c
      JOIN entreprises e ON e.id = c.entreprise_id
      WHERE (c.nom ILIKE @l OR c.prenom ILIKE @l OR c.email ILIKE @l OR c.telephone_mobile ILIKE @l OR c.telephone_fixe ILIKE @l)
        AND c.archived = false LIMIT 8
    `, { l: like });

    const candidats = await dbAll(`
      SELECT id, nom, prenom, email, metier FROM candidats
      WHERE (nom ILIKE @l OR prenom ILIKE @l OR email ILIKE @l OR competences_principales ILIKE @l OR metier ILIKE @l)
        AND archived = false LIMIT 8
    `, { l: like });

    const besoins = await dbAll(`
      SELECT b.id, b.titre, b.reference, e.nom as entreprise_nom FROM besoins b JOIN entreprises e ON e.id = b.entreprise_id
      WHERE (b.titre ILIKE @l OR b.reference ILIKE @l OR b.description_contexte ILIKE @l) AND b.archived = false LIMIT 8
    `, { l: like });

    const technologies = await dbAll(`SELECT id, nom, categorie FROM technologies WHERE nom ILIKE ? LIMIT 8`, [like]);

    const echanges = await dbAll(`
      SELECT ech.id, ech.objet, ech.compte_rendu, c.nom as contact_nom, c.prenom as contact_prenom, e.nom as entreprise_nom, c.id as contact_id
      FROM echanges ech JOIN contacts c ON c.id = ech.contact_id JOIN entreprises e ON e.id = ech.entreprise_id
      WHERE ech.objet ILIKE @l OR ech.compte_rendu ILIKE @l LIMIT 8
    `, { l: like });

    res.json({ entreprises, contacts, candidats, besoins, technologies, echanges });
  } catch (err) { next(err); }
});

module.exports = router;
