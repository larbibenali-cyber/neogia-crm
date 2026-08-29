const express = require('express');
const { dbGet, dbAll } = require('../../db/pg');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const totalEntreprises = (await dbGet('SELECT COUNT(*) c FROM entreprises WHERE archived = false')).c;
    const totalContacts = (await dbGet('SELECT COUNT(*) c FROM contacts WHERE archived = false')).c;
    const totalCandidats = (await dbGet('SELECT COUNT(*) c FROM candidats WHERE archived = false')).c;
    const besoinsOuverts = (await dbGet(`
      SELECT COUNT(*) c FROM besoins WHERE archived = false AND statut NOT IN ('gagne','perdu','cloture')
    `)).c;

    const today = new Date().toISOString().slice(0, 10);
    const in14 = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const besoinsUrgents = await dbAll(`
      SELECT b.*, e.nom as entreprise_nom FROM besoins b JOIN entreprises e ON e.id = b.entreprise_id
      WHERE b.archived = false AND (b.priorite = 'urgente' OR (b.date_demarrage IS NOT NULL AND b.date_demarrage BETWEEN @today AND @in14))
      ORDER BY b.date_demarrage ASC LIMIT 8
    `, { today, in14 });

    const derniersEchanges = await dbAll(`
      SELECT ech.*, c.nom as contact_nom, c.prenom as contact_prenom, e.nom as entreprise_nom
      FROM echanges ech JOIN contacts c ON c.id = ech.contact_id JOIN entreprises e ON e.id = ech.entreprise_id
      ORDER BY (ech.date_echange IS NULL) ASC, COALESCE(ech.date_echange, ech.created_at::text) DESC LIMIT 8
    `);

    const dernieresFiches = await dbAll(`
      SELECT c.id, c.nom, c.prenom, c.created_at, e.nom as entreprise_nom FROM contacts c
      JOIN entreprises e ON e.id = c.entreprise_id ORDER BY c.created_at DESC LIMIT 8
    `);

    const besoinsParStatut = await dbAll(`
      SELECT statut, COUNT(*) n FROM besoins WHERE archived = false GROUP BY statut
    `);

    const candidatsPositionnesRecemment = await dbAll(`
      SELECT p.*, c.nom as candidat_nom, c.prenom as candidat_prenom, b.titre as besoin_titre, ent.nom as entreprise_nom
      FROM positionnements p JOIN candidats c ON c.id = p.candidat_id JOIN besoins b ON b.id = p.besoin_id JOIN entreprises ent ON ent.id = b.entreprise_id
      ORDER BY p.date_positionnement DESC LIMIT 8
    `);

    const relancesEnRetard = await dbAll(`
      SELECT ech.*, c.nom as contact_nom, c.prenom as contact_prenom, e.nom as entreprise_nom
      FROM echanges ech JOIN contacts c ON c.id = ech.contact_id JOIN entreprises e ON e.id = ech.entreprise_id
      WHERE ech.date_relance IS NOT NULL AND ech.date_relance <= @today
      ORDER BY ech.date_relance ASC LIMIT 10
    `, { today });

    const besoinsSansCandidat = await dbAll(`
      SELECT b.id, b.titre, b.reference, e.nom as entreprise_nom FROM besoins b
      JOIN entreprises e ON e.id = b.entreprise_id
      WHERE b.archived = false AND b.statut NOT IN ('gagne','perdu','cloture')
        AND NOT EXISTS (SELECT 1 FROM positionnements p WHERE p.besoin_id = b.id)
      LIMIT 10
    `);

    const candidatsProchainementDisponibles = await dbAll(`
      SELECT id, nom, prenom, disponibilite_date, metier FROM candidats
      WHERE archived = false AND statut = 'prochainement_disponible' ORDER BY disponibilite_date ASC LIMIT 10
    `);

    const fichesIncompletes = (await dbGet(`SELECT COUNT(*) c FROM contacts WHERE incomplete = true AND archived = false`)).c;

    res.json({
      totaux: { entreprises: totalEntreprises, contacts: totalContacts, candidats: totalCandidats, besoins_ouverts: besoinsOuverts },
      besoins_urgents: besoinsUrgents,
      derniers_echanges: derniersEchanges,
      dernieres_fiches: dernieresFiches,
      besoins_par_statut: besoinsParStatut,
      candidats_positionnes_recemment: candidatsPositionnesRecemment,
      alertes: {
        relances_en_retard: relancesEnRetard,
        besoins_sans_candidat: besoinsSansCandidat,
        candidats_prochainement_disponibles: candidatsProchainementDisponibles,
        fiches_incompletes: fichesIncompletes,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
