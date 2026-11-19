const express = require('express');
const { dbAll } = require('../../db/pg');

const router = express.Router();

// DÃ©coupe la requÃªte tapÃ©e en mots ("Guillaume Tran" -> ["Guillaume", "Tran"]).
// Permet de chercher chaque mot indÃ©pendamment plutÃ´t que la phrase entiÃ¨re
// d'un seul bloc : avant, rechercher "Guillaume Tran" ne trouvait RIEN car
// aucun champ en base ne contient la chaÃ®ne exacte "guillaume tran" (le nom
// est "TRAN" et le prÃ©nom "Guillaume", dans des colonnes sÃ©parÃ©es). On limite
// Ã  6 mots par sÃ©curitÃ© (une recherche ne devrait jamais en avoir plus).
function tokenize(q) {
  return q.trim().split(/\s+/).filter(Boolean).slice(0, 6);
}

// Construit "(haystack ILIKE @prefixe0) AND (haystack ILIKE @prefixe1) AND ..."
// c'est-Ã -dire : CHAQUE mot tapÃ© doit se retrouver quelque part dans le texte
// combinÃ© (ex: "prÃ©nom nom"), quel que soit l'ORDRE dans lequel ils ont Ã©tÃ©
// tapÃ©s â "Guillaume Tran" et "Tran Guillaume" trouvent tous les deux le mÃªme
// contact. Les valeurs sont toujours passÃ©es en paramÃ¨tres (jamais concatÃ©nÃ©es
// dans le SQL), donc pas de risque d'injection.
function tokenAndClause(tokens, haystackExpr, paramsOut, prefix) {
  if (!tokens.length) return '1=0';
  return tokens
    .map((tok, i) => {
      const key = `${prefix}${i}`;
      paramsOut[key] = `%${tok}%`;
      return `${haystackExpr} ILIKE @${key}`;
    })
    .join(' AND ');
}

// Construit un score de similaritÃ© "floue" tolÃ©rant aux fautes de frappe, via
// l'extension Postgres pg_trgm (similaritÃ© par trigrammes). On prend le PIRE
// score parmi tous les mots tapÃ©s (LEAST), pas le meilleur : Ã§a Ã©vite qu'un
// seul mot bien orthographiÃ© fasse remonter un rÃ©sultat sans rapport avec les
// autres mots tapÃ©s. Un score > ~0.25-0.3 correspond en pratique Ã  une petite
// faute de frappe (1-2 lettres), pas Ã  un mot totalement diffÃ©rent.
function fuzzyScoreExpr(tokens, haystackExpr, paramsOut, prefix) {
  if (!tokens.length) return '0';
  const parts = tokens.map((tok, i) => {
    const key = `${prefix}${i}`;
    paramsOut[key] = tok;
    return `word_similarity(@${key}, ${haystackExpr})`;
  });
  return parts.length > 1 ? `LEAST(${parts.join(', ')})` : parts[0];
}

const FUZZY_THRESHOLD = 0.25;

