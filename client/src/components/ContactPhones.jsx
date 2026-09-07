import React from 'react';
import { Smartphone, Phone } from 'lucide-react';
import { formatPhoneFR, phoneHref } from '../lib/format';

/**
 * Affiche les numéros de téléphone d'un contact (mobile(s) et/ou fixe), cliquables
 * (lien tel:) pour pouvoir appeler directement depuis un iPhone.
 * Un contact peut avoir plusieurs mobiles (`telephone_mobile` + `mobiles_supplementaires`),
 * car un prospect en a parfois plusieurs — un seul fixe reste supporté.
 * - N'affiche rien si aucun numéro n'est renseigné (pas de faux numéro/placeholder).
 * - N'affiche que le(s) numéro(s) réellement disponible(s).
 * - En mode `compact` (cartes, listes) : un seul mobile affiché, avec un badge
 *   "+N" s'il y en a d'autres (à voir sur la fiche du contact).
 * - stopPropagation sur le clic : ces cartes sont elles-mêmes cliquables (navigation
 *   vers la fiche contact), on ne veut pas que "tel:" déclenche aussi la navigation.
 */
export default function ContactPhones({ contact, className = '', size = 'sm', compact = false }) {
  const mobiles = [contact?.telephone_mobile, ...(contact?.mobiles_supplementaires || [])].filter(Boolean);
  const fixe = contact?.telephone_fixe;
  if (mobiles.length === 0 && !fixe) return null;

  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const iconSize = size === 'sm' ? 12 : 14;

  const shownMobiles = compact ? mobiles.slice(0, 1) : mobiles;
  const hiddenCount = mobiles.length - shownMobiles.length;

  return (
    <div className={`flex items-center flex-wrap gap-x-3 gap-y-0.5 ${textSize} ${className}`}>
      {shownMobiles.map((m) => (
        <a
          key={m}
          href={phoneHref(m)}
          onClick={(e) => e.stopPropagation()}
          title="Mobile"
          className="flex items-center gap-1 text-slate2-600 hover:text-brand"
        >
          <Smartphone size={iconSize} />
          {formatPhoneFR(m)}
        </a>
      ))}
      {hiddenCount > 0 && <span className="text-slate2-400">+{hiddenCount}</span>}
      {fixe && (
        <a
          href={phoneHref(fixe)}
          onClick={(e) => e.stopPropagation()}
          title="Fixe"
          className="flex items-center gap-1 text-slate2-600 hover:text-brand"
        >
          <Phone size={iconSize} />
          {formatPhoneFR(fixe)}
        </a>
      )}
    </div>
  );
}
