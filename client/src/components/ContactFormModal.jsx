import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal, Field, Select } from './ui';
import EntrepriseCombo from './EntrepriseCombo';
import TagsInput from './TagsInput';
import { usePickLists } from '../lib/PickListsContext';
import { useToast } from '../lib/ToastContext';
import { api } from '../lib/api';

const EMPTY = {
  entreprise_id: '', nom: '', prenom: '', fonction: '', email: '', telephone_mobile: '', telephone_fixe: '',
  localisation: '', source: 'Saisie manuelle', statut: 'prospect_a_contacter', responsable: '', notes: '', tags: [],
};

export default function ContactFormModal({ open, onClose, onSaved, contact, defaultEntrepriseId }) {
  const [form, setForm] = useState(EMPTY);
  const [duplicates, setDuplicates] = useState([]);
  const [saving, setSaving] = useState(false);
  const { getOptions } = usePickLists();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setForm(contact ? { ...EMPTY, ...contact, tags: contact.tags || [] } : { ...EMPTY, entreprise_id: defaultEntrepriseId || '' });
      setDuplicates([]);
    }
  }, [open, contact, defaultEntrepriseId]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target ? e.target.value : e }));

  const checkDuplicates = async () => {
    if (contact) return []; // pas de vérif à la modification
    if (!form.email && !form.telephone_mobile && !(form.nom && form.prenom && form.entreprise_id)) return [];
    const params = new URLSearchParams();
    if (form.email) params.set('email', form.email);
    if (form.telephone_mobile) params.set('telephone', form.telephone_mobile);
    if (form.nom) params.set('nom', form.nom);
    if (form.prenom) params.set('prenom', form.prenom);
    if (form.entreprise_id) params.set('entreprise_id', form.entreprise_id);
    const { duplicates } = await api.get(`/contacts/check-duplicate?${params.toString()}`);
    return duplicates;
  };

  const submit = async (force = false) => {
    if (!form.entreprise_id) return toast('Merci de sélectionner une entreprise.', 'error');
    if (!form.nom && !form.prenom) return toast('Merci de renseigner un nom ou un prénom.', 'error');

    if (!force && !contact) {
      const dups = await checkDuplicates();
      if (dups.length > 0) { setDuplicates(dups); return; }
    }
    setSaving(true);
    try {
      const saved = contact
        ? await api.put(`/contacts/${contact.id}`, form)
        : await api.post('/contacts', form);
      toast(contact ? 'Contact mis à jour.' : 'Contact créé.', 'success');
      onSaved(saved);
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={contact ? 'Modifier le contact' : 'Nouveau contact'} wide>
      {duplicates.length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <div className="flex items-center gap-2 font-medium mb-1"><AlertTriangle size={16} /> Doublon potentiel détecté</div>
          <ul className="list-disc list-inside space-y-0.5 mb-2">
            {duplicates.map((d) => (
              <li key={d.id}>{d.prenom} {d.nom} — {d.entreprise_nom} ({d.email || d.telephone_mobile || 'sans coordonnée'})</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={() => submit(true)}>Créer quand même</button>
            <button className="btn btn-ghost" onClick={() => setDuplicates([])}>Annuler</button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-x-4">
        <Field label="Entreprise" required>
          <EntrepriseCombo value={form.entreprise_id} onChange={(id) => setForm((f) => ({ ...f, entreprise_id: id }))} />
        </Field>
        <Field label="Statut">
          <Select value={form.statut} onChange={set('statut')}>
            {getOptions('contact_status').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <Field label="Nom"><input className="input" value={form.nom} onChange={set('nom')} /></Field>
        <Field label="Prénom"><input className="input" value={form.prenom} onChange={set('prenom')} /></Field>
        <Field label="Fonction"><input className="input" value={form.fonction} onChange={set('fonction')} /></Field>
        <Field label="Responsable de la fiche"><input className="input" value={form.responsable} onChange={set('responsable')} /></Field>
        <Field label="E-mail"><input className="input" type="email" value={form.email} onChange={set('email')} /></Field>
        <Field label="Téléphone mobile"><input className="input" value={form.telephone_mobile} onChange={set('telephone_mobile')} /></Field>
        <Field label="Téléphone fixe"><input className="input" value={form.telephone_fixe} onChange={set('telephone_fixe')} /></Field>
        <Field label="Localisation"><input className="input" value={form.localisation} onChange={set('localisation')} /></Field>
        <Field label="Source"><input className="input" value={form.source} onChange={set('source')} /></Field>
      </div>
      <Field label="Tags">
        <TagsInput value={form.tags} onChange={(tags) => setForm((f) => ({ ...f, tags }))} />
      </Field>
      <Field label="Notes générales">
        <textarea className="input" rows={3} value={form.notes} onChange={set('notes')} />
      </Field>

      <div className="flex justify-end gap-2 mt-4">
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={saving} onClick={() => submit(false)}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </Modal>
  );
}
