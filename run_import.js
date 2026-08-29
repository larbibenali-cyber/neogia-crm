/**
 * Import & nettoyage du fichier Excel CRM Neogia.
 * - Ne modifie jamais le fichier source (copié tel quel dans data/original_imports/)
 * - Idempotent : peut être relancé sans créer de doublons (upsert par entreprise/email)
 *
 * Exporte :
 *  - previewImport(bufferOrPath) : analyse sans écriture en base (aperçu + mapping de colonnes détecté)
 *  - runImport(bufferOrPath, options) : import réel (transaction Postgres)
 * Réutilisables depuis le script CLI (import_excel.js) et depuis l'API (server/routes/importRoutes.js).
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const XLSX = require('xlsx');
const { dbGet, dbAll, withTransaction } = require('../db/pg');
const {
  cleanStr, normalizeNom, normalizePrenom, normalizeEntreprise, normalizeKeyEntreprise,
  extractEmails, normalizePhone, splitHistoriqueEnEchanges, parseTechEnvironnement,
} = require('./clean_utils');

const REFERENCE_YEAR = new Date().getFullYear();

function readWorkbook(bufferOrPath) {
  if (Buffer.isBuffer(bufferOrPath)) return XLSX.read(bufferOrPath, { type: 'buffer', cellDates: false });
  if (!fs.existsSync(bufferOrPath)) throw new Error(`Fichier source introuvable : ${bufferOrPath}`);
  return XLSX.readFile(bufferOrPath, { cellDates: false });
}

function archiveOriginal(sourcePath) {
  const dir = path.join(__dirname, '..', 'data', 'original_imports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(dir, `${stamp}_${path.basename(sourcePath)}`);
  fs.copyFileSync(sourcePath, dest);
  return dest;
}

function findHeaderCol(headers, matchers) {
  for (let c = 0; c < headers.length; c++) {
    const h = cleanStr(headers[c]).toLowerCase();
    if (!h) continue;
    for (const m of matchers) {
      if (h === m) return c;
    }
  }
  // recherche floue (contient le mot clé)
  for (let c = 0; c < headers.length; c++) {
    const h = cleanStr(headers[c]).toLowerCase();
    if (!h) continue;
    for (const m of matchers) {
      if (h.includes(m)) return c;
    }
  }
  return -1;
}

const FIELD_LABELS = {
  col_nom: 'Nom',
  col_prenom: 'Prénom',
  col_email: 'Adresse e-mail',
  col_mobile: 'Numéro mobile',
  col_fixe: 'Numéro fixe',
  col_tech: 'Environnement technique',
};

function detectColumns(headers) {
  const lower = headers.map((h) => cleanStr(h).toLowerCase());
  const col_nom = findHeaderCol(headers, ['nom']);
  const col_prenom = findHeaderCol(headers, ['prénom', 'prenom']);
  const col_email = findHeaderCol(headers, ['adresse @', 'adresse', 'email', 'e-mail', 'mail']);
  const col_mobile = findHeaderCol(headers, ['numéro mobile', 'numero mobile', 'mobile']);
  const col_fixe = findHeaderCol(headers, ['numéro fixe', 'numero fixe', 'fixe']);
  const col_tech = findHeaderCol(headers, ['environnement tech', 'environnement technique']);
  // toutes les colonnes qui ressemblent à un historique/échange (il peut y en avoir 2)
  const hist_cols = [];
  lower.forEach((h, idx) => {
    if (!h) return;
    if (idx === col_tech) return;
    if (h.includes('histo') || h.includes('echange') || h.includes('échange')) hist_cols.push(idx);
  });
  return { col_nom, col_prenom, col_email, col_mobile, col_fixe, col_tech, hist_cols };
}

function hashSegment(contactKey, dateStr, text) {
  return crypto.createHash('md5').update(`${contactKey}|${dateStr || ''}|${(text || '').slice(0, 80)}`).digest('hex');
}

/**
 * Analyse le fichier SANS écrire en base : sert d'aperçu à l'assistant d'import
 * (détection des colonnes, échantillon de lignes, comptage par feuille) pour que
 * l'utilisateur confirme ou corrige le mapping colonnes -> champs avant de valider.
 */
