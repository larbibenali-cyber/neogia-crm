import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Archive, Building2, User, MapPin, Calendar, Clock, Euro,
  Target, CheckCircle2, XCircle, Sparkles, Plus, Trash2, History, UserPlus,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Loading, EmptyState, Modal, Field, Select, Avatar } from '../../components/ui';
import StatusBadge from '../../components/StatusBadge';
import TechCloud from '../../components/TechCloud';
import BesoinFormModal from '../../components/BesoinFormModal';
import CandidatCombo from '../../components/CandidatCombo';
import { usePickLists } from '../../lib/PickListsContext';
import { useToast } from '../../lib/ToastContext';
import { useConfirm } from '../../lib/ConfirmContext';
import { formatDate, formatMoney } from '../../lib/format';

const ENTRETIEN_STATUTS = ['entretien_planifie', 'entretien_realise'];

export default function BesoinDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [besoin, setBesoin] = useState(null);
  const [tab, setTab] = useState('details');
  const [editOpen, setEditOpen] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [positionModal, setPositionModal] = useState({ open: false, candidat: null });
  const [etapeModal, setEtapeModal] = useState({ open: false, positionnement: null });
  const toast = useToast();
  const confirm = useConfirm();

  const [error, setError] = useState(null);
  const load = () => {
    setError(null);
    return api.get(`/besoins/${id}`).then(setBesoin).catch((e) => setError(e.message || 'Impossible de charger ce besoin.'));
  };
  useEffect(() => { load(); }, [id]);

  const loadSuggestions = () => api.get(`/besoins/${id}/suggestions`).then(setSuggestions).catch(() => setSuggestions([]));
  useEffect(() => { if (tab === 'suggestions' && !suggestions) loadSuggestions(); }, [tab]);

  if (error) return <EmptyState title="Impossible de charger le besoin" description={error} />;
  if (!besoin) return <Loading />;

  const archive = async () => {
    if (!(await confirm({ title: 'Clôturer / archiver ce besoin ?', message: besoin.titre }))) return;
    await api.del(`/besoins/${id}`);
    toast('Besoin archivé.', 'success');
    navigate('/besoins');
  };

  const updatePositionStatus = async (p, statut) => {
    await api.put(`/positionnements/${p.id}`, { statut });
    toast('Statut du positionnement mis à jour.', 'success');
    if (ENTRETIEN_STATUTS.includes(statut)) {
      // Redirection automatique vers la fiche du candidat, onglet Entretien, pour
      // renseigner la date et l'heure de l'entretien.
      navigate(`/candidats/${p.candidat_id}`, { state: { tab: 'entretien', focusPositionId: p.id } });
    } else {
      load();
    }
  };

  const deletePositionnement = async (p) => {
    if (!(await confirm({ title: 'Supprimer ce positionnement ?', message: `${p.candidat_prenom} ${p.candidat_nom} sera retiré de ce besoin. Cette action est irréversible.` }))) return;
    await api.del(`/positionnements/${p.id}`);
    toast('Positionnement supprimé.', 'success');
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
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <StatusBadge category="besoin_priorite" value={besoin.priorite} />
            <StatusBadge category="besoin_status" value={besoin.statut} />
            <button className="btn btn-primary" onClick={() => setPositionModal({ open: true, candidat: null })}><UserPlus size={14} /> Positionner un candidat</button>
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
                        <select className="input !py-1 !text-xs w-auto" value={p.statut} onChange={(e) => updatePositionStatus(p, e.target.value)}>
                          <PositionStatusOptions />
                        </select>
                        <button className="btn btn-ghost !py-1 !px-2 !text-xs" onClick={() => setEtapeModal({ open: true, positionnement: p })}><History size={13} /> Étape</button>
                        <button className="btn btn-ghost !py-1 !px-2 !text-xs text-red-500 hover:text-red-600" onClick={() => deletePositionnement(p)}><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs text-slate2-500 mt-2">
                      <span>Positionné le {formatDate(p.date_positionnement)}</span>
                      {p.tjm_propose && <span>TJM proposé : {formatMoney(p.tjm_propose)}</span>}
                      {p.date_entretien && <span>Entretien : {formatDate(p.date_entretien)}</span>}
                    </div>
                    {p.commentaires && <p className="text-sm text-slate2-600 mt-2">{p.commentaires}</p>}
                    {p.retour_client && <p className="text-sm text-slate2-600 mt-1 italic">Retour client : {p.retour_client}</p>}
                    {p.etapes && p.etapes.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate2-100">
                        <div className="text-xs font-semibold text-slate2-500 mb-1.5">Historique</div>
                        <ul className="space-y-1">
                          {p.etapes.map((e) => (
                            <li key={e.id} className="text-xs text-slate2-500 flex gap-2">
                              <span className="text-slate2-400 shrink-0">{formatDate(e.date_etape)}</span>
                              <span>
                                {e.statut_apres && <strong className="text-slate2-700">{e.statut_apres} — </strong>}
                                {e.commentaire_original || (e.type_etape === 'positionnement' ? 'Positionnement créé' : e.type_etape === 'changement_statut' ? 'Changement de statut' : '')}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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
        initialCandidat={positionModal.candidat}
        besoinId={besoin.id}
        onClose={() => setPositionModal({ open: false, candidat: null })}
        onSaved={() => { load(); setTab('details'); }}
      />
      <EtapeModal
        open={etapeModal.open}
        positionnement={etapeModal.positionnement}
        onClose={() => setEtapeModal({ open: false, positionnement: null })}
        onSaved={load}
      />
    </div>
  );
}

function PositionStatusOptions() {
  const { getOptions } = usePickLists();
  return getOptions('positionnement_status').map((o) => <option key={o.value} value={o.value}>{o.label}</option>);
}

function PositionnementModal({ open, initialCandidat, besoinId, onClose, onSaved }) {
  const [candidatId, setCandidatId] = useState('');
  const [statut, setStatut] = useState('positionne');
  const [date, setDate] = useState('');
  const [tjm, setTjm] = useState('');
  const [commentaires, setCommentaires] = useState('');
  const [saving, setSaving] = useState(false);
  const { getOptions } = usePickLists();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setCandidatId(initialCandidat ? initialCandidat.id : '');
      setStatut('positionne');
      setDate(new Date().toISOString().slice(0, 10));
      setTjm('');
      setCommentaires('');
    }
  }, [open, initialCandidat]);

  if (!open) return null;

  const submit = async () => {
    if (!candidatId) return toast('Merci de sélectionner un candidat.', 'error');
    setSaving(true);
    try {
      await api.post('/positionnements', {
        candidat_id: candidatId, besoin_id: besoinId, statut,
        date_positionnement: date || undefined, tjm_propose: tjm || null, commentaires,
      });
      toast('Candidat positionné sur ce besoin.', 'success');
      onSaved();
      onClose();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Positionner un candidat">
      <Field label="Candidat" required>
        {initialCandidat
          ? <div className="input flex items-center gap-2 bg-slate2-50">{initialCandidat.prenom} {initialCandidat.nom}</div>
          : <CandidatCombo value={candidatId} onChange={setCandidatId} />}
      </Field>
      <div className="grid md:grid-cols-2 gap-x-4">
        <Field label="Statut du positionnement">
          <Select value={statut} onChange={(e) => setStatut(e.target.value)}>
            {getOptions('positionnement_status').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <Field label="Date"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="TJM proposé (€)"><input type="number" className="input" value={tjm} onChange={(e) => setTjm(e.target.value)} /></Field>
      </div>
      <Field label="Commentaire"><textarea className="input" rows={3} value={commentaires} onChange={(e) => setCommentaires(e.target.value)} /></Field>
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={saving} onClick={submit}>{saving ? 'Enregistrement...' : 'Confirmer le positionnement'}</button>
      </div>
    </Modal>
  );
}

function EtapeModal({ open, positionnement, onClose, onSaved }) {
  const [date, setDate] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [nouveauStatut, setNouveauStatut] = useState('');
  const [saving, setSaving] = useState(false);
  const { getOptions } = usePickLists();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().slice(0, 10));
      setCommentaire('');
      setNouveauStatut('');
    }
  }, [open, positionnement]);

  if (!open || !positionnement) return null;

  const submit = async () => {
    setSaving(true);
    try {
      await api.post(`/positionnements/${positionnement.id}/etapes`, {
        date_etape: date, commentaire, nouveau_statut: nouveauStatut || undefined,
      });
      toast('Étape ajoutée à l\'historique.', 'success');
      onSaved();
      onClose();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Ajouter une étape — ${positionnement.candidat_prenom} ${positionnement.candidat_nom}`}>
      <Field label="Date"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Commentaire"><textarea className="input" rows={3} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} /></Field>
      <Field label="Nouveau statut (optionnel)">
        <Select value={nouveauStatut} onChange={(e) => setNouveauStatut(e.target.value)}>
          <option value="">— Ne pas changer le statut —</option>
          {getOptions('positionnement_status').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Field>
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={saving} onClick={submit}>{saving ? 'Enregistrement...' : 'Ajouter l\'étape'}</button>
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
