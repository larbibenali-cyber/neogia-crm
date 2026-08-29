import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Filter, Download, X, MapPin } from 'lucide-react';
import { api, qs, downloadFile } from '../../lib/api';
import { Loading, Pagination, EmptyState, Avatar } from '../../components/ui';
import StatusBadge from '../../components/StatusBadge';
import { TechTag } from '../../components/TechCloud';
import CandidatFormModal from '../../components/CandidatFormModal';
import { usePickLists } from '../../lib/PickListsContext';
import { useToast } from '../../lib/ToastContext';

export default function CandidatsList() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [modalOpen, setModalOpen] = useState(params.get('create') === '1');
  const { getOptions } = usePickLists();
  const toast = useToast();

  const filters = {
    search: params.get('search') || '',
    tech: params.get('tech') || '',
    metier: params.get('metier') || '',
    disponibilite: params.get('disponibilite') || '',
    localisation: params.get('localisation') || '',
    statut: params.get('statut') || '',
    page: parseInt(params.get('page') || '1', 10),
  };

  const [error, setError] = useState(null);
  const load = () => {
    setLoading(true);
    setError(null);
    api.get(`/candidats${qs({ ...filters, pageSize: 24 })}`)
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message || 'Le chargement des candidats a échoué.'); setLoading(false); });
  };
  useEffect(() => { load(); }, [params]);

  const updateParam = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-slate2-900">Candidats</h1>
          <p className="text-slate2-500 text-sm mt-1">{data ? `${data.total} candidat(s)` : '...'}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => downloadFile('/export/candidats.xlsx', 'candidats.xlsx').catch((e) => toast(e.message, 'error'))}><Download size={16} /> Exporter</button>
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus size={16} /> Nouveau candidat</button>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex gap-3 items-center flex-wrap">
          <input className="input flex-1 min-w-[240px]" placeholder="Rechercher (nom, métier, compétences...)" defaultValue={filters.search} onChange={(e) => updateParam({ search: e.target.value })} />
          <button className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowFilters((s) => !s)}><Filter size={16} /> Filtres</button>
          {(filters.tech || filters.metier || filters.disponibilite || filters.localisation || filters.statut) && (
            <button className="btn btn-ghost text-red-500" onClick={() => setParams({})}><X size={14} /> Réinitialiser</button>
          )}
        </div>
        {showFilters && (
          <div className="grid md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate2-100">
            <div><label className="text-xs font-medium text-slate2-500">Environnement technique</label>
              <input className="input mt-1" placeholder="ex: Python, Azure" defaultValue={filters.tech} onChange={(e) => updateParam({ tech: e.target.value })} /></div>
            <div><label className="text-xs font-medium text-slate2-500">Métier</label>
              <input className="input mt-1" defaultValue={filters.metier} onChange={(e) => updateParam({ metier: e.target.value })} /></div>
            <div><label className="text-xs font-medium text-slate2-500">Localisation</label>
              <input className="input mt-1" defaultValue={filters.localisation} onChange={(e) => updateParam({ localisation: e.target.value })} /></div>
            <div><label className="text-xs font-medium text-slate2-500">Statut</label>
              <select className="input mt-1" value={filters.statut} onChange={(e) => updateParam({ statut: e.target.value })}>
                <option value="">Tous</option>
                {getOptions('candidat_status').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {loading && <Loading />}
      {!loading && error && <EmptyState title="Impossible de charger les candidats" description={error} />}
      {!loading && !error && data && data.results.length === 0 && <EmptyState title="Aucun candidat trouvé" description="Ajoutez votre premier candidat pour commencer." />}

      {!loading && !error && data && data.results.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.results.map((c) => (
            <Link key={c.id} to={`/candidats/${c.id}`} className="card p-5 hover:shadow-card-hover transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Avatar prenom={c.prenom} nom={c.nom} size={42} />
                  <div>
                    <p className="font-medium text-slate2-800">{c.prenom} {c.nom}</p>
                    <p className="text-xs text-slate2-500">{c.intitule_profil || c.metier || '—'}</p>
                  </div>
                </div>
                <StatusBadge category="candidat_status" value={c.statut} small />
              </div>
              <div className="flex items-center gap-3 mt-3 text-xs text-slate2-500">
                {c.localisation && <span className="flex items-center gap-1"><MapPin size={12} />{c.localisation}</span>}
                {c.annees_experience !== null && c.annees_experience !== undefined && <span>{c.annees_experience} ans d'exp.</span>}
                {c.tjm && <span>{c.tjm} €/j</span>}
              </div>
              <div className="flex flex-wrap gap-1 mt-3">
                {(c.technologies || []).slice(0, 4).map((t) => <TechTag key={t.id} tech={t} size="sm" />)}
                {(c.technologies || []).length > 4 && <span className="text-xs text-slate2-400">+{c.technologies.length - 4}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
      {!loading && !error && data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(p) => updateParam({ page: p })} />}

      <CandidatFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={load} />
    </div>
  );
}
