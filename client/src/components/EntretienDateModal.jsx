import React, { useEffect, useState } from 'react';
import { Modal, Field } from './ui';
import { api } from '../lib/api';
import { useToast } from '../lib/ToastContext';

/**
 * S'ouvre automatiquement dès qu'un positionnement passe au statut « Entretien
 * planifié » ou « Entretien réalisé » : demande la date (et l'heure) de
 * l'entretien dans la foulée, en un seul aller-retour avec le changement de
 * statut — plus besoin de naviguer ailleurs pour la renseigner.
 *
 * Cette date (`date_entretien`) est ensuite ce qui alimente la barre
 * « Entretiens planifiés » du diagramme « Activité du mois » du tableau de
 * bord : sans cette saisie immédiate, un entretien planifié n'y apparaît pas.
 *
 * `onClose` sans enregistrer n'effectue AUCUN appel API : le statut affiché
 * ailleurs reste donc inchangé (annuler = ne rien changer).
 */
export default function EntretienDateModal({ open, positionnement, statut, candidatLabel, contextLabel, onClose, onSaved }) {
  const [date, setDate] = useState('');
  const [heure, setHeure] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setDate(positionnement?.date_entretien || new Date().toISOString().slice(0, 10));
      setHeure(positionnement?.heure_entretien || '');
    }
  }, [open, positionnement]);

  if (!open || !positionnement) return null;

  const label = statut === 'entretien_realise' ? 'Entretien réalisé' : 'Entretien planifié';

  const submit = async () => {
    if (!date) return toast("Merci d'indiquer la date de l'entretien.", 'error');
    setSaving(true);
    try {
      await api.put(`/positionnements/${positionnement.id}`, { statut, date_entretien: date, heure_entretien: heure || null });
      toast('Entretien enregistré.', 'success');
      onSaved();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`${label} — ${candidatLabel}`}>
      {contextLabel && <p className="text-sm text-slate2-500 mb-3">{contextLabel}</p>}
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Date de l'entretien" required>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Heure (optionnel)">
          <input type="time" className="input" value={heure} onChange={(e) => setHeure(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={saving || !date} onClick={submit}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </Modal>
  );
}
