import React, { useEffect, useState } from 'react';
import { Modal, Field, Select } from './ui';
import { ENTREPRISE_STATUTS } from './EntrepriseBadges';
import { useToast } from '../lib/ToastContext';
import { api } from '../lib/api';

const EMPTY = { nom: '', statut: 'prospect', secteur: '', adresse: '', site_web: '', notes: '' };

export default function EntrepriseFormModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (open) setForm(EMPTY);
  }, [open]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.nom.trim()) return toast("Merci de renseigner le nom de l'entreprise.", 'error');
    setSaving(true);
    try {
      const created = await api.post('/entreprises', form);
      toast('Entreprise créée.', 'success');
      onSaved(created);
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nouvelle entreprise">
      <Field label="Nom" required>
        <input className="input" value={form.nom} onChange={set('nom')} autoFocus />
      </Field>
      <Field label="Statut">
        <Select value={form.statut} onChange={set('statut')}>
          {ENTREPRISE_STATUTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Field>
      <Field label="Secteur"><input className="input" value={form.secteur} onChange={set('secteur')} /></Field>
      <Field label="Adresse"><input className="input" value={form.adresse} onChange={set('adresse')} /></Field>
      <Field label="Site web"><input className="input" value={form.site_web} onChange={set('site_web')} placeholder="https://..." /></Field>
      <Field label="Notes"><textarea className="input" rows={3} value={form.notes} onChange={set('notes')} /></Field>

      <div className="flex justify-end gap-2 mt-4">
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={saving} onClick={submit}>
          {saving ? 'Création...' : 'Créer'}
        </button>
      </div>
    </Modal>
  );
}
