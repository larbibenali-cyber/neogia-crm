import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Filter, Download, X, Calendar, Building2 } from 'lucide-react';
import { api, qs, downloadFile } from '../../lib/api';
import { Loading, Pagination, EmptyState } from '../../components/ui';
import StatusBadge from '../../components/StatusBadge';
import BesoinFormModal from '../../components/BesoinFormModal';
import { usePickLists } from '../../lib/PickListsContext';
import { formatDate, formatMoney } from '../../lib/format';
import { useToast } from '../../lib/ToastContext';

export default function BesoinsList() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [modalOpen, setModalOpen] = useState(params.get('create') === '1');
  const { getOptions } = usePickLists();
  const toast = useToast();

  const [error, setError] = useState(null);

  const filters = {
    search: params.get('search') || '',
    statut: params.get('statut') || '',
    priorite: params.get('priorite') || '',
    tech: params.get('tech') || '',
    groupe: params.get('groupe') || '',
    page: parseInt(params.get('page') || '1', 10),
  };

  const load = () => {
    setLoading(true);
    setError(null);
    api.get(`/besoins${qs({ ...filters, pageSize: 20 })}`)
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message || 'Le chargement des besoins a échoué.'); setLoading(false); });
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
          <h1 className="text-2xl font-heading font-semibold text-slate2-900">Besoins</h1>
          <p className="text-slate2-500 text-sm mt-1">{data ? `${data.total} besoin(s)` : '...'}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => downloadFile('/export/besoins.xlsx', 'besoins.xlsx').catch((e) => toast(e.message, 'error'))}><Download size={16} /> Exporter</button>
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus size={16} /> Nouveau besoin</button>
        </div>
      </div>

      {filters.groupe && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm bg-brand-50 text-brand font-medium px-3 py-1.5 rounded-full">
            Statut : {filters.groupe === 'ouverts' ? 'Ouverts (À venir + En cours)' : filters.groupe}
            <button
              onClick={() => updateParam({ groupe: '' })}
              className="hover:bg-brand/10 rounded-full p-0.5 -mr-1"
              title="Retirer ce filtre"
            >
              <X size={13} />
            </button>
          </span>
        </div>
      )}

      <div className="card p-4">
        <div className="flex gap-3 items-center flex-wrap">
          <input className="input flex-1 min-w-[240px]" placeholder="Rechercher (titre, référence...)" defaultValue={filters.search} onChange={(e) => updateParam({ search: e.target.value })} />
          <button className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowFilters((s) => !s)}><Filter size={16} /> Filtres</button>
          {(filters.statut || filters.priorite || filters.tech || filters.groupe) && <button className="btn btn-ghost text-red-500" onClick={() => setParams({})}><X size={14} /> Réinitialiser</button>}
        </div>
        {showFilters && (
          <div className="grid md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate2-100">
            <div><label className="text-xs font-medium text-slate2-500">Statut</label>
              <select className="input mt-1" value={filters.statut} onChange={(e) => updateParam({ statut: e.target.value })}>
                <option value="">Tous</option>
                {getOptions('besoin_status').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div><label className="text-xs font-medium text-slate2-500">Priorité</label>
              <select className="input mt-1" value={filters.priorite} onChange={(e) => updateParam({ priorite: e.target.value })}>
                <option value="">Toutes</option>
                {getOptions('besoin_priorite').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div><label className="text-xs font-medium text-slate2-500">Environnement technique</label>
              <input className="input mt-1" placeholder="ex: Snowflake" defaultValue={filters.tech} onChange={(e) => updateParam({ tech: e.target.value })} /></div>
          </div>
        )}
      </div>

      {loading && <Loading />}
      {!loading && error && (
        <EmptyState title="Impossible de charger les besoins" description={error} />
      )}
      {!loading && !error && data && data.results.length === 0 && <EmptyState title="Aucun besoin trouvé" description="Essayez d'ajuster votre recherche ou vos filtres." />}

      {!loading && !error && data && data.results.length > 0 && (
        <div className="space-y-2">
          {data.results.map((b) => (
            <Link key={b.id} to={`/besoins/${b.id}`} className="card p-4 flex items-center justify-between gap-4 hover:shadow-card-hover transition-shadow">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate2-400">{b.reference}</span>
                  <StatusBadge category="besoin_priorite" value={b.priorite} small />
                </div>
                <p className="font-medium text-slate2-800 truncate mt-0.5">{b.titre}</p>
                <div className="flex items-center gap-3 text-xs text-slate2-500 mt-1">
                  <span className="flex items-center gap-1"><Building2 size={12} />{b.entreprise?.nom}</span>
                  {b.date_demarrage && <span className="flex items-center gap-1"><Calendar size={12} />{formatDate(b.date_demarrage)}</span>}
                  {b.tjm_client && <span>TJM client {formatMoney(b.tjm_client)}</span>}
                  <span>{b.positionnements.length} positionnement(s)</span>
                </div>
              </div>
              <StatusBadge category="besoin_status" value={b.statut} />
            </Link>
          ))}
        </div>
      )}
      {!loading && !error && data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(p) => updateParam({ page: p })} />}

      <BesoinFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={load} />
    </div>
  );
}
