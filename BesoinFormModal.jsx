import React, { useEffect, useState } from 'react';
import { Modal, Field, Select } from './ui';
import EntrepriseCombo from './EntrepriseCombo';
import TagsInput from './TagsInput';
import { usePickLists } from '../lib/PickListsContext';
import { useToast } from '../lib/ToastContext';
import { api } from '../lib/api';

const EMPTY = {
  titre: '', entreprise_id: '', contact_id: '', description_contexte: '', missions: '',
  technologies_obligatoires: [], technologies_appreciees: [], niveau_experience: '', localisation: '',
  teletravail: '', date_demarrage: '', duree_estimee: '', tjm_client: '', tjm_candidat: '',
  priorite: 'normale', date_limite_reponse: '', source: 'Module Besoins', notes_internes: '', statut: 'lead_a_qualifier',
};

export default function BesoinFormModal({ open, onClose, onSaved, besoin, defaults }) {
  const [form, setForm] = useState(EMPTY);
  const [contacts, setContacts] = useState([]);
  const [saving, setSaving] = useState(false);
  const { getOptions } = usePickLists();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setForm(besoin
        ? { ...EMPTY, ...besoin, technologies_obligatoires: (besoin.technologies || []).filter((t) => t.obligatoire).map((t) => t.nom), technologies_appreciees: (besoin.technologies || []).filter((t) => !t.obligatoire).map((t) => t.nom) }
        : { ...EMPTY, ...defaults });
    }
  }, [open, besoin, defaults]);

  useEffect(() => {
    if (form.entreprise_id) api.get(`/entreprises/${form.entreprise_id}`).then((e) => setContacts(e.contacts || []));
    else setContacts([]);
  }, [form.entreprise_id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.entreprise_id) return toast('Merci de sélectionner une entreprise cliente.', 'error');
    if (!form.titre) return toast('Merci de renseigner un titre.', 'error');
    setSaving(true);
    try {
      const saved = besoin ? await api.put(`/besoins/${besoin.id}`, form) : await api.post('/besoins', form);
      toast(besoin ? 'Besoin mis à jour.' : `Besoin créé (${saved.reference}).`, 'success');
      onSaved(saved);
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={besoin ? 'Modifier le besoin' : 'Nouveau besoin'} wide>
      <div className="grid md:grid-cols-2 gap-x-4">
        <Field label="Titre du besoin" required><input className="input" value={form.titre} onChange={set('titre')} /></Field>
        <Field label="Priorité">
          <Select value={form.priorite} onChange={set('priorite')}>
            {getOptions('besoin_priorite').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <Field label="Entreprise cliente" required>
          <EntrepriseCombo value={form.entreprise_id} onChange={(id) => setForm((f) => ({ ...f, entreprise_id: id, contact_id: '' }))} />
        </Field>
        <Field label="Contact principal">
          <Select value={form.contact_id || ''} onChange={set('contact_id')}>
            <option value="">—</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
          </Select>
        </Field>
      </div>

      <Field label="Description du contexte"><textarea className="input" rows={3} value={form.description_contexte} onChange={set('description_contexte')} /></Field>
      <Field label="Missions attendues"><textarea className="input" rows={2} value={form.missions} onChange={set('missions')} /></Field>

      <div className="grid md:grid-cols-2 gap-x-4">
        <Field label="Compétences / technologies obligatoires">
          <TagsInput value={form.technologies_obligatoires} onChange={(v) => setForm((f) => ({ ...f, technologies_obligatoires: v }))} />
        </Field>
        <Field label="Compétences / technologies appréciées">
          <TagsInput value={form.technologies_appreciees} onChange={(v) => setForm((f) => ({ ...f, technologies_appreciees: v }))} />
        </Field>
        <Field label="Niveau d'expérience recherché" hint="ex: 5 ans minimum"><input className="input" value={form.niveau_experience} onChange={set('niveau_experience')} /></Field>
        <Field label="Localisation"><input className="input" value={form.localisation} onChange={set('localisation')} /></Field>
        <Field label="Modalités de télétravail"><input className="input" value={form.teletravail} onChange={set('teletravail')} /></Field>
        <Field label="Durée estimée"><input className="input" value={form.duree_estimee} onChange={set('duree_estimee')} /></Field>
        <Field label="Date de démarrage"><input type="date" className="input" value={form.date_demarrage || ''} onChange={set('date_demarrage')} /></Field>
        <Field label="Date limite de réponse"><input type="date" className="input" value={form.date_limite_reponse || ''} onChange={set('date_limite_reponse')} /></Field>
        <Field label="TJM client (€)"><input type="number" className="input" value={form.tjm_client ?? ''} onChange={set('tjm_client')} /></Field>
        <Field label="TJM candidat / consultant (€)"><input type="number" className="input" value={form.tjm_candidat ?? ''} onChange={set('tjm_candidat')} /></Field>
        <Field label="Statut">
          <Select value={form.statut} onChange={set('statut')}>
            {getOptions('besoin_status').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <Field label="Source du besoin"><input className="input" value={form.source} onChange={set('source')} /></Field>
      </div>
      <Field label="Notes internes"><textarea className="input" rows={2} value={form.notes_internes} onChange={set('notes_internes')} /></Field>

      <div className="flex justify-end gap-2 mt-4">
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={saving} onClick={submit}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
      </div>
    </Modal>
  );
}
