import React, { useState } from 'react';
import { Mail, Check } from 'lucide-react';
import { useToast } from '../lib/ToastContext';

function CopyableEmail({ email, textSize, iconSize }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const copy = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(email)
      .then(() => {
        setCopied(true);
        toast('Email copié.', 'success');
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => toast("Impossible de copier l'email.", 'error'));
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="Copier l'email"
      className={`flex items-center gap-1 min-w-0 text-slate2-600 hover:text-brand ${textSize}`}
    >
      {copied ? <Check size={iconSize} className="shrink-0 text-green-600" /> : <Mail size={iconSize} className="shrink-0" />}
      <span className="truncate">{email}</span>
    </button>
  );
}

/**
 * Affiche le(s) email(s) d'un contact, copiable(s) en un clic (plutôt qu'un lien
 * mailto : on veut pouvoir les coller ailleurs sans ouvrir un client mail).
 * Un contact peut avoir un email principal (`email`) et des emails
 * supplémentaires (`emails_supplementaires`), car un prospect en a parfois
 * plusieurs.
 * - N'affiche rien si aucun email n'est renseigné.
 * - En mode `compact` (cartes, listes) : seul l'email principal est affiché,
 *   avec un badge "+N" s'il y en a d'autres (à voir sur la fiche du contact).
 * - En mode complet (fiche contact) : tous les emails sont listés, chacun copiable.
 * - stopPropagation sur le clic : ces cartes sont elles-mêmes cliquables
 *   (navigation vers la fiche contact), on ne veut pas déclencher la navigation.
 */
export default function ContactEmail({ contact, className = '', size = 'sm', compact = false }) {
  const emails = [contact?.email, ...(contact?.emails_supplementaires || [])].filter(Boolean);
  if (emails.length === 0) return null;

  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const iconSize = size === 'sm' ? 12 : 14;

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 min-w-0 ${className}`}>
        <CopyableEmail email={emails[0]} textSize={textSize} iconSize={iconSize} />
        {emails.length > 1 && <span className={`shrink-0 text-slate2-400 ${textSize}`}>+{emails.length - 1}</span>}
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {emails.map((e) => <CopyableEmail key={e} email={e} textSize={textSize} iconSize={iconSize} />)}
    </div>
  );
}
