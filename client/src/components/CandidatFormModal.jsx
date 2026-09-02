import React, { useEffect, useRef, useState } from 'react';
import { UploadCloud, FileText, Sparkles } from 'lucide-react';
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
  const [cvFile, setCvFile] = useState(null);
  const [cvExtracting, setCvExtracting] = useState(false);
  const cvInput = useRef(null);
  const { getOptions } = usePickLists();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setForm(candidat
        ? { ...EMPTY, ...candidat, technologies: (candidat.technologies || []).map((t) => t.nom) }
        : { ...EMPTY, ...prefill });
      setCvFile(null);
      setCvExtracting(false);
    }
  }, [open, candidat, prefill]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Importer un CV lors de la CRÉATION d'un candidat : le fichier est analysé
  // immédiatement pour pré-remplir le formulaire (nom, prénom, technologies,
  // téléphone, expérience...), sans encore créer ni stocker la fiche. Le
  // fichier n'est réellement rattaché au candidat qu'à l'enregistrement.
  const handleCvSelect = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') return toast('Seuls les fichiers PDF sont acceptés.', 'error');
    setCvFile(file);
    setCvExtracting(true);
    const fd = new FormData();
    fd.append('cv', file);
    try {
      const { suggestion } = await api.post('/candidats/cv-extract', fd);
      setForm((f) => ({
        ...f,
        prenom: f.prenom || suggestion.prenom || '',
        nom: f.nom || suggestion.nom || '',
        email: f.email || suggestion.email || '',
        telephone: f.telephone || suggestion.telephone || '',
        annees_experience: f.annees_experience || suggestion.annees_experience || '',
        intitule_profil: f.intitule_profil || suggestion.intitule_profil || '',
        technologies: Array.from(new Set([...(f.technologies || []), ...(suggestion.technologies || [])])),
      }));
      toast('Informations extraites du CV — merci de vérifier avant d\'enregistrer.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setCvExtracting(false);
    }
  };

  const submit = async () => {
    if (!form.nom && !form.prenom) return toast('Merci de renseigner un nom ou un prénom.', 'error');
    setSaving(true);
    try {
      const saved = candidat ? await api.put(`/candidats/${candidat.id}`, form) : await api.post('/candidats', form);
      if (!candidat && cvFile) {
        try {
          const fd = new FormData();
          fd.append('cv', cvFile);
          await api.post(`/candidats/${saved.id}/cv`, fd);
        } catch (err) {
          toast(`Candidat créé, mais l'ajout du CV a échoué : ${err.message}`, 'error');
        }
      }
      toast(candidat ? 'Candidat mis à jour.' : 'Candidat créé.', 'success');
      onSaved(saved);
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={candidat ? 'Modifier le candidat' : 'Nouveau candidat'} wide>
      {!candidat && (
        <div className="mb-4 p-4 border-2 border-dashed border-slate2-200 rounded-2xl text-center bg-slate2-50">
          <UploadCloud size={22} className="mx-auto text-brand mb-1.5" />
          {cvFile ? (
            <p className="text-sm text-slate2-700 flex items-center justify-center gap-1.5"><FileText size={14} />{cvFile.name}</p>
          ) : (
            <p className="text-sm text-slate2-600">Importer un CV (PDF) pour pré-remplir la fiche automatiquement</p>
          )}
          <button type="button" className="btn btn-secondary mt-2" onClick={() => cvInput.current?.click()} disabled={cvExtracting}>
            {cvExtracting ? 'Analyse en cours...' : cvFile ? 'Changer de fichier' : 'Choisir un CV'}
          </button>
          <input ref={cvInput} type="file" accept="application/pdf" hidden onChange={(e) => handleCvSelect(e.target.files[0])} />
          {cvFile && !cvExtracting && (
            <p className="text-xs text-slate2-400 mt-2 flex items-center justify-center gap-1"><Sparkles size={12} /> Champs pré-remplis à vérifier ci-dessous avant d'enregistrer.</p>
          )}
        </div>
      )}
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
