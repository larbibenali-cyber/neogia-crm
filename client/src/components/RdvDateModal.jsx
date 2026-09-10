import React, { useEffect, useState } from 'react';
import { Modal, Field } from './ui';
import { useToast } from '../lib/ToastContext';

/**
 * S'ouvre automatiquement dès qu'on choisit « Rendez-vous » comme type dans
 * la fenêtre « Ajouter un échange » (ou « Modifier l'échange ») : demande la
 * date (et l'heure) du RDV lui-même, séparément de la date de l'échange.
 *
 * Cette séparation est volontaire : le champ « Date et heure » du formulaire
 * d'échange reste la date à laquelle CET échange (l'appel, l'e-mail) a
 * réellement eu lieu — typiquement aujourd'hui — et continue d'alimenter le
 * journal des échanges. La date saisie ici (`date_rdv` / `heure_rdv`) est la
 * date du rendez-vous à venir et alimente exclusivement le diagramme « RDV
 * pris » du tableau de bord. Mélanger les deux faisait apparaître, dans le
 * journal des échanges, des échanges « datés dans le futur ».
 *
 * `onClose` sans enregistrer n'effectue aucune modification : la date du RDV
 * précédemment saisie (le cas échéant) reste inchangée (annuler = ne rien
 * changer).
 */
export default function RdvDateModal({ open, dateRdv, heureRdv, onClose, onSave }) {
  const [date, setDate] = useState('');
  const [heure, setHeure] = useState('');
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setDate(dateRdv || new Date().toISOString().slice(0, 10));
      setHeure(heureRdv || '');
    }
  }, [open, dateRdv, heureRdv]);

  if (!open) return null;

  const submit = () => {
    if (!date) return toast('Merci d’indiquer la date du RDV.', 'error');
    onSave(date, heure || null);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Date du RDV">
      <p className="text-sm text-slate2-500 mb-4">
        Cette date alimente le diagramme « RDV pris » du tableau de bord — indépendamment de la date de l'échange ci-dessous, qui reste celle de cet appel/e-mail.
      </p>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Date du RDV" required>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Heure (optionnel)">
          <input type="time" className="input" value={heure} onChange={(e) => setHeure(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!date} onClick={submit}>Enregistrer</button>
      </div>
    </Modal>
  );
}