function previewImport(bufferOrPath) {
  const wb = readWorkbook(bufferOrPath);
  const sheets = wb.SheetNames.map((sheetName) => {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    const headers = rows[0] || [];
    const cols = detectColumns(headers);
    const dataRows = rows.slice(1).filter((r) => r && r.some((v) => cleanStr(v) !== ''));
    const sample = dataRows.slice(0, 5).map((r) => ({
      nom: cols.col_nom >= 0 ? r[cols.col_nom] : '',
      prenom: cols.col_prenom >= 0 ? r[cols.col_prenom] : '',
      email: cols.col_email >= 0 ? r[cols.col_email] : '',
      mobile: cols.col_mobile >= 0 ? r[cols.col_mobile] : '',
      fixe: cols.col_fixe >= 0 ? r[cols.col_fixe] : '',
      environnement_tech: cols.col_tech >= 0 ? r[cols.col_tech] : '',
    }));
    return {
      sheet_name: sheetName,
      headers,
      row_count: dataRows.length,
      colonnes_detectees: Object.fromEntries(
        Object.entries(cols).filter(([k]) => k !== 'hist_cols').map(([k, idx]) => [k, { label: FIELD_LABELS[k], index: idx, header: idx >= 0 ? headers[idx] : null }])
      ),
      historique_colonnes: cols.hist_cols.map((idx) => headers[idx]),
      sample,
    };
  });
  const totalRows = sheets.reduce((sum, s) => sum + s.row_count, 0);
  // Mapping global proposé = celui détecté sur la première feuille non vide (le fichier a une feuille par entreprise, même structure de colonnes)
  const reference = sheets.find((s) => s.headers.length > 0) || sheets[0];
  return {
    nb_feuilles: wb.SheetNames.length,
    nb_lignes_estimees: totalRows,
    mapping_propose: reference ? reference.colonnes_detectees : {},
    feuilles: sheets,
  };
}

