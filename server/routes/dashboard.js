const express = require('express');
const { dbGet, dbAll } = require('../../db/pg');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const totalEntreprises = (await dbGet('SELECT COUNT(*) c FROM entreprises WHERE archived = false')).c;
    const totalContacts = (await dbGet('SELECT COUNT(*) c FROM contacts WHERE archived = false')).c;
    const totalCandidats = (await dbGet('SELECT COUNT(*) c FROM candidats WHERE archived = false')).c;
    const besoinsOuverts = (await dbGet(`
      SELECT COUNT(*) c FROM besoins WHERE archived = false AND statut_synthese IN ('À venir', 'En cours')
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

    // Regroupement par statut normalisé (À venir / En cours / Perdu / Gagné / Clôturé) —
    // distinct du pick-list interne `statut`, aligné sur le statut réel importé des besoins.
    const besoinsParStatutRows = await dbAll(`
      SELECT statut_synthese AS groupe, COUNT(*)::int n FROM besoins WHERE archived = false GROUP BY statut_synthese
    `);
    const ordreGroupes = ['En cours', 'À venir', 'Gagné', 'Perdu', 'Clôturé'];
    const besoinsParStatut = ordreGroupes
      .map((g) => ({ groupe: g, n: besoinsParStatutRows.find((r) => r.groupe === g)?.n || 0 }))
      .filter((r) => r.n > 0);

    // "Besoins prioritaires" — un besoin apparaît une seule fois, classé sur le premier
    // critère qu'il remplit dans l'ordre : 1) en cours, 2) échéance proche (<=14j),
    // 3) sans candidat positionné, 4) en attente de retour client, 5) à venir.
    const besoinsPrioritaires = await dbAll(`
      WITH b AS (
        SELECT bb.id, bb.titre, bb.reference, bb.statut, bb.statut_synthese, bb.date_demarrage, bb.date_limite_reponse,
          bb.date_identification, bb.priorite, e.id AS entreprise_id, e.nom AS entreprise_nom,
          (SELECT COUNT(*)::int FROM positionnements p WHERE p.besoin_id = bb.id) AS nb_candidats,
          EXISTS (
            SELECT 1 FROM positionnements p WHERE p.besoin_id = bb.id
              AND p.statut IN ('presente_au_client', 'en_attente_retour', 'entretien_planifie', 'entretien_realise')
          ) AS attente_retour
        FROM besoins bb JOIN entreprises e ON e.id = bb.entreprise_id
        WHERE bb.archived = false AND bb.statut_synthese IN ('À venir', 'En cours')
      )
      SELECT *,
        CASE
          WHEN statut_synthese = 'En cours' THEN 1
          WHEN (date_demarrage IS NOT NULL AND date_demarrage BETWEEN @today AND @in14)
            OR (date_limite_reponse IS NOT NULL AND date_limite_reponse BETWEEN @today AND @in14) THEN 2
          WHEN nb_candidats = 0 THEN 3
          WHEN attente_retour THEN 4
          ELSE 5
        END AS priorite_rang,
        CASE
          WHEN statut_synthese = 'En cours' THEN 'Besoin en cours'
          WHEN (date_demarrage IS NOT NULL AND date_demarrage BETWEEN @today AND @in14)
            OR (date_limite_reponse IS NOT NULL AND date_limite_reponse BETWEEN @today AND @in14) THEN 'Échéance proche'
          WHEN nb_candidats = 0 THEN 'Sans candidat positionné'
          WHEN attente_retour THEN 'En attente de retour client'
          ELSE 'Besoin à venir'
        END AS priorite_motif,
        COALESCE(date_demarrage, date_limite_reponse, date_identification) AS date_cle
      FROM b
      ORDER BY priorite_rang ASC, date_cle ASC NULLS LAST
      LIMIT 10
    `, { today, in14 });

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
      WHERE b.archived = false AND b.statut_synthese IN ('À venir', 'En cours')
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
      besoins_prioritaires: besoinsPrioritaires,
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
