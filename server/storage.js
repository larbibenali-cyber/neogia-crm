// Stockage des CV (PDF) — Supabase Storage, bucket privé "cvs".
// Aucun fichier n'est jamais rendu public : chaque lecture/écriture passe par
// la clé service_role côté serveur, elle-même protégée par le middleware
// d'authentification sur toutes les routes /api/*.
const crypto = require('crypto');
const { supabaseAdmin } = require('./middleware/auth');

const BUCKET = 'cvs';

async function uploadCv(candidatId, buffer, mime) {
  const objectPath = `${candidatId}/${Date.now()}-${crypto.randomUUID()}.pdf`;
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(objectPath, buffer, {
    contentType: mime || 'application/pdf',
    upsert: false,
  });
  if (error) throw new Error(`Échec de l'envoi du CV vers le stockage : ${error.message}`);
  return objectPath;
}

async function downloadCv(objectPath) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(objectPath);
  if (error) throw new Error(`Échec de la lecture du CV : ${error.message}`);
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function deleteCv(objectPath) {
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([objectPath]);
  if (error) throw new Error(`Échec de la suppression du CV : ${error.message}`);
}

// Logos d'entreprise — Supabase Storage, bucket public "logos" (contrairement aux CV,
// un logo n'est pas une donnée sensible et doit s'afficher directement dans l'UI).
const LOGO_BUCKET = 'logos';

async function uploadLogo(entrepriseId, buffer, mime) {
  const ext = (mime || '').includes('svg') ? 'svg' : (mime || '').includes('png') ? 'png' : (mime || '').includes('webp') ? 'webp' : 'jpg';
  const objectPath = `${entrepriseId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseAdmin.storage.from(LOGO_BUCKET).upload(objectPath, buffer, {
    contentType: mime || 'image/png',
    upsert: false,
  });
  if (error) throw new Error(`Échec de l'envoi du logo vers le stockage : ${error.message}`);
  const { data } = supabaseAdmin.storage.from(LOGO_BUCKET).getPublicUrl(objectPath);
  return { objectPath, publicUrl: data.publicUrl };
}

async function deleteLogo(objectPath) {
  if (!objectPath) return;
  const { error } = await supabaseAdmin.storage.from(LOGO_BUCKET).remove([objectPath]);
  if (error) throw new Error(`Échec de la suppression du logo : ${error.message}`);
}

module.exports = { uploadCv, downloadCv, deleteCv, uploadLogo, deleteLogo };