async function runImport(bufferOrPath, options = {}) {
  const isPath = typeof bufferOrPath === 'string';
  console.log(`\nImport du fichier : ${isPath ? bufferOrPath : '(fichier envoyé en mémoire)'}`);
  let archivedPath = null;
  if (isPath) {
    archivedPath = archiveOriginal(bufferOrPath);
    console.log(`Fichier original archivé sans modification : ${archivedPath}`);
  }

  const wb = readWorkbook(bufferOrPath);
  const columnOverrides = options.columnOverrides || null; // { col_nom, col_prenom, col_email, col_mobile, col_fixe, col_tech }

  const report = {
    date_import: new Date().toISOString(),
    lignes_analysees: 0,
    entreprises_creees: 0,
    entreprises_mises_a_jour: 0,
    contacts_crees: 0,
    contacts_mis_a_jour: 0,
    doublons_fusionnes: 0,
    doublons_signales: [],
    lignes_ignorees_incompletes: 0,
    technologies_distinctes: new Set(),
    technologies_normalisees: new Map(),
    technologies_non_reconnues: new Map(),
    valeurs_ignorees_prose: [],
    fiches_sans_environnement_tech: 0,
    echanges_crees: 0,
    anomalies: [],
  };

  const emailGlobalIndex = new Map();
  const touchedThisRun = new Set();

  await withTransaction(async (tx) => {
    async function getOrCreateTech(tokenResult) {
      let row = await tx.get(`SELECT * FROM technologies WHERE nom = ?`, [tokenResult.name]);
      if (!row) {
        const inserted = await tx.get(
          `INSERT INTO technologies (nom, categorie, custom, usage_count, created_at) VALUES (?, ?, ?, 1, now()) RETURNING id`,
          [tokenResult.name, tokenResult.category, !!tokenResult.custom]
        );
        row = { id: inserted.id, nom: tokenResult.name, categorie: tokenResult.category, custom: !!tokenResult.custom };
      } else {
        await tx.run(`UPDATE technologies SET usage_count = usage_count + 1 WHERE id = ?`, [row.id]);
      }
      return row;
    }

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
      if (rows.length === 0) continue;
      const headers = rows[0];
      const cols = columnOverrides
        ? { ...detectColumns(headers), ...columnOverrides }
        : detectColumns(headers);

      const entrepriseNomBrut = sheetName.trim();
      const nomAffiche = normalizeEntreprise(entrepriseNomBrut);
      const nomNorm = normalizeKeyEntreprise(entrepriseNomBrut);

      let entrepriseId;
      const existingEnt = await tx.get(`SELECT id FROM entreprises WHERE nom_normalise = ?`, [nomNorm]);
      if (existingEnt) {
        entrepriseId = existingEnt.id;
        await tx.run(`UPDATE entreprises SET updated_at = now() WHERE id = ?`, [entrepriseId]);
        report.entreprises_mises_a_jour++;
      } else {
        const inserted = await tx.get(
          `INSERT INTO entreprises (nom, nom_normalise, source_import, created_at, updated_at) VALUES (@nom, @nom_normalise, @source_import, now(), now()) RETURNING id`,
          { nom: nomAffiche, nom_normalise: nomNorm, source_import: entrepriseNomBrut }
        );
        entrepriseId = inserted.id;
        report.entreprises_creees++;
      }

      const entTechWeights = new Map();

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.every((v) => cleanStr(v) === '')) continue;

        const nomRaw = cols.col_nom >= 0 ? row[cols.col_nom] : '';
        const prenomRaw = cols.col_prenom >= 0 ? row[cols.col_prenom] : '';
        if (cleanStr(nomRaw) === '' && cleanStr(prenomRaw) === '') continue;

        report.lignes_analysees++;

        const nom = normalizeNom(nomRaw);
        const prenom = normalizePrenom(prenomRaw);

        const emailRaw = cols.col_email >= 0 ? row[cols.col_email] : '';
        const emails = extractEmails(emailRaw);
        const emailPrincipal = emails[0] || '';
        const autresEmails = emails.slice(1);

        const mobile = normalizePhone(cols.col_mobile >= 0 ? row[cols.col_mobile] : '');
        const fixe = normalizePhone(cols.col_fixe >= 0 ? row[cols.col_fixe] : '');

        const incomplete = (!emailPrincipal && !mobile && !fixe);
        if (incomplete) report.lignes_ignorees_incompletes++;

        let flagged = false, flaggedReason = null;
        if (emailPrincipal) {
          const prevKey = emailGlobalIndex.get(emailPrincipal);
          if (prevKey && prevKey.entreprise !== nomAffiche) {
            flagged = true;
            flaggedReason = `Adresse ${emailPrincipal} également présente chez ${prevKey.entreprise}`;
            report.doublons_signales.push({ email: emailPrincipal, entreprises: [prevKey.entreprise, nomAffiche] });
          } else {
            emailGlobalIndex.set(emailPrincipal, { entreprise: nomAffiche });
          }
        }

        const techRaw = cols.col_tech >= 0 ? row[cols.col_tech] : '';
        const { tokens, ignoredRaw } = parseTechEnvironnement(techRaw);
        ignoredRaw.forEach((v) => report.valeurs_ignorees_prose.push({ entreprise: nomAffiche, contact: `${prenom} ${nom}`, texte: v }));
        if (tokens.length === 0) report.fiches_sans_environnement_tech++;

        let notesExtra = [];
        if (autresEmails.length) notesExtra.push(`Autres adresses détectées : ${autresEmails.join(', ')}`);
        if (ignoredRaw.length) notesExtra.push(`Notes libres (environnement tech.) : ${ignoredRaw.join(' | ')}`);

        const emailNorm = emailPrincipal;
        let contactRow = null;
        if (emailNorm) contactRow = await tx.get(`SELECT * FROM contacts WHERE entreprise_id = ? AND email_normalise = ? AND email_normalise != ''`, [entrepriseId, emailNorm]);
        if (!contactRow && nom && prenom) contactRow = await tx.get(`SELECT * FROM contacts WHERE entreprise_id = ? AND nom = ? AND prenom = ?`, [entrepriseId, nom, prenom]);

        let contactId;
        if (contactRow) {
          await tx.run(`
            UPDATE contacts SET
              email = COALESCE(NULLIF(@email,''), email),
              email_normalise = CASE WHEN @email_normalise != '' THEN @email_normalise ELSE email_normalise END,
              telephone_mobile = CASE WHEN @telephone_mobile != '' THEN @telephone_mobile ELSE telephone_mobile END,
              telephone_fixe = CASE WHEN @telephone_fixe != '' THEN @telephone_fixe ELSE telephone_fixe END,
              environnement_tech_notes = CASE WHEN @environnement_tech_notes != '' THEN @environnement_tech_notes ELSE environnement_tech_notes END,
              incomplete = @incomplete,
              updated_at = now()
            WHERE id = @id
          `, {
            id: contactRow.id, email: emailPrincipal, email_normalise: emailNorm,
            telephone_mobile: mobile, telephone_fixe: fixe,
            environnement_tech_notes: cleanStr(techRaw), incomplete,
          });
          contactId = contactRow.id;
          if (touchedThisRun.has(contactRow.id)) {
            report.doublons_fusionnes++;
          } else {
            report.contacts_mis_a_jour++;
          }
        } else {
          const inserted = await tx.get(`
            INSERT INTO contacts (
              entreprise_id, nom, prenom, email, email_normalise, telephone_mobile, telephone_fixe,
              source, statut, environnement_tech_notes, incomplete, flagged_duplicate, flagged_reason,
              notes, created_at, updated_at
            ) VALUES (
              @entreprise_id, @nom, @prenom, @email, @email_normalise, @telephone_mobile, @telephone_fixe,
              @source, @statut, @environnement_tech_notes, @incomplete, @flagged_duplicate, @flagged_reason,
              @notes, now(), now()
            ) RETURNING id
          `, {
            entreprise_id: entrepriseId, nom, prenom, email: emailPrincipal, email_normalise: emailNorm,
            telephone_mobile: mobile, telephone_fixe: fixe, source: 'Import Excel', statut: 'prospect_a_contacter',
            environnement_tech_notes: cleanStr(techRaw), incomplete, flagged_duplicate: flagged, flagged_reason: flaggedReason,
            notes: notesExtra.join('\n'),
          });
          contactId = inserted.id;
          report.contacts_crees++;
        }
        touchedThisRun.add(contactId);

        for (const tok of tokens) {
          report.technologies_distinctes.add(tok.name);
          if (tok.custom) {
            report.technologies_non_reconnues.set(tok.name, (report.technologies_non_reconnues.get(tok.name) || 0) + 1);
          } else if (normalizeKeyEntreprise(tok.raw) !== normalizeKeyEntreprise(tok.name)) {
            report.technologies_normalisees.set(tok.raw, tok.name);
          }
          const techRow = await getOrCreateTech(tok);
          entTechWeights.set(techRow.id, (entTechWeights.get(techRow.id) || 0) + 1);
        }

        const histTexts = cols.hist_cols.map((c) => cleanStr(row[c])).filter(Boolean);
        const combinedHist = histTexts.join('\n');
        if (combinedHist) {
          const segments = splitHistoriqueEnEchanges(combinedHist, REFERENCE_YEAR);
          for (const seg of segments) {
            const dh = hashSegment(contactId, seg.date_echange, seg.compte_rendu);
            const result = await tx.run(`
              INSERT INTO echanges (
                contact_id, entreprise_id, date_echange, date_approximative, type, objet, compte_rendu,
                auteur, source_import, dedup_hash, created_at, updated_at
              ) VALUES (
                @contact_id, @entreprise_id, @date_echange, @date_approximative, 'autre', @objet, @compte_rendu,
                'Import Excel', true, @dedup_hash, now(), now()
              ) ON CONFLICT (contact_id, dedup_hash) DO NOTHING
            `, {
              contact_id: contactId, entreprise_id: entrepriseId, date_echange: seg.date_echange,
              date_approximative: !!seg.date_approximative, objet: seg.compte_rendu.slice(0, 80), compte_rendu: seg.compte_rendu, dedup_hash: dh,
            });
            if (result.rowCount) report.echanges_crees++;
          }
          const dates = segments.map((s) => s.date_echange).filter(Boolean).sort();
          if (dates.length) {
            await tx.run(`UPDATE contacts SET dernier_echange_at = ? WHERE id = ? AND (dernier_echange_at IS NULL OR dernier_echange_at < ?)`,
              [dates[dates.length - 1], contactId, dates[dates.length - 1]]);
          }
        }
      }

      // Recalcule le nuage technologique de l'entreprise (idempotent)
      await tx.run(`DELETE FROM entreprise_technologies WHERE entreprise_id = ?`, [entrepriseId]);
      for (const [techId, weight] of entTechWeights.entries()) {
        await tx.run(`
          INSERT INTO entreprise_technologies (entreprise_id, technology_id, weight) VALUES (?, ?, ?)
          ON CONFLICT (entreprise_id, technology_id) DO UPDATE SET weight = entreprise_technologies.weight + excluded.weight
        `, [entrepriseId, techId, weight]);
      }
    }
  });

  const summary = {
    ...report,
    technologies_distinctes: report.technologies_distinctes.size,
    technologies_normalisees: Object.fromEntries(report.technologies_normalisees),
    technologies_non_reconnues: Object.fromEntries(report.technologies_non_reconnues),
  };

  await dbGet(`INSERT INTO import_reports (filename, report_json) VALUES (?, ?) RETURNING id`,
    [isPath ? path.basename(bufferOrPath) : (options.originalName || 'import.xlsx'), JSON.stringify(summary)]);

  printReport(summary);
  return summary;
}

