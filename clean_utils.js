// Fonctions de nettoyage / normalisation pour l'import Excel Neogia CRM
const { normalizeTechToken } = require('./tech_taxonomy');

function cleanStr(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

function normalizeNom(nom) {
  const s = cleanStr(nom);
  if (!s) return '';
  // Nom de famille en capitales propres (gère les particules et tirets)
  return s
    .split(/([\s-])/)
    .map((part) => {
      if (part === ' ' || part === '-') return part;
      return part.toUpperCase();
    })
    .join('');
}

function normalizePrenom(prenom) {
  const s = cleanStr(prenom);
  if (!s) return '';
  return s
    .split(/([\s-])/)
    .map((part) => {
      if (part === ' ' || part === '-') return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
}

function normalizeEntreprise(nom) {
  const s = cleanStr(nom);
  return s
    .split(' ')
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

function normalizeKeyEntreprise(nom) {
  return cleanStr(nom)
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function extractEmails(raw) {
  const s = cleanStr(raw).toLowerCase();
  if (!s) return [];
  const matches = s.match(EMAIL_RE);
  if (!matches) return [];
  return [...new Set(matches.map((e) => e.trim()))];
}

function normalizePhone(raw) {
  const s = cleanStr(raw);
  if (!s) return '';
  // peut contenir plusieurs numéros séparés par /
  const parts = s.split('/').map((p) => p.trim()).filter(Boolean);
  const cleaned = parts.map((p) => {
    let digits = p.replace(/[^\d+]/g, '');
    // format international +33 -> 0
    if (digits.startsWith('+33')) digits = '0' + digits.slice(3);
    else if (digits.startsWith('330')) digits = '0' + digits.slice(3);
    else if (digits.startsWith('33') && digits.length === 11) digits = '0' + digits.slice(2);
    // regrouper par paires si 10 chiffres français
    if (/^0\d{9}$/.test(digits)) {
      return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
    }
    return p; // format inconnu, on garde tel quel
  });
  return [...new Set(cleaned)].join(' / ');
}

// Extrait les segments datés d'un texte d'historique et retourne une liste
// d'échanges { date_echange (ISO ou null), date_approximative, compte_rendu }
const DATE_SEGMENT_RE = /(\d{1,2})\s*[\/\-]\s*(\d{1,2})(?:\s*[\/\-]\s*(\d{2,4}))?\s*:?/g;

function splitHistoriqueEnEchanges(raw, referenceYear) {
  const text = cleanStr(raw);
  if (!text) return [];

  // Ne conserve que les correspondances qui ressemblent réellement à une date valide
  // (jour 1-31, mois 1-12) pour éviter de couper le texte sur des faux positifs
  // comme "10/15 ans d'expérience".
  const allMatches = [...text.matchAll(DATE_SEGMENT_RE)];
  const matches = allMatches.filter((m) => {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    return day >= 1 && day <= 31 && month >= 1 && month <= 12;
  });
  if (matches.length === 0) {
    return [{ date_echange: null, date_approximative: 1, compte_rendu: text }];
  }

  const segments = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const start = m.index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const chunk = text.slice(start, end).trim();
    // retire le préfixe date du texte affiché
    const compte_rendu = chunk.replace(DATE_SEGMENT_RE, '').trim().replace(/^:\s*/, '') || chunk;

    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    let year = m[3] ? parseInt(m[3], 10) : null;
    if (year && year < 100) year += 2000;
    if (!year) {
      // Devine l'année la plus plausible par rapport à l'année de référence (import)
      year = referenceYear;
      if (month > new Date().getMonth() + 2) year = referenceYear - 1; // mois "futur" -> probablement l'année précédente
    }
    let iso = null;
    let approx = 0;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      iso = `${year}-${mm}-${dd}`;
      approx = m[3] ? 0 : 1; // pas d'année explicite = approximatif
    } else {
      approx = 1;
    }
    segments.push({ date_echange: iso, date_approximative: approx, compte_rendu: compte_rendu || chunk });
  }
  return segments;
}

function parseTechEnvironnement(raw) {
  const s = cleanStr(raw);
  if (!s) return { tokens: [], ignoredRaw: [] };
  const parts = s.split(/[\/\n;]+/).map((p) => p.trim()).filter(Boolean);
  const tokens = [];
  const ignoredRaw = [];
  for (const p of parts) {
    const result = normalizeTechToken(p);
    if (!result) continue;
    if (result.ignored) {
      ignoredRaw.push(result.raw);
    } else {
      tokens.push(result);
    }
  }
  return { tokens, ignoredRaw };
}

module.exports = {
  cleanStr,
  normalizeNom,
  normalizePrenom,
  normalizeEntreprise,
  normalizeKeyEntreprise,
  extractEmails,
  normalizePhone,
  splitHistoriqueEnEchanges,
  parseTechEnvironnement,
};