router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) return res.json({ entreprises: [], contacts: [], candidats: [], besoins: [], technologies: [], echanges: [] });
    const like = `%${q}%`;
    const tokens = tokenize(q);
    // Pour la recherche par numÃ©ro de tÃ©lÃ©phone : on compare les numÃ©ros en ne
    // gardant que les chiffres (cÃ´tÃ© base ET cÃ´tÃ© saisie), afin qu'une recherche
    // "0624479765" retrouve un numÃ©ro stockÃ© "+33 6 24 47 97 65" ou "06 24 47 97 65"
    // peu importe les espaces, tirets ou le prÃ©fixe international utilisÃ©s.
    const qDigits = q.replace(/\D/g, '');

    // Une entreprise correspond par son nom (mots dans n'importe quel ordre,
    // + tolÃ©rance aux fautes de frappe) ou parce que son environnement
    // technique (entreprise_technologies) contient une techno dont le nom
    // matche â c'est ce qui permet Ã  une recherche "Databricks" ou "Power BI"
    // de remonter les entreprises/contacts/besoins concernÃ©s.
    const entParams = { l: like };
    const entTokenClause = tokenAndClause(tokens, 'e.nom', entParams, 'ent');
    const entFuzzy = fuzzyScoreExpr(tokens, 'e.nom', entParams, 'entfz');
    const entreprises = await dbAll(`
      SELECT DISTINCT e.id, e.nom,
        (${entTokenClause}) AS is_exact,
        ${entFuzzy} AS fz_score
      FROM entreprises e
      WHERE e.archived = false AND (
        (${entTokenClause})
        OR EXISTS (
          SELECT 1 FROM entreprise_technologies et JOIN technologies t ON t.id = et.technology_id
          WHERE et.entreprise_id = e.id AND t.nom ILIKE @l
        )
        OR ${entFuzzy} > ${FUZZY_THRESHOLD}
      )
      ORDER BY is_exact DESC, fz_score DESC
      LIMIT 8
    `, entParams);

    // Contacts : le nom complet est recherchÃ© comme "prÃ©nom nom" combinÃ©, pour
    // que l'ordre des mots tapÃ©s n'ait pas d'importance. L'email et le tÃ©lÃ©phone
    // restent cherchÃ©s sÃ©parÃ©ment (ce sont des identifiants, pas des "mots" Ã 
    // rÃ©ordonner) pour Ã©viter les faux positifs â ex: un email contenant le nom
    // de l'entreprise ("...@mediatransports.fr") ne doit pas matcher "Tran".
    const contactParams = { l: like, qdigits: qDigits };
    const contactHaystack = `(coalesce(c.prenom,'') || ' ' || coalesce(c.nom,''))`;
    const contactTokenClause = tokenAndClause(tokens, contactHaystack, contactParams, 'cn');
    const contactFuzzy = fuzzyScoreExpr(tokens, contactHaystack, contactParams, 'cnfz');
    const contacts = await dbAll(`
      SELECT DISTINCT c.id, c.nom, c.prenom, c.email, e.nom as entreprise_nom,
        (${contactTokenClause}) AS is_exact,
        ${contactFuzzy} AS fz_score
      FROM contacts c
      JOIN entreprises e ON e.id = c.entreprise_id
      WHERE c.archived = false AND (
        (${contactTokenClause})
        OR c.email ILIKE @l OR c.telephone_mobile ILIKE @l OR c.telephone_fixe ILIKE @l
        OR (@qdigits != '' AND regexp_replace(coalesce(c.telephone_mobile, ''), '[^0-9]', '', 'g') LIKE '%' || @qdigits || '%')
        OR (@qdigits != '' AND regexp_replace(coalesce(c.telephone_fixe, ''), '[^0-9]', '', 'g') LIKE '%' || @qdigits || '%')
        OR EXISTS (
          SELECT 1 FROM entreprise_technologies et JOIN technologies t ON t.id = et.technology_id
          WHERE et.entreprise_id = c.entreprise_id AND t.nom ILIKE @l
        )
        OR ${contactFuzzy} > ${FUZZY_THRESHOLD}
      )
      ORDER BY is_exact DESC, fz_score DESC
      LIMIT 8
    `, contactParams);

    const candidatParams = { l: like, qdigits: qDigits };
    const candidatHaystack = `(coalesce(c.prenom,'') || ' ' || coalesce(c.nom,''))`;
    const candidatTokenClause = tokenAndClause(tokens, candidatHaystack, candidatParams, 'ca');
    const candidatFuzzy = fuzzyScoreExpr(tokens, candidatHaystack, candidatParams, 'cafz');
    const candidats = await dbAll(`
      SELECT DISTINCT c.id, c.nom, c.prenom, c.email, c.metier,
        (${candidatTokenClause}) AS is_exact,
        ${candidatFuzzy} AS fz_score
      FROM candidats c
      WHERE c.archived = false AND (
        (${candidatTokenClause})
        OR c.email ILIKE @l OR c.competences_principales ILIKE @l OR c.metier ILIKE @l
        OR (@qdigits != '' AND regexp_replace(coalesce(c.telephone, ''), '[^0-9]', '', 'g') LIKE '%' || @qdigits || '%')
        OR EXISTS (
          SELECT 1 FROM candidat_technologies ct JOIN technologies t ON t.id = ct.technology_id
          WHERE ct.candidat_id = c.id AND t.nom ILIKE @l
        )
        OR ${candidatFuzzy} > ${FUZZY_THRESHOLD}
      )
      ORDER BY is_exact DESC, fz_score DESC
      LIMIT 8
    `, candidatParams);

    // Besoins : le titre est recherchÃ© avec la mÃªme tolÃ©rance aux mots
    // dans le dÃ©sordre et aux fautes de frappe ; rÃ©fÃ©rence/description/
    // compÃ©tences restent en recherche "classique" (chaÃ®ne complÃ¨te).
    const besoinParams = { l: like };
    const besoinTokenClause = tokenAndClause(tokens, 'b.titre', besoinParams, 'bt');
    const besoinFuzzy = fuzzyScoreExpr(tokens, 'b.titre', besoinParams, 'btfz');
    const besoins = await dbAll(`
      SELECT DISTINCT b.id, b.titre, b.reference, e.nom as entreprise_nom,
        (${besoinTokenClause}) AS is_exact,
        ${besoinFuzzy} AS fz_score
      FROM besoins b JOIN entreprises e ON e.id = b.entreprise_id
      WHERE b.archived = false AND (
        (${besoinTokenClause})
        OR b.reference ILIKE @l OR b.description_contexte ILIKE @l
        OR b.competences_obligatoires ILIKE @l OR b.competences_appreciees ILIKE @l
        OR EXISTS (
          SELECT 1 FROM besoin_technologies bt JOIN technologies t ON t.id = bt.technology_id
          WHERE bt.besoin_id = b.id AND t.nom ILIKE @l
        )
        OR ${besoinFuzzy} > ${FUZZY_THRESHOLD}
      )
      ORDER BY is_exact DESC, fz_score DESC
      LIMIT 8
    `, besoinParams);

    const technologies = await dbAll(`SELECT id, nom, categorie FROM technologies WHERE nom ILIKE ? LIMIT 8`, [like]);

    // Ãchanges : les mots tapÃ©s doivent tous se retrouver dans l'objet ou le
    // compte-rendu, dans n'importe quel ordre (ex: chercher "Guillaume Tran"
    // retrouve aussi les Ã©changes oÃ¹ ce nom est mentionnÃ© dans les notes).
    const echangeParams = {};
    const echangeHaystack = `(coalesce(ech.objet,'') || ' ' || coalesce(ech.compte_rendu,''))`;
    const echangeTokenClause = tokenAndClause(tokens, echangeHaystack, echangeParams, 'ec');
    const echanges = await dbAll(`
      SELECT ech.id, ech.objet, ech.compte_rendu, c.nom as contact_nom, c.prenom as contact_prenom, e.nom as entreprise_nom, c.id as contact_id
      FROM echanges ech JOIN contacts c ON c.id = ech.contact_id JOIN entreprises e ON e.id = ech.entreprise_id
      WHERE (${echangeTokenClause})
      LIMIT 8
    `, echangeParams);

    res.json({ entreprises, contacts, candidats, besoins, technologies, echanges });
  } catch (err) { next(err); }
});

module.exports = router;