function printReport(s) {
  console.log('\n========== RAPPORT D\'IMPORT NEOGIA CRM ==========');
  console.log(`Lignes analysées                         : ${s.lignes_analysees}`);
  console.log(`Entreprises créées                       : ${s.entreprises_creees}`);
  console.log(`Entreprises déjà existantes (mises à jour): ${s.entreprises_mises_a_jour}`);
  console.log(`Contacts créés                            : ${s.contacts_crees}`);
  console.log(`Contacts mis à jour (déjà existants)      : ${s.contacts_mis_a_jour}`);
  console.log(`Doublons fusionnés automatiquement        : ${s.doublons_fusionnes}`);
  console.log(`Doublons potentiels signalés (non fusionnés): ${s.doublons_signales.length}`);
  console.log(`Lignes ignorées / incomplètes             : ${s.lignes_ignorees_incompletes}`);
  console.log(`Échanges importés                         : ${s.echanges_crees}`);
  console.log(`Technologies distinctes détectées         : ${s.technologies_distinctes}`);
  console.log(`Technologies normalisées automatiquement  : ${Object.keys(s.technologies_normalisees).length}`);
  console.log(`Valeurs techniques non reconnues (gardées) : ${Object.keys(s.technologies_non_reconnues).length}`);
  console.log(`Fiches sans environnement technique        : ${s.fiches_sans_environnement_tech}`);
  console.log(`Notes libres extraites (non taguées)       : ${s.valeurs_ignorees_prose.length}`);
  console.log('===================================================\n');
}

module.exports = { runImport, previewImport, detectColumns, FIELD_LABELS };
