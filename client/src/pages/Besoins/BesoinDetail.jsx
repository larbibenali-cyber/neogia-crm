import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Archive, Building2, User, MapPin, Calendar, Clock, Euro,
  Target, CheckCircle2, XCircle, Sparkles, Plus,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Loading, EmptyState, Modal, Field, Select, Avatar } from '../../components/ui';
import StatusBadge from '../../components/StatusBadge';
import TechCloud from '../../components/TechCloud';
import BesoinFormModal from '../../components/BesoinFormModal';
import { usePickLists } from '../../lib/PickListsContext';
import { useToast } from '../../lib/ToastContext';
import { useConfirm } from '../../lib/ConfirmContext';
import { formatDate, formatMoney } from '../../lib/format';

export default function BesoinDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [besoin, setBesoin] = useState(null);
  const [tab, setTab] = useState('details');
  const [editOpen, setEditOpen] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [positionModal, setPositionModal] = useState({ open: false, candidat: null });
  const toast = useToast();
  const confirm = useConfirm();

  const load = () => api.get(`/besoins/${id}`).then(setBesoin);
  useEffect(() => { load(); }, [id]);

  const loadSuggestions = () => api.get(`/besoins/${id}/suggestions`).then(setSuggestions);
  useEffect(() => { if (tab === 'suggestions' && !suggestions) loadSuggestions(); }, [tab]);

  if (!besoin) return <Loading />;

  const archive = async () => {
    if (!(await confirm({ title: 'Clôturer / archiver ce besoin ?', message: besoin.titre }))) return;
    await api.del(`/besoins/${id}`);
    toast('Besoin archivé.', 'success');
    navigate('/besoins');
  };

  const updatePositionStatus = async (posId, statut) => {
    await api.put(`/positionnements/${posId}`, { statut });
    toast('Statut du positionnement mis à jour.', 'success');
    load();
  };

  return (
    <div className="space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate2-500 hover:text-brand">
        <ArrowLeft size={14} /> Retour
      </button>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-xs font-mono text-slate2-400">{besoin.reference}</span>
            <h1 className="text-xl font-heading font-semibold text-slate2-900">{besoin.titre}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-slate2-600">
              <Link to={`/clients/entreprise/${besoin.entreprise_id}`} className="flex items-center gap-1 hover:text-brand"><Building2 size={14} />{besoin.entreprise?.nom}</Link>
              {besoin.contact && <Link to={`/clients/contact/${besoin.contact.id}`} className="flex items-center gap-1 hover:text-brand"><User size={14} />{besoin.contact.prenom} {besoin.contact.nom}</Link>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge category="besoin_priorite" value={besoin.priorite} />
            <StatusBadge category="besoin_status" value={besoin.statut} />
            <button className="btn btn-secondary" onClick={() => setEditOpen(true)}><Pencil size={14} /> Modifier</button>
            <button className="btn btn-danger" onClick={archive}><Archive size={14} /> Clôturer</button>
          </div>
        </div>

        <div className="grid sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate2-100 text-sm">
          <Info icon={MapPin} label="Localisation" value={besoin.localisation} />
          <Info icon={Clock} label="Télétravail" value={besoin.teletravail} />
          <Info icon={Calendar} label="Démarrage" value={formatDate(besoin.date_demarrage)} />
          <Info icon={Clock} label="Durée estimée" value={besoin.duree_estimee} />
          <Info icon={Euro} label="TJM client" value={formatMoney(besoin.tjm_client)} />
          <Info icon={Euro} label="TJM candidat" value={formatMoney(besoin.tjm_candidat)} />
          <Info icon={Euro} label="Marge estimée" value={formatMoney(besoin.marge_estimee)} highlight />
          <Info icon={Calendar} label="Date limite de réponse" value={formatDate(besoin.date_limite_reponse)} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-6">
            <h2 className="font-heading font-semibold text-slate2-900 mb-2">Contexte</h2>
            <p className="text-sm text-slate2-600 whitespace-pre-wrap">{besoin.description_contexte || '—'}</p>
            <h2 className="font-heading font-semibold text-slate2-900 mb-2 mt-4">Missions attendues</h2>
            <p className="text-sm text-slate2-600 whitespace-pre-wrap">{besoin.missions || '—'}</p>
            <h2 className="font-heading font-semibold text-slate2-900 mb-2 mt-4">Niveau d'expérience recherché</h2>
            <p className="text-sm text-slate2-600">{besoin.niveau_experience || '—'}</p>
            {besoin.notes_internes && (
              <>
                <h2 className="font-heading font-semibold text-slate2-900 mb-2 mt-4">Notes internes</h2>
                <p className="text-sm text-slate2-600 whitespace-pre-wrap">{besoin.notes_internes}</p>
              </>
            )}
          </div>
          <div className="card p-6">
            <h2 className="font-heading font-semibold text-slate2-900 mb-3">Compétences / environnement technique</h2>
            <TechCloud technologies={besoin.technologies.map((t) => ({ ...t, weight: t.obligatoire ? 3 : 1 }))} size="lg" />
          </div>
        </div>

        <div className="card p-5 h-fit">
          <h2 className="font-heading font-semibold text-slate2-900 mb-1">Informations</h2>
          <dl className="text-sm space-y-2 mt-3">
            <Row label="Source" value={besoin.source} />
            <Row label="Créé le" value={formatDate(besoin.created_at)} />
            <Row label="Dernière modification" value={formatDate(besoin.updated_at)} />
          </dl>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex border-b border-slate2-100">
          <TabBtn active={tab === 'details'} onClick={() => setTab('details')}>Positionnements ({besoin.positionnements.length})</TabBtn>
          <TabBtn active={tab === 'suggestions'} onClick={() => setTab('suggestions')}>Suggestions de candidats</TabBtn>
        </div>

        {tab === 'details' && (
          <div className="p-6">
            {besoin.positionnements.length === 0 ? (
              <EmptyState icon={Target} title="Aucun candidat positionné" description="Utilisez l'onglet Suggestions pour trouver des candidats pertinents." />
            ) : (
              <div className="space-y-3">
                {besoin.positionnements.map((p) => (
                  <div key={p.id} className="border border-slate2-100 rounded-xl p-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <Link to={`/candidats/${p.candidat_id}`} className="flex items-center gap-2 font-medium text-slate2-800 hover:text-brand">
                        <Avatar prenom={p.candidat_prenom} nom={p.candidat_nom} size={30} />
                        {p.candidat_prenom} {p.candidat_nom}
                      </Link>
                      <div className="flex items-center gap-2">
                        {p.score_compatibilite !== null && <span className="text-xs font-semibold text-brand">{Math.round(p.score_compatibilite)}% compatibilité</span>}
                        <select className="input !py-1 !text-xs w-auto" value={p.statut} onChange={(e) => updatePositionStatus(p.id, e.target.value)}>
                          <PositionStatusOptions />
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs text-slate2-500 mt-2">
                      <span>Positionné le {formatDate(p.date_positionnement)}</span>
                      {p.tjm_propose && <span>TJM proposé : {formatMoney(p.tjm_propose)}</span>}
                      {p.date_entretien && <span>Entretien : {formatDate(p.date_entretien)}</span>}
                    </div>
                    {p.commentaires && <p className="text-sm text-slate2-600 mt-2">{p.commentaires}</p>}
                    {p.retour_client && <p className="text-sm text-slate2-600 mt-1 italic">Retour client : {p.retour_client}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'suggestions' && (
          <div className="p-6">
            <p className="text-xs text-slate2-500 mb-4 flex items-center gap-1"><Sparkles size={13} className="text-brand" /> Suggestions à titre indicatif — le positionnement reste toujours une décision manuelle.</p>
            {!suggestions ? <Loading /> : suggestions.length === 0 ? <EmptyState title="Aucun candidat en base" /> : (
              <div className="space-y-3">
                {suggestions.map(({ candidat, score, matched, missing }) => (
                  <div key={candidat.id} className="border border-slate2-100 rounded-xl p-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <Link to={`/candidats/${candidat.id}`} className="flex items-center gap-2 font-medium text-slate2-800 hover:text-brand">
                        <Avatar prenom={candidat.prenom} nom={candidat.nom} size={30} />
                        {candidat.prenom} {candidat.nom}
                        <span className="text-xs text-slate2-400 font-normal">{candidat.metier}</span>
                      </Link>
                      <div className="flex items-center gap-2">
                        <ScorePill score={score} />
                        <button className="btn btn-secondary" onClick={() => setPositionModal({ open: true, candidat })}><Plus size={13} /> Positionner</button>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2 mt-2 text-xs">
                      {matched.length > 0 && (
                        <div className="flex items-start gap-1.5 text-emerald-600">
                          <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
                          <span>{matched.join(' · ')}</span>
                        </div>
                      )}
                      {missing.length > 0 && (
                        <div className="flex items-start gap-1.5 text-amber-600">
                          <XCircle size={13} className="mt-0.5 shrink-0" />
                          <span>Manque : {missing.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <BesoinFormModal open={editOpen} onClose={() => setEditOpen(false)} besoin={besoin} onSaved={load} />
      <PositionnementModal
        open={positionModal.open}
        candidat={positionModal.candidat}
        besoinId={besoin.id}
        onClose={() => setPositionModal({ open: false, candidat: null })}
        onSaved={() => { load(); setTab('details'); }}
      />
    </div>
  );
}

function PositionStatusOptions() {
  const { getOptions } = usePickLists();
  return getOptions('positionnement_status').map((o) => <option key={o.value} value={o.value}>{o.label}</option>);
}

function PositionnementModal({ open, candidat, besoinId, onClose, onSaved }) {
  const [tjm, setTjm] = useState('');
  const [commentaires, setCommentaires] = useState('');
  const toast = useToast();
  useEffect(() => { setTjm(''); setCommentaires(''); }, [open]);
  if (!candidat) return null;
  const submit = async () => {
    try {
      await api.post('/positionnements', { candidat_id: candidat.id, besoin_id: besoinId, tjm_propose: tjm || null, commentaires });
      toast(`${candidat.prenom} ${candidat.nom} positionné sur ce besoin.`, 'success');
      onSaved();
      onClose();
    } catch (err) { toast(err.message, 'error'); }
  };
  return (
    <Modal open={open} onClose={onClose} title={`Positionner ${candidat.prenom} ${candidat.nom}`}>
      <Field label="TJM proposé (€)"><input type="number" className="input" value={tjm} onChange={(e) => setTjm(e.target.value)} /></Field>
      <Field label="Commentaires internes"><textarea className="input" rows={3} value={commentaires} onChange={(e) => setCommentaires(e.target.value)} /></Field>
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={submit}>Confirmer le positionnement</button>
      </div>
    </Modal>
  );
}

function ScorePill({ score }) {
  const color = score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#EF4444';
  return (
    <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ color, background: `${color}18` }}>
      {score}% compatible
    </span>
  );
}

function Info({ icon: Icon, label, value, highlight }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-slate2-400 text-xs mb-0.5"><Icon size={12} />{label}</div>
      <div className={highlight ? 'font-semibold text-brand' : 'text-slate2-700'}>{value || '—'}</div>
    </div>
  );
}
function Row({ label, value }) {
  return <div className="flex justify-between"><dt className="text-slate2-500">{label}</dt><dd className="text-slate2-800 font-medium">{value || '—'}</dd></div>;
}
function TabBtn({ active, onClick, children }) {
  return <button onClick={onClick} className={`px-6 py-3.5 text-sm font-medium border-b-2 transition-colors ${active ? 'border-brand text-brand' : 'border-transparent text-slate2-500 hover:text-slate2-800'}`}>{children}</button>;
}
