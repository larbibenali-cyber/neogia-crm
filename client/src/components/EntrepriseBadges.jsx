import React from 'react';

// Logo entreprise (upload manuel) ou, à défaut, initiales colorées — même principe
// que l'avatar contact/candidat mais en carré arrondi pour distinguer visuellement
// une entreprise d'une personne dans les listes mixtes.
export function EntrepriseLogo({ nom, logoUrl, size = 40 }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={nom}
        className="rounded-xl object-cover shrink-0 border border-slate2-100"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = (nom || '?').trim().slice(0, 2).toUpperCase();
  const colors = ['#4527EA', '#0369A1', '#BE185D', '#047857', '#B45309', '#6D28D9'];
  const idx = (initials.charCodeAt(0) || 0) % colors.length;
  return (
    <div
      className="rounded-xl flex items-center justify-center text-white font-semibold shrink-0"
      style={{ width: size, height: size, background: colors[idx], fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

const STATUT_STYLES = {
  prospect: { label: 'Prospect', color: '#64748B' },
  client: { label: 'Client', color: '#047857' },
  partenaire: { label: 'Partenaire', color: '#6D28D9' },
  inactif: { label: 'Inactif', color: '#94A3B8' },
};

export function EntrepriseStatusBadge({ statut, small }) {
  const s = STATUT_STYLES[statut] || STATUT_STYLES.prospect;
  return (
    <span
      className="badge"
      style={{
        color: s.color,
        background: `${s.color}22`,
        fontSize: small ? '0.68rem' : undefined,
        padding: small ? '0.1rem 0.5rem' : undefined,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

export const ENTREPRISE_STATUTS = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'client', label: 'Client' },
  { value: 'partenaire', label: 'Partenaire' },
  { value: 'inactif', label: 'Inactif' },
];
