import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Archive, Mail, Phone, MapPin, UploadCloud, FileText, Download,
  Trash2, Sparkles, Briefcase,
} from 'lucide-react';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabaseClient';
import { Loading, EmptyState, Avatar, Modal, Field } from '../../components/ui';
import StatusBadge from '../../components/StatusBadge';
import TechCloud from '../../components/TechCloud';
import CandidatFormModal from '../../components/CandidatFormModal';
import { useToast } from '../../lib/ToastContext';
import { useConfirm } from '../../lib/ConfirmContext';
import { formatDate } from '../../lib/format';

export default function CandidatDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [candidat, setCandidat] = useState(null);
  const [tab, setTab] = useState('profil');
  const [editOpen, setEditOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extraction, setExtraction] = useState(null);
  const fileInput = useRef(null);
  const toast = useToast();
  const confirm = useConfirm();

  const load = () => api.get(`/candidats/${id}`).then(setCandidat);
  useEffect(() => { load(); }, [id]);

  if (!candidat) return <Loading />;

  const archive = async () => {
    if (!(await confirm({ title: 'Archiver ce candidat ?', message: `${candidat.prenom} ${candidat.nom} sera archivé.`, confirmLabel: 'Archiver' }))) return;
    await api.del(`/candidats/${id}`);
    toast('Candidat archivé.', 'success');
    navigate('/candidats');
  };

  const uploadCv = async (file) => {
    if (!file || file.type !== 'application/pdf') return toast('Seuls les fichiers PDF sont acceptés.', 'error');
    setUploading(true);
    const fd = new FormData();
    fd.append('cv', file);
    try {
      const cv = await api.post(`/candidats/${id}/cv`, fd);
      toast('CV déposé avec succès.', 'success');
      load();
      const { suggestion, note } = await api.post(`/candidats/${id}/cv/${cv.id}/extract`, {});
      setExtraction({ cvId: cv.id, suggestion, note });
    } catch (err) {
      toast(err.message, 'error');
    } finally { setUploading(false); }
  };

  const deleteCv = async (cvId) => {
    if (!(await confirm({ title: 'Supprimer ce CV ?', danger: true, message: 'Le fichier sera définitivement supprimé.' }))) return;
    await api.del(`/candidats/${id}/cv/${cvId}`);
    toast('CV supprimé.', 'success');
    load();
  };

  const applyExtraction = async (fields) => {
    await api.put(`/candidats/${id}`, fields);
    toast('Fiche mise à jour à partir du CV.', 'success');
    setExtraction(null);
    load();
  };

  const activeCv = candidat.cvs.find((c) => c.active);

  const downloadCv = async (cv) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      const res = await fetch(`/api/candidats/${id}/cv/${cv.id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Téléchargement impossible.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = cv.original_name || 'cv.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate2-500 hover:text-brand">
        <ArrowLeft size={14} /> Retour
      </button>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar prenom={candidat.prenom} nom={candidat.nom} size={56} />
            <div>
              <h1 className="text-xl font-heading font-semibold text-slate2-900">{candidat.prenom} {candidat.nom}</h1>
              <p className="text-slate2-500 text-sm">{candidat.intitule_profil || candidat.metier || 'Profil non renseigné'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge category="candidat_status" value={candidat.statut} />
            <button className="btn btn-secondary" onClick={() => setEditOpen(true)}><Pencil size={14} /> Modifier</button>
            <button className="btn btn-danger" onClick={archive}><Archive size={14} /> Archiver</button>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-slate2-100 text-sm">
          <InfoRow icon={Mail} value={candidat.email} href={candidat.email ? `mailto:${candidat.email}` : null} />
          <InfoRow icon={Phone} value={candidat.telephone} href={candidat.telephone ? `tel:${candidat.telephone}` : null} />
          <InfoRow icon={MapPin} value={candidat.localisation} />
        </div>
        <div className="grid sm:grid-cols-4 gap-3 mt-4 text-xs text-slate2-500">
          <div>Métier : <span className="text-slate2-700">{candidat.metier || '—'}</span></div>
          <div>Expérience : <span className="text-slate2-700">{candidat.annees_experience ?? '—'} an(s)</span></div>
          <div>Disponibilité : <span className="text-slate2-700">{candidat.disponibilite || '—'} {candidat.disponibilite_date ? `(${formatDate(candidat.disponibilite_date)})` : ''}</span></div>
          <div>TJM : <span className="text-slate2-700">{candidat.tjm ? `${candidat.tjm} €` : '—'}</span></div>
          <div>Mobilité : <span className="text-slate2-700">{candidat.mobilite || '—'}</span></div>
          <div>Anglais : <span className="text-slate2-700">{candidat.niveau_anglais || '—'}</span></div>
          <div>Secteurs : <span className="text-slate2-700">{candidat.secteurs || '—'}</span></div>
          <div>Source : <span className="text-slate2-700">{candidat.source || '—'}</span></div>
        </div>
        {candidat.competences_principales && <p className="text-sm text-slate2-600 mt-3">{candidat.competences_principales}</p>}
        {candidat.notes && <div className="mt-3 p-3 bg-slate2-50 rounded-xl text-sm text-slate2-700 whitespace-pre-wrap">{candidat.notes}</div>}
      </div>

      <div className="card p-6">
        <h2 className="font-heading font-semibold text-slate2-900 mb-3">Environnement technique</h2>
        <TechCloud technologies={candidat.technologies.map((t) => ({ ...t, weight: 1 }))} size="lg" />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex border-b border-slate2-100">
          <TabBtn active={tab === 'profil'} onClick={() => setTab('profil')}>CV</TabBtn>
          <TabBtn active={tab === 'positionnements'} onClick={() => setTab('positionnements')}>Positionnements ({candidat.positionnements.length})</TabBtn>
        </div>

        {tab === 'profil' && (
          <div className="p-6">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); uploadCv(e.dataTransfer.files[0]); }}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${dragOver ? 'border-brand bg-brand-50' : 'border-slate2-200'}`}
            >
              <UploadCloud size={28} className="mx-auto text-brand mb-2" />
              <p className="text-sm text-slate2-600">Glissez-déposez un CV au format PDF, ou</p>
              <button className="btn btn-secondary mt-2" onClick={() => fileInput.current?.click()} disabled={uploading}>
                {uploading ? 'Envoi en cours...' : 'Parcourir'}
              </button>
              <input ref={fileInput} type="file" accept="application/pdf" hidden onChange={(e) => uploadCv(e.target.files[0])} />
            </div>

            {candidat.cvs.length > 0 && (
              <div className="mt-5 space-y-2">
                {candidat.cvs.map((cv) => (
                  <div key={cv.id} className="flex items-center justify-between p-3 rounded-xl border border-slate2-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={18} className="text-brand shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate2-800 truncate">{cv.original_name}</p>
                        <p className="text-xs text-slate2-400">
                          {cv.active ? 'Version actuelle' : 'Version précédente'} — ajouté le {formatDate(cv.uploaded_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button className="btn btn-ghost !px-2 !py-1" onClick={() => downloadCv(cv)}><Download size={14} /></button>
                      <button className="btn btn-ghost !px-2 !py-1 text-red-500" onClick={() => deleteCv(cv.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'positionnements' && (
          <div className="p-6">
            {candidat.positionnements.length === 0 ? (
              <EmptyState icon={Briefcase} title="Aucun positionnement" description="Ce candidat n'a pas encore été positionné sur un besoin." />
            ) : (
              <div className="space-y-2">
                {candidat.positionnements.map((p) => (
                  <Link key={p.id} to={`/besoins/${p.besoin_id}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate2-50 border border-slate2-100">
                    <div>
                      <p className="text-sm font-medium text-slate2-800">{p.besoin_titre}</p>
                      <p className="text-xs text-slate2-400">{p.entreprise_nom} — {p.besoin_reference} — {formatDate(p.date_positionnement)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.score_compatibilite !== null && <span className="text-xs font-semibold text-brand">{Math.round(p.score_compatibilite)}%</span>}
                      <StatusBadge category="positionnement_status" value={p.statut} small />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <CandidatFormModal open={editOpen} onClose={() => setEditOpen(false)} candidat={candidat} onSaved={load} />

      <Modal open={!!extraction} onClose={() => setExtraction(null)} title="Informations extraites du CV" wide>
        {extraction && (
          <ExtractionReview extraction={extraction} onValidate={applyExtraction} onCancel={() => setExtraction(null)} />
        )}
      </Modal>
    </div>
  );
}

function ExtractionReview({ extraction, onValidate, onCancel }) {
  const [fields, setFields] = useState({
    email: extraction.suggestion.email || '',
    telephone: extraction.suggestion.telephone || '',
    annees_experience: extraction.suggestion.annees_experience || '',
    intitule_profil: extraction.suggestion.intitule_profil || '',
  });
  return (
    <div>
      <div className="flex items-start gap-2 p-3 bg-brand-50 rounded-xl text-sm text-brand-700 mb-4">
        <Sparkles size={16} className="mt-0.5 shrink-0" />
        <p>{extraction.note}</p>
      </div>
      <div className="grid md:grid-cols-2 gap-x-4">
        <Field label="E-mail détecté"><input className="input" value={fields.email} onChange={(e) => setFields((f) => ({ ...f, email: e.target.value }))} /></Field>
        <Field label="Téléphone détecté"><input className="input" value={fields.telephone} onChange={(e) => setFields((f) => ({ ...f, telephone: e.target.value }))} /></Field>
        <Field label="Années d'expérience détectées"><input className="input" value={fields.annees_experience} onChange={(e) => setFields((f) => ({ ...f, annees_experience: e.target.value }))} /></Field>
        <Field label="Intitulé détecté"><input className="input" value={fields.intitule_profil} onChange={(e) => setFields((f) => ({ ...f, intitule_profil: e.target.value }))} /></Field>
      </div>
      <div className="flex justify-end gap-2 mt-2">
        <button className="btn btn-ghost" onClick={onCancel}>Ignorer</button>
        <button className="btn btn-primary" onClick={() => onValidate(fields)}>Valider et mettre à jour la fiche</button>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, value, href }) {
  if (!value) return <div className="flex items-center gap-2 text-slate2-300"><Icon size={14} /> <span className="italic">Non renseigné</span></div>;
  const content = <><Icon size={14} /> <span className="truncate">{value}</span></>;
  return href ? <a href={href} className="flex items-center gap-2 text-brand hover:underline">{content}</a> : <div className="flex items-center gap-2 text-slate2-700">{content}</div>;
}
function TabBtn({ active, onClick, children }) {
  return <button onClick={onClick} className={`px-6 py-3.5 text-sm font-medium border-b-2 transition-colors ${active ? 'border-brand text-brand' : 'border-transparent text-slate2-500 hover:text-slate2-800'}`}>{children}</button>;
}
