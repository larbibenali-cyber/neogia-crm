import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Users, Briefcase, Mail, Phone } from 'lucide-react';
import { api } from '../../lib/api';
import { Loading, EmptyState, Avatar, Field, Modal } from '../../components/ui';
import StatusBadge from '../../components/StatusBadge';
import TechCloud from '../../components/TechCloud';
import ContactFormModal from '../../components/ContactFormModal';
import BesoinFormModal from '../../components/BesoinFormModal';
import { useToast } from '../../lib/ToastContext';

export default function EntrepriseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ent, setEnt] = useState(null);
  const [contactModal, setContactModal] = useState(false);
  const [besoinModal, setBesoinModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [newTech, setNewTech] = useState('');
  const toast = useToast();

  const load = () => api.get(`/entreprises/${id}`).then(setEnt);
  useEffect(() => { load(); }, [id]);

  if (!ent) return <Loading />;

  const addTech = async () => {
    if (!newTech.trim()) return;
    await api.post(`/entreprises/${id}/technologies`, { technology_name: newTech.trim() });
    setNewTech('');
    load();
  };
  const removeTech = async (tech) => {
    await api.del(`/entreprises/${id}/technologies/${tech.id}`);
    load();
  };

  return (
    <div className="space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate2-500 hover:text-brand">
        <ArrowLeft size={14} /> Retour
      </button>

      <div className="card p-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-heading font-semibold text-slate2-900">{ent.nom}</h1>
          <p className="text-slate2-500 text-sm mt-1">{ent.secteur || 'Secteur non renseigné'} {ent.adresse ? `— ${ent.adresse}` : ''}</p>
          <div className="flex gap-4 mt-3 text-sm text-slate2-600">
            <span className="flex items-center gap-1"><Users size={14} /> {ent.contacts_count} contact(s)</span>
            <span className="flex items-center gap-1"><Briefcase size={14} /> {ent.besoins_count} besoin(s)</span>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={() => setEditModal(true)}><Pencil size={14} /> Modifier</button>
      </div>

      <div className="card p-6">
        <h2 className="font-heading font-semibold text-slate2-900 mb-3">Environnement technique</h2>
        <TechCloud technologies={ent.technologies} groupByCategory size="lg" removable onRemove={removeTech} />
        <div className="flex gap-2 mt-4">
          <input className="input max-w-xs" placeholder="Ajouter une technologie..." value={newTech} onChange={(e) => setNewTech(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTech()} />
          <button className="btn btn-secondary" onClick={addTech}><Plus size={14} /> Ajouter</button>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-semibold text-slate2-900">Contacts ({ent.contacts.length})</h2>
          <button className="btn btn-primary" onClick={() => setContactModal(true)}><Plus size={14} /> Nouveau contact</button>
        </div>
        {ent.contacts.length === 0 ? <EmptyState title="Aucun contact" /> : (
          <div className="grid sm:grid-cols-2 gap-3">
            {ent.contacts.map((c) => (
              <Link key={c.id} to={`/clients/contact/${c.id}`} className="flex items-center gap-3 p-3 rounded-xl border border-slate2-100 hover:bg-slate2-50">
                <Avatar prenom={c.prenom} nom={c.nom} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate2-800 truncate">{c.prenom} {c.nom}</p>
                  <p className="text-xs text-slate2-400 truncate">{c.fonction || c.email || '—'}</p>
                </div>
                <StatusBadge category="contact_status" value={c.statut} small />
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-semibold text-slate2-900">Besoins ({ent.besoins.length})</h2>
          <button className="btn btn-primary" onClick={() => setBesoinModal(true)}><Plus size={14} /> Nouveau besoin</button>
        </div>
        {ent.besoins.length === 0 ? <EmptyState title="Aucun besoin" /> : (
          <div className="space-y-2">
            {ent.besoins.map((b) => (
              <Link key={b.id} to={`/besoins/${b.id}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate2-50 border border-slate2-100">
                <div>
                  <p className="text-sm font-medium text-slate2-800">{b.titre}</p>
                  <p className="text-xs text-slate2-400">{b.reference}</p>
                </div>
                <StatusBadge category="besoin_status" value={b.statut} small />
              </Link>
            ))}
          </div>
        )}
      </div>

      <ContactFormModal open={contactModal} onClose={() => setContactModal(false)} defaultEntrepriseId={ent.id} onSaved={load} />
      <BesoinFormModal open={besoinModal} onClose={() => setBesoinModal(false)} defaults={{ entreprise_id: ent.id }} onSaved={load} />
      <EditEntrepriseModal open={editModal} onClose={() => setEditModal(false)} entreprise={ent} onSaved={load} />
    </div>
  );
}

function EditEntrepriseModal({ open, onClose, entreprise, onSaved }) {
  const [form, setForm] = useState({});
  const toast = useToast();
  useEffect(() => { if (open) setForm(entreprise); }, [open, entreprise]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async () => {
    await api.put(`/entreprises/${entreprise.id}`, form);
    toast('Entreprise mise à jour.', 'success');
    onSaved();
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Modifier l'entreprise">
      <Field label="Nom"><input className="input" value={form.nom || ''} onChange={set('nom')} /></Field>
      <Field label="Secteur"><input className="input" value={form.secteur || ''} onChange={set('secteur')} /></Field>
      <Field label="Adresse"><input className="input" value={form.adresse || ''} onChange={set('adresse')} /></Field>
      <Field label="Site web"><input className="input" value={form.site_web || ''} onChange={set('site_web')} /></Field>
      <Field label="Notes"><textarea className="input" rows={3} value={form.notes || ''} onChange={set('notes')} /></Field>
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={submit}>Enregistrer</button>
      </div>
    </Modal>
  );
}
