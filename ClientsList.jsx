import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Filter, Mail, Phone, ArrowUpDown, Download, X, Archive } from 'lucide-react';
import { api, qs, downloadFile } from '../../lib/api';
import { Loading, Pagination, EmptyState, Avatar } from '../../components/ui';
import StatusBadge from '../../components/StatusBadge';
import { TechTag } from '../../components/TechCloud';
import ContactFormModal from '../../components/ContactFormModal';
import { usePickLists } from '../../lib/PickListsContext';
import { formatDate } from '../../lib/format';
import { useToast } from '../../lib/ToastContext';

export default function ClientsList() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [modalOpen, setModalOpen] = useState(params.get('create') === '1');
  const [editing, setEditing] = useState(null);
  const { getOptions } = usePickLists();
  const toast = useToast();

  const filters = {
    search: params.get('search') || '',
    statut: params.get('statut') || '',
    fonction: params.get('fonction') || '',
    tech: params.get('tech') || '',
    tech_mode: params.get('tech_mode') || 'any',
    incomplete: params.get('incomplete') || '',
    sort: params.get('sort') || 'nom',
    sortDir: params.get('sortDir') || 'asc',
    page: parseInt(params.get('page') || '1', 10),
  };

  const load = () => {
    setLoading(true);
    api.get(`/contacts${qs({ ...filters, pageSize: 25 })}`).then((d) => { setData(d); setLoading(false); });
  };

  useEffect(() => { load(); }, [params]);

  const updateParam = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };

  const toggleSort = (col) => {
    if (filters.sort === col) updateParam({ sort: col, sortDir: filters.sortDir === 'asc' ? 'desc' : 'asc' });
    else updateParam({ sort: col, sortDir: 'asc' });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-slate2-900">Clients</h1>
          <p className="text-slate2-500 text-sm mt-1">{data ? `${data.total} contact(s)` : '...'}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => downloadFile('/export/contacts.xlsx', 'contacts.xlsx').catch((e) => toast(e.message, 'error'))}><Download size={16} /> Exporter</button>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={16} /> Nouveau contact</button>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex gap-3 items-center flex-wrap">
          <input
            className="input flex-1 min-w-[240px]"
            placeholder="Rechercher (nom, e-mail, téléphone, entreprise, fonction...)"
            defaultValue={filters.search}
            onChange={(e) => updateParam({ search: e.target.value })}
          />
          <button className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowFilters((s) => !s)}>
            <Filter size={16} /> Filtres
          </button>
          {(filters.statut || filters.fonction || filters.tech || filters.incomplete) && (
            <button className="btn btn-ghost text-red-500" onClick={() => setParams({})}>
              <X size={14} /> Réinitialiser
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate2-100">
            <div>
              <label className="text-xs font-medium text-slate2-500">Statut</label>
              <select className="input mt-1" value={filters.statut} onChange={(e) => updateParam({ statut: e.target.value })}>
                <option value="">Tous</option>
                {getOptions('contact_status').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate2-500">Fonction</label>
              <input className="input mt-1" defaultValue={filters.fonction} onChange={(e) => updateParam({ fonction: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate2-500">Environnement technique (séparé par virgules)</label>
              <input className="input mt-1" placeholder="ex: Power BI, Azure" defaultValue={filters.tech} onChange={(e) => updateParam({ tech: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate2-500">Mode de combinaison technique</label>
              <select className="input mt-1" value={filters.tech_mode} onChange={(e) => updateParam({ tech_mode: e.target.value })}>
                <option value="any">Au moins une (OU)</option>
                <option value="all">Toutes (ET)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {loading && <Loading />}
      {!loading && data && data.results.length === 0 && (
        <EmptyState title="Aucun contact trouvé" description="Essayez d'ajuster votre recherche ou vos filtres." />
      )}

      {!loading && data && data.results.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate2-50 text-left text-slate2-500 text-xs uppercase tracking-wide">
                  <Th label="Contact" col="nom" current={filters.sort} dir={filters.sortDir} onClick={toggleSort} />
                  <Th label="Entreprise" col="entreprise_nom" current={filters.sort} dir={filters.sortDir} onClick={toggleSort} />
                  <th className="px-4 py-3">Fonction</th>
                  <th className="px-4 py-3">Coordonnées</th>
                  <th className="px-4 py-3">Environnement tech.</th>
                  <Th label="Statut" col="statut" current={filters.sort} dir={filters.sortDir} onClick={toggleSort} />
                  <Th label="Dernier échange" col="dernier_echange_at" current={filters.sort} dir={filters.sortDir} onClick={toggleSort} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate2-100">
                {data.results.map((c) => (
                  <tr key={c.id} className="hover:bg-slate2-50/60">
                    <td className="px-4 py-3">
                      <Link to={`/clients/contact/${c.id}`} className="flex items-center gap-2.5 group">
                        <Avatar prenom={c.prenom} nom={c.nom} size={32} />
                        <div>
                          <div className="font-medium text-slate2-800 group-hover:text-brand">{c.prenom} {c.nom}</div>
                          {c.incomplete && <div className="text-[11px] text-amber-600">Fiche incomplète</div>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/clients/entreprise/${c.entreprise_id}`} className="text-slate2-700 hover:text-brand">{c.entreprise_nom}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate2-600">{c.fonction || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-brand hover:underline text-xs"><Mail size={12} />{c.email}</a>}
                        {(c.telephone_mobile || c.telephone_fixe) && (
                          <a href={`tel:${(c.telephone_mobile || c.telephone_fixe).split('/')[0].trim()}`} className="flex items-center gap-1 text-slate2-600 hover:text-brand text-xs">
                            <Phone size={12} />{c.telephone_mobile || c.telephone_fixe}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <div className="flex flex-wrap gap-1">
                        {(c.technologies || []).slice(0, 3).map((t) => <TechTag key={t.id} tech={t} size="sm" />)}
                        {(c.technologies || []).length > 3 && <span className="text-xs text-slate2-400">+{c.technologies.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge category="contact_status" value={c.statut} small /></td>
                    <td className="px-4 py-3 text-slate2-500 text-xs">{formatDate(c.dernier_echange_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4">
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(p) => updateParam({ page: p })} />
          </div>
        </div>
      )}

      <ContactFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        contact={editing}
        onSaved={load}
      />
    </div>
  );
}

function Th({ label, col, current, dir, onClick }) {
  return (
    <th className="px-4 py-3 cursor-pointer select-none" onClick={() => onClick(col)}>
      <span className="inline-flex items-center gap-1">{label} <ArrowUpDown size={12} className={current === col ? 'text-brand' : 'text-slate2-300'} /></span>
    </th>
  );
}
