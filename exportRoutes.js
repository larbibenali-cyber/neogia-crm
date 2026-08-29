const express = require('express');
const { stringify } = require('csv-stringify/sync');
const ExcelJS = require('exceljs');
const { dbAll } = require('../../db/pg');

const router = express.Router();

const QUERIES = {
  entreprises: () => dbAll(`SELECT id, nom, secteur, adresse, site_web, created_at, updated_at FROM entreprises WHERE archived = false`),
  contacts: () => dbAll(`
    SELECT c.id, ent.nom as entreprise, c.nom, c.prenom, c.fonction, c.email, c.telephone_mobile, c.telephone_fixe,
      c.statut, c.responsable, c.dernier_echange_at, c.created_at
    FROM contacts c JOIN entreprises ent ON ent.id = c.entreprise_id WHERE c.archived = false
  `),
  candidats: () => dbAll(`
    SELECT id, nom, prenom, email, telephone, metier, annees_experience, localisation, disponibilite, tjm, statut, created_at
    FROM candidats WHERE archived = false
  `),
  besoins: () => dbAll(`
    SELECT b.id, b.reference, b.titre, e.nom as entreprise, b.statut, b.priorite, b.date_demarrage, b.tjm_client, b.tjm_candidat,
      b.marge_estimee, b.created_at
    FROM besoins b JOIN entreprises e ON e.id = b.entreprise_id WHERE b.archived = false
  `),
};

router.get('/:entity.:format', async (req, res, next) => {
  try {
    const { entity, format } = req.params;
    const queryFn = QUERIES[entity];
    if (!queryFn) return res.status(404).json({ error: 'Entité inconnue' });
    const rows = await queryFn();

    if (format === 'csv') {
      const csv = stringify(rows, { header: true });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${entity}.csv"`);
      return res.send('﻿' + csv);
    }
    if (format === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(entity);
      if (rows.length) {
        ws.columns = Object.keys(rows[0]).map((k) => ({ header: k, key: k, width: 22 }));
        ws.addRows(rows);
        ws.getRow(1).font = { bold: true };
      }
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${entity}.xlsx"`);
      await wb.xlsx.write(res);
      return res.end();
    }
    res.status(400).json({ error: 'Format non supporté (csv ou xlsx)' });
  } catch (err) { next(err); }
});

module.exports = router;
