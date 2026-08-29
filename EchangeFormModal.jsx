import React, { useEffect, useState } from 'react';
import { Modal, Field, Select } from './ui';
import { usePickLists } from '../lib/PickListsContext';
import { useToast } from '../lib/ToastContext';
import { api } from '../lib/api';

const EMPTY = { date_echange: new Date().toISOString().slice(0, 10), type: 'appel', objet: '', compte_rendu: '', prochaine_action: '', date_relance: '', auteur: 'Administrateur Neogia' };

export default function EchangeFormModal({ open, onClose, onSaved, contactId, echange }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const { getOptions } = usePickLists();
  const toast = useToast();

  useEffect(() => {
    if (open) setForm(echange ? { ...EMPTY, ...echange, date_echange: echange.date_echange || EMPTY.date_echange } : EMPTY);
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
    <Modal open={open} onClose={onClose} title={echange ? "Modifier l'échange" : 'Nouvel échange'}>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Date" required><input type="date" className="input" value={form.date_echange || ''} onChange={set('date_echange')} /></Field>
        <Field label="Type">
          <Select value={form.type} onChange={set('type')}>
            {getOptions('echange_type').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Objet / titre court"><input className="input" value={form.objet || ''} onChange={set('objet')} /></Field>
      <Field label="Compte rendu" required><textarea className="input" rows={4} value={form.compte_rendu || ''} onChange={set('compte_rendu')} /></Field>
      <Field label="Prochaine action"><input className="input" value={form.prochaine_action || ''} onChange={set('prochaine_action')} /></Field>
      <Field label="Date de relance (facultatif)"><input type="date" className="input" value={form.date_relance || ''} onChange={set('date_relance')} /></Field>

      <div className="flex justify-end gap-2 mt-4">
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={saving} onClick={submit}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
      </div>
    </Modal>
  );
}
