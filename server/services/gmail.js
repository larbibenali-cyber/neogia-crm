// Service Gmail — connexion OAuth 2.0, chiffrement des tokens, envoi de
// messages / création de brouillons. C'est le SEUL module qui manipule les
// tokens Google en clair (toujours en mémoire, jamais renvoyés au frontend).
//
// Stockage : une seule ligne dans gmail_connections (compte admin unique).
// Le refresh_token (et le dernier access_token connu) sont chiffrés en
// AES-256-GCM avec TOKEN_ENCRYPTION_KEY (variable d'environnement Railway,
// 64 caractères hexadécimaux = 32 octets) avant d'être écrits en base.
const crypto = require('crypto');
const { google } = require('googleapis');
const { dbGet, dbRun } = require('../../db/pg');

// Scope unique et le plus restreint possible : gmail.compose couvre à la
// fois la création de brouillons et l'envoi (pas besoin d'un scope plus
// large comme gmail.modify ou mail.google.com).
const SCOPES = ['https://www.googleapis.com/auth/gmail.compose'];

function getEncryptionKey() {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("Configuration serveur incomplète : TOKEN_ENCRYPTION_KEY est absente ou invalide.");
  }
  return Buffer.from(hex, 'hex');
}

function encrypt(text) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(payload) {
  const key = getEncryptionKey();
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

function getOAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    const err = new Error("La connexion Gmail n'est pas encore configurée côté serveur (variables GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI manquantes).");
    err.status = 503;
    throw err;
  }
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

function getAuthUrl(state) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    // "consent" force Google à renvoyer un refresh_token même si l'utilisateur
    // avait déjà autorisé l'app auparavant (sinon, en reconnexion, Google ne
    // renvoie parfois qu'un access_token, ce qui casserait la reconnexion).
    prompt: 'consent',
    scope: SCOPES,
    state,
  });
}

async function handleOAuthCallback(code) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("Google n'a pas renvoyé de jeton de rafraîchissement. Déconnectez puis reconnectez le compte pour que l'écran d'autorisation Google s'affiche à nouveau.");
  }
  client.setCredentials(tokens);
  const gmail = google.gmail({ version: 'v1', auth: client });
  const profile = await gmail.users.getProfile({ userId: 'me' });
  const email = profile.data.emailAddress;

  const refresh_token_encrypted = encrypt(tokens.refresh_token);
  const access_token_encrypted = tokens.access_token ? encrypt(tokens.access_token) : null;
  const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;

  // Compte unique (admin) : toute connexion précédente est remplacée.
  await dbRun('DELETE FROM gmail_connections');
  await dbRun(`
    INSERT INTO gmail_connections (email, refresh_token_encrypted, access_token_encrypted, access_token_expires_at, scope, connected_at, updated_at)
    VALUES (@email, @rt, @at, @exp, @scope, now(), now())
  `, { email, rt: refresh_token_encrypted, at: access_token_encrypted, exp: expiresAt, scope: SCOPES.join(' ') });

  return { email };
}

async function getConnection() {
  return dbGet('SELECT id, email, connected_at, updated_at FROM gmail_connections ORDER BY id DESC LIMIT 1');
}

async function disconnect() {
  const row = await dbGet('SELECT * FROM gmail_connections ORDER BY id DESC LIMIT 1');
  if (row) {
    // Révocation propre côté Google, en plus de la suppression locale — best
    // effort : si Google refuse (jeton déjà expiré...), on supprime quand
    // même la connexion locale pour ne jamais laisser l'app dans un état
    // "connecté" alors qu'elle ne l'est plus vraiment.
    try {
      const client = getOAuthClient();
      client.setCredentials({ refresh_token: decrypt(row.refresh_token_encrypted) });
      await client.revokeCredentials();
    } catch (err) {
      console.error('Révocation Google non aboutie (compte déconnecté localement quand même) :', err.message);
    }
  }
  await dbRun('DELETE FROM gmail_connections');
}

// Client OAuth2 authentifié + adresse connectée, prêt pour un appel Gmail API.
// Le token d'accès est renouvelé automatiquement par googleapis lorsqu'il a
// expiré ; l'écouteur 'tokens' ci-dessous répercute alors le nouveau token
// (chiffré) en base pour les appels suivants.
async function getAuthenticatedClient() {
  const row = await dbGet('SELECT * FROM gmail_connections ORDER BY id DESC LIMIT 1');
  if (!row) {
    const err = new Error('Aucun compte Gmail connecté.');
    err.status = 409;
    throw err;
  }
  const client = getOAuthClient();
  client.setCredentials({
    refresh_token: decrypt(row.refresh_token_encrypted),
    access_token: row.access_token_encrypted ? decrypt(row.access_token_encrypted) : undefined,
    expiry_date: row.access_token_expires_at ? new Date(row.access_token_expires_at).getTime() : undefined,
  });
  client.on('tokens', (tokens) => {
    if (!tokens.access_token) return;
    dbRun(`
      UPDATE gmail_connections SET access_token_encrypted = @at, access_token_expires_at = @exp, updated_at = now() WHERE id = @id
    `, {
      at: encrypt(tokens.access_token),
      exp: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      id: row.id,
    }).catch((e) => console.error('Erreur mise à jour token Gmail :', e.message));
  });
  return { client, email: row.email };
}

function toBase64Url(str) {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Découpe un base64 en lignes de 76 caractères (recommandation RFC 2045
// pour Content-Transfer-Encoding: base64).
function wrapBase64(b64) {
  return b64.replace(/(.{76})/g, '$1\r\n');
}

// Construit un message RFC 2822 encodé en base64url, tel qu'attendu par
// l'API Gmail (users.messages.send). Avec pièce jointe, le message devient
// multipart/mixed (corps texte + pièce jointe encodée en base64).
function buildRawMessage({ from, to, subject, body, attachment }) {
  const subjectEncoded = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;

  if (!attachment) {
    const lines = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subjectEncoded}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      body,
    ];
    return toBase64Url(lines.join('\r\n'));
  }

  const boundary = `neogia_${crypto.randomBytes(12).toString('hex')}`;
  const safeFilename = attachment.filename.replace(/"/g, "'");
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subjectEncoded}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
    '',
    `--${boundary}`,
    `Content-Type: ${attachment.mimeType || 'application/octet-stream'}; name="${safeFilename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${safeFilename}"`,
    '',
    wrapBase64(attachment.buffer.toString('base64')),
    '',
    `--${boundary}--`,
  ];
  return toBase64Url(lines.join('\r\n'));
}

// Envoie réellement l'e-mail depuis le compte Gmail connecté (users.messages.send).
// attachment (optionnel) : { filename, mimeType, buffer }.
async function sendMessage({ to, subject, body, attachment }) {
  const { client, email } = await getAuthenticatedClient();
  const gmail = google.gmail({ version: 'v1', auth: client });
  const raw = buildRawMessage({ from: email, to, subject, body, attachment });
  const { data } = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
  return { messageId: data.id, from: email };
}

module.exports = { getAuthUrl, handleOAuthCallback, getConnection, disconnect, sendMessage, SCOPES };
