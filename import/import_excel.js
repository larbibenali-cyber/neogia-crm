#!/usr/bin/env node
// Point d'entrée CLI : node import/import_excel.js [chemin_du_fichier.xlsx]
const { runImport } = require('./run_import');

const SOURCE_PATH = process.argv[2] || '/root/.claude/uploads/d41093b7-4649-5390-86d7-9c67db3012c8/cc3e1f19-CRM_1.xlsx';

runImport(SOURCE_PATH)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Échec de l\'import :', err.message);
    process.exit(1);
  });
