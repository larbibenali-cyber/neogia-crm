import React, { useEffect, useState } from 'react';
import { Modal, Field, Select } from './ui';
import TagsInput from './TagsInput';
import { usePickLists } from '../lib/PickListsContext';
import { useToast } from '../lib/ToastContext';
import { api } from '../lib/api';

const EMPTY = {
  prenom: '', nom: '', email: '', telephone: '', intitule_profil: '', metier: '', annees_experience: '',
  competences_principales: '', secteurs: '', localisation: '', mobilite: '', disponibilite: '', disponibilite_date: '',
  tjm: '', niveau_anglais: '', statut: 'a_contacter', source: 'Saisie manuelle', notes: '', technologies: [],
};

export default function CandidatFormModal({ open, onClose, onSaved, candidat, prefill }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const { getOptions } = usePickLists();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setForm(candidat
        ? { ...EMPTY, ...candidat, technologies: (candidat.technologies || []).map((t) => t.nom) }
        : { ...EMPTY, ...prefill });
    }
  }, [open, candidat, prefill]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.nom && !form.prenom) return toast('Merci de renseigner un nom ou un prénom.', 'error');
    setSaving(true);
    try {
      const saved = candidat ? await api.put(`/candidats/${candidat.id}`, form) : await api.post('/candidats', form);
      toast(candidat ? 'Candidat mis à jour.' : 'Candidat créé.', 'success');
      onSaved(saved);
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={candidat ? 'Modifier le candidat' : 'Nouveau candidat'} wide>
      <div className="grid md:grid-cols-2 gap-x-4">
        <Field label="Prénom"><input className="input" value={form.prenom} onChange={set('prenom')} /></Field>
        <Field label="Nom"><input className="input" value={form.nom} onChange={set('nom')} /></Field>
        <Field label="E-mail"><input type="email" className="input" value={form.email} onChange={set('email')} /></Field>
        <Field label="Téléphone"><input className="input" value={form.telephone} onChange={set('telephone')} /></Field>
        <Field label="Intitulé du profil"><input className="input" value={form.intitule_profil} onChange={set('intitule_profil')} /></Field>
        <Field label="Métier principal"><input className="input" value={form.metier} onChange={set('metier')} /></Field>
        <Field label="Années d'expérience"><input type="number" className="input" value={form.annees_experience ?? ''} onChange={set('annees_experience')} /></Field>
        <Field label="Niveau d'anglais"><input className="input" value={form.niveau_anglais} onChange={set('niveau_anglais')} /></Field>
        <Field label="Localisation"><input className="input" value={form.localisation} onChange={set('localisation')} /></Field>
        <Field label="Mobilité" hint="ex: France entière, télétravail partiel..."><input className="input" value={form.mobilite} onChange={set('mobilite')} /></Field>
        <Field label="Disponibilité">
          <Select value={form.disponibilite} onChange={set('disponibilite')}>
            <option value="">—</option>
            <option value="immediate">Immédiate</option>
            <option value="1_mois">Sous 1 mois</option>
            <option value="2_mois">Sous 2 mois</option>
            <option value="3_mois_plus">3 mois ou plus</option>
          </Select>
        </Field>
        <Field label="Date de disponibilité"><input type="date" className="input" value={form.disponibilite_date || ''} onChange={set('disponibilite_date')} /></Field>
        <Field label="TJM souhaité / proposé (€)"><input type="number" className="input" value={form.tjm ?? ''} onChange={set('tjm')} /></Field>
        <Field label="Statut">
          <Select value={form.statut} onChange={set('statut')}>
            {getOptions('candidat_status').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <Field label="Source"><input className="input" value={form.source} onChange={set('source')} /></Field>
      </div>
      <Field label="Environnement technique / compétences"><TagsInput value={form.technologies} onChange={(v) => setForm((f) => ({ ...f, technologies: v }))} /></Field>
      <Field label="Compétences principales (texte libre)"><textarea className="input" rows={2} value={form.competences_principales} onChange={set('competences_principales')} /></Field>
      <Field label="Secteurs d'intervention"><input className="input" value={form.secteurs} onChange={set('secteurs')} /></Field>
      <Field label="Notes"><textarea className="input" rows={2} value={form.notes} onChange={set('notes')} /></Field>

      <div className="flex justify-end gap-2 mt-4">
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={saving} onClick={submit}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
      </div>
    </Modal>
  );
}
