const express = require('express');
const { dbAll } = require('../../db/pg');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) return res.json({ entreprises: [], contacts: [], candidats: [], besoins: [], technologies: [], echanges: [] });
    const like = `%${q}%`;

    // Une entreprise correspond soit par son nom, soit parce que son environnement
    // technique (entreprise_technologies) contient une techno dont le nom matche —
    // c'est ce qui permet à une recherche "Databricks" ou "Power BI" de remonter
    // les entreprises/contacts/besoins concernés, pas seulement la fiche technologie.
    const entreprises = await dbAll(`
      SELECT DISTINCT e.id, e.nom FROM entreprises e
      WHERE e.archived = false AND (
        e.nom ILIKE @l
        OR EXISTS (
          SELECT 1 FROM entreprise_technologies et JOIN technologies t ON t.id = et.technology_id
          WHERE et.entreprise_id = e.id AND t.nom ILIKE @l
        )
      ) LIMIT 8
    `, { l: like });

    const contacts = await dbAll(`
      SELECT DISTINCT c.id, c.nom, c.prenom, c.email, e.nom as entreprise_nom FROM contacts c
      JOIN entreprises e ON e.id = c.entreprise_id
      WHERE c.archived = false AND (
        c.nom ILIKE @l OR c.prenom ILIKE @l OR c.email ILIKE @l OR c.telephone_mobile ILIKE @l OR c.telephone_fixe ILIKE @l
        OR EXISTS (
          SELECT 1 FROM entreprise_technologies et JOIN technologies t ON t.id = et.technology_id
          WHERE et.entreprise_id = c.entreprise_id AND t.nom ILIKE @l
        )
      ) LIMIT 8
    `, { l: like });

    const candidats = await dbAll(`
      SELECT DISTINCT c.id, c.nom, c.prenom, c.email, c.metier FROM candidats c
      WHERE c.archived = false AND (
        c.nom ILIKE @l OR c.prenom ILIKE @l OR c.email ILIKE @l OR c.competences_principales ILIKE @l OR c.metier ILIKE @l
        OR EXISTS (
          SELECT 1 FROM candidat_technologies ct JOIN technologies t ON t.id = ct.technology_id
          WHERE ct.candidat_id = c.id AND t.nom ILIKE @l
        )
      ) LIMIT 8
    `, { l: like });

    const besoins = await dbAll(`
      SELECT DISTINCT b.id, b.titre, b.reference, e.nom as entreprise_nom FROM besoins b JOIN entreprises e ON e.id = b.entreprise_id
      WHERE b.archived = false AND (
        b.titre ILIKE @l OR b.reference ILIKE @l OR b.description_contexte ILIKE @l
        OR b.competences_obligatoires ILIKE @l OR b.competences_appreciees ILIKE @l
        OR EXISTS (
          SELECT 1 FROM besoin_technologies bt JOIN technologies t ON t.id = bt.technology_id
          WHERE bt.besoin_id = b.id AND t.nom ILIKE @l
        )
      ) LIMIT 8
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
