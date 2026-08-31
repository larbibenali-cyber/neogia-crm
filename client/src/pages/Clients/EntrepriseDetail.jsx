import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Users, Briefcase, Mail, Phone, Camera, MessageSquare, Clock } from 'lucide-react';
import { api } from '../../lib/api';
import { Loading, EmptyState, Avatar, Field, Modal, Select } from '../../components/ui';
import StatusBadge from '../../components/StatusBadge';
import { EntrepriseLogo, EntrepriseStatusBadge, ENTREPRISE_STATUTS } from '../../components/EntrepriseBadges';
import TechCloud from '../../components/TechCloud';
import ContactFormModal from '../../components/ContactFormModal';
import BesoinFormModal from '../../components/BesoinFormModal';
import ContactPhones from '../../components/ContactPhones';
import { timeAgo } from '../../lib/format';
import { useToast } from '../../lib/ToastContext';

export default function EntrepriseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ent, setEnt] = useState(null);
  const [error, setError] = useState(null);
  const [contactModal, setContactModal] = useState(false);
  const [besoinModal, setBesoinModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [newTech, setNewTech] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef(null);
  const toast = useToast();

  const load = () => {
    setError(null);
    return api.get(`/entreprises/${id}`).then(setEnt).catch((e) => setError(e.message || "Impossible de charger cette entreprise."));
  };
  useEffect(() => { load(); }, [id]);

  if (error) return <EmptyState title="Impossible de charger l'entreprise" description={error} />;
  if (!ent) return <Loading />;

  const onLogoChosen = async (file) => {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      await api.post(`/entreprises/${id}/logo`, fd);
      toast('Logo mis à jour.', 'success');
      await load();
    } catch (e) {
      toast(e.message || "Échec de l'envoi du logo.", 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

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
        <div className="flex items-start gap-4">
          <div className="relative group">
            <EntrepriseLogo nom={ent.nom} logoUrl={ent.logo_url} size={56} />
            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadingLogo}
              title="Changer le logo"
              className="absolute -bottom-1.5 -right-1.5 bg-white border border-slate2-200 rounded-full p-1 shadow-card opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate2-50"
            >
              <Camera size={12} className="text-slate2-600" />
            </button>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => onLogoChosen(e.target.files?.[0])}
            />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-heading font-semibold text-slate2-900">{ent.nom}</h1>
              <EntrepriseStatusBadge statut={ent.statut} small />
            </div>
            <p className="text-slate2-500 text-sm mt-1">{ent.secteur || 'Secteur non renseigné'} {ent.adresse ? `— ${ent.adresse}` : ''}</p>
            <div className="flex gap-4 mt-3 text-sm text-slate2-600">
              <span className="flex items-center gap-1"><Users size={14} /> {ent.contacts_count} contact(s)</span>
              <span className="flex items-center gap-1"><Briefcase size={14} /> {ent.besoins_ouverts_count} besoin(s) ouvert(s) / {ent.besoins_count}</span>
            </div>
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
              <div
                key={c.id}
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/clients/contact/${c.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/clients/contact/${c.id}`); }}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate2-100 hover:bg-slate2-50 cursor-pointer"
              >
                <Avatar prenom={c.prenom} nom={c.nom} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate2-800 truncate">{c.prenom} {c.nom}</p>
                  <p className="text-xs text-slate2-400 truncate">{c.fonction || c.email || '—'}</p>
                  <ContactPhones contact={c} className="mt-0.5" />
                </div>
                <StatusBadge category="contact_status" value={c.statut} small />
              </div>
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

      <div className="card p-6">
        <h2 className="font-heading font-semibold text-slate2-900 mb-4 flex items-center gap-2">
          <MessageSquare size={18} className="text-brand" /> Historique des échanges ({(ent.echanges || []).length})
        </h2>
        {(!ent.echanges || ent.echanges.length === 0) ? <EmptyState title="Aucun échange enregistré" /> : (
          <ul className="divide-y divide-slate2-100">
            {ent.echanges.map((e) => (
              <li key={e.id} className="py-2.5">
                {e.contact_id ? (
                  <Link to={`/clients/contact/${e.contact_id}`} className="flex items-start justify-between gap-3 group">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate2-800 group-hover:text-brand truncate">
                        {e.contact_prenom} {e.contact_nom} <span className="text-slate2-400 font-normal">— {e.objet || 'Échange'}</span>
                      </p>
                      {e.compte_rendu && <p className="text-xs text-slate2-500 truncate mt-0.5">{e.compte_rendu}</p>}
                    </div>
                    <span className="text-xs text-slate2-400 shrink-0 flex items-center gap-1"><Clock size={12} />{e.date_echange ? timeAgo(e.date_echange) : 'Date inconnue'}</span>
                  </Link>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate2-800 truncate">{e.objet || 'Échange'}</p>
                      {e.compte_rendu && <p className="text-xs text-slate2-500 truncate mt-0.5">{e.compte_rendu}</p>}
                    </div>
                    <span className="text-xs text-slate2-400 shrink-0 flex items-center gap-1"><Clock size={12} />{e.date_echange ? timeAgo(e.date_echange) : 'Date inconnue'}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
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
    try {
      await api.put(`/entreprises/${entreprise.id}`, form);
      toast('Entreprise mise à jour.', 'success');
      onSaved();
      onClose();
    } catch (e) {
      toast(e.message || 'Échec de la mise à jour.', 'error');
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Modifier l'entreprise">
      <Field label="Nom"><input className="input" value={form.nom || ''} onChange={set('nom')} /></Field>
      <Field label="Statut">
        <Select value={form.statut || 'prospect'} onChange={set('statut')}>
          {ENTREPRISE_STATUTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Field>
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
