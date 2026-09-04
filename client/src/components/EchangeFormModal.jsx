import React, { useEffect, useState } from 'react';
import { Modal, Field, Select } from './ui';
import { usePickLists } from '../lib/PickListsContext';
import { useToast } from '../lib/ToastContext';
import { api } from '../lib/api';

// Format une Date en "YYYY-MM-DDTHH:MM" en heure LOCALE (contrairement à
// toISOString() qui convertit en UTC) — c'est le format attendu par un
// input type="datetime-local".
function toLocalDatetimeInput(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Une date_echange existante peut ne contenir que "YYYY-MM-DD" (échanges
// créés avant l'ajout de l'heure, ou import en masse) : on complète avec
// 00:00 pour que l'input datetime-local l'affiche correctement.
function toDatetimeInputValue(v) {
  if (!v) return toLocalDatetimeInput(new Date());
  return v.includes('T') ? v.slice(0, 16) : `${v}T00:00`;
}

const EMPTY = { date_echange: toLocalDatetimeInput(new Date()), type: 'appel', objet: '', compte_rendu: '', prochaine_action: '', date_relance: '', auteur: 'Administrateur Neogia' };
// Conservé et exporté pour compatibilité (ex. filtre "Objet" du Journal des
// échanges, qui retrouve les échanges déjà enregistrés sous ces objets) —
// le champ "Objet / titre" n'est en revanche plus proposé dans ce formulaire
// (simplifié pour ne garder que le "Type" comme qualificatif de l'échange).
export const OBJET_PRESETS = ['Appel', 'Mail', 'Rendez-vous'];

export default function EchangeFormModal({ open, onClose, onSaved, contactId, echange }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const { getOptions } = usePickLists();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      const next = echange ? { ...EMPTY, ...echange, date_echange: toDatetimeInputValue(echange.date_echange) } : EMPTY;
      setForm(next);
    }
  }, [open, echange]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.compte_rendu) return toast('Merci de renseigner un compte-rendu.', 'error');
    setSaving(true);
    try {
      if (echange) await api.put(`/echanges/${echange.id}`, form);
      else await api.post(`/contacts/${contactId}/echanges`, form);
      toast('Échange enregistré.', 'success');
      onSaved();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={echange ? "Modifier l'échange" : 'Nouvel échange'} wide>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Date et heure" required><input type="datetime-local" className="input" value={form.date_echange || ''} onChange={set('date_echange')} /></Field>
        <Field label="Type">
          <Select value={form.type} onChange={set('type')}>
            {getOptions('echange_type').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Compte rendu" required>
        <textarea
          className="input"
          rows={10}
          style={{ resize: 'vertical', minHeight: '10rem' }}
          value={form.compte_rendu || ''}
          onChange={set('compte_rendu')}
        />
      </Field>
      <Field label="Prochaine action"><input className="input" value={form.prochaine_action || ''} onChange={set('prochaine_action')} /></Field>
      <Field label="Date de relance (facultatif)"><input type="date" className="input" value={form.date_relance || ''} onChange={set('date_relance')} /></Field>

      <div className="flex justify-end gap-2 mt-4">
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={saving} onClick={submit}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
      </div>
    </Modal>
  );
}
