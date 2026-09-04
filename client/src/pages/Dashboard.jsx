import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2, UserSquare2, Briefcase, BarChart3, Plus,
  UserPlus, FilePlus2, Target, Clock, TrendingUp, ArrowRight,
} from 'lucide-react';
import { api } from '../lib/api';
import { Loading, Modal } from '../components/ui';
import StatusBadge from '../components/StatusBadge';
import { timeAgo, formatDate } from '../lib/format';

function StatCard({ icon: Icon, label, value, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="card p-5 flex items-center gap-4 text-left w-full hover:shadow-card-hover hover:-translate-y-0.5 transition-all cursor-pointer"
    >
      <div className="rounded-2xl p-3" style={{ background: `${color}18` }}>
        <Icon size={22} style={{ color }} />
      </div>
      <div>
        <div className="text-2xl font-heading font-semibold text-slate2-900">{value}</div>
        <div className="text-sm text-slate2-500">{label}</div>
      </div>
    </button>
  );
}

// Diagramme en bâtons cliquable : chaque barre ouvre (via onBarClick) la liste
// détaillée des éléments qui la composent — même tableau que celui utilisé pour
// calculer sa valeur, donc toujours cohérent avec le nombre affiché.
function ActivityBarChart({ data, onBarClick }) {
  const BAR_H = 120;
  const max = Math.max(1, ...data.map((d) => d.value));
  const moisLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-heading font-semibold text-slate2-900 flex items-center gap-2">
          <BarChart3 size={18} className="text-brand" /> Activité du mois
        </h2>
        <span className="text-xs text-slate2-400 capitalize">{moisLabel}</span>
      </div>
      <p className="text-xs text-slate2-500 mb-6">Depuis le 1er du mois en cours — cliquez sur une barre pour voir le détail</p>
      <div className="flex items-end justify-around gap-8 px-2 pb-3 border-b border-slate2-200">
        {data.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => onBarClick(d)}
            className="flex flex-col items-center flex-1 rounded-lg hover:bg-brand-50 transition-colors py-1 cursor-pointer"
            title={`Voir le détail : ${d.label}`}
          >
            <span className="text-lg font-heading font-semibold text-slate2-900 mb-1.5">{d.value}</span>
            <div
              className="w-full max-w-[64px] rounded-t-lg transition-all duration-500"
              style={{ height: Math.max(6, Math.round((d.value / max) * BAR_H)), background: d.color }}
            />
          </button>
        ))}
      </div>
      <div className="flex justify-around gap-8 px-2 mt-2.5">
        {data.map((d) => (
          <span key={d.key} className="flex-1 text-center text-xs text-slate2-500 leading-tight">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

// Liste de détail affichée dans une modale quand on clique sur une barre du
// diagramme d'activité — chaque ligne ouvre la fiche complète correspondante.
function DrillDownModal({ open, onClose, title, items, renderItem }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {(!items || items.length === 0) && <p className="text-sm text-slate2-400">Aucun élément ce mois-ci.</p>}
      {items && items.length > 0 && (
        <ul className="divide-y divide-slate2-100 max-h-[60vh] overflow-y-auto -mx-1">
          {items.map((item, i) => (
            <li key={item.id || i} className="py-1">{renderItem(item)}</li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function DrillDownRow({ to, primary, secondary }) {
  return (
    <Link to={to} className="flex items-center justify-between gap-3 group hover:bg-brand-50 -mx-1 px-3 py-2 rounded-lg transition-colors">
      <span className="text-sm text-slate2-800 group-hover:text-brand truncate">
        {primary} {secondary && <span className="text-slate2-400 font-normal">— {secondary}</span>}
      </span>
      <ArrowRight size={14} className="text-slate2-300 group-hover:text-brand shrink-0" />
    </Link>
  );
}

function ShortcutButton({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className="card p-4 flex flex-col items-start gap-2 hover:shadow-card-hover hover:-translate-y-0.5 transition-all text-left">
      <div className="rounded-xl p-2 bg-brand-50">
        <Icon size={18} className="text-brand" />
      </div>
      <span className="text-sm font-medium text-slate2-800">{label}</span>
    </button>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [drillDown, setDrillDown] = useState(null); // { key, label } | null
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/dashboard').then(setData).catch((e) => setError(e.message || 'Impossible de charger le tableau de bord.'));
  }, []);

  if (error) return <div className="card p-8 text-center text-slate2-500">{error}</div>;
  if (!data) return <Loading />;
  const {
    totaux, besoins_en_cours, derniers_echanges, dernieres_fiches, besoins_par_statut,
    besoins_prioritaires, candidats_positionnes_recemment, activite_mois, activite_mois_details,
  } = data;
  const maxStatut = Math.max(1, ...besoins_par_statut.map((b) => b.n));
  const activiteMoisData = [
    { key: 'besoins_detectes', label: 'Besoins détectés', value: activite_mois.besoins_detectes, color: '#B45309' },
    { key: 'candidats_positionnes', label: 'Candidats positionnés', value: activite_mois.candidats_positionnes, color: '#047857' },
    { key: 'entretiens_realises', label: 'Entretiens réalisés', value: activite_mois.entretiens_realises, color: '#4527EA' },
  ];

  const drillDownItems = drillDown ? (activite_mois_details?.[drillDown.key] || []) : [];
  const renderDrillDownItem = (item) => {
    if (drillDown?.key === 'besoins_detectes') {
      return <DrillDownRow to={`/besoins/${item.id}`} primary={item.titre} secondary={item.entreprise_nom} />;
    }
    // candidats_positionnes / entretiens_realises : même structure (candidat -> besoin)
    return (
      <DrillDownRow
        to={`/besoins/${item.besoin_id}`}
        primary={`${item.candidat_prenom} ${item.candidat_nom}`}
        secondary={item.besoin_titre}
      />
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-slate2-900">Tableau de bord</h1>
        <p className="text-slate2-500 text-sm mt-1">Vue d'ensemble de l'activité commerciale Neogia</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Clients (entreprises)" value={totaux.entreprises} color="#4527EA" onClick={() => navigate('/clients?view=entreprises')} />
        <StatCard icon={UserSquare2} label="Contacts" value={totaux.contacts} color="#0369A1" onClick={() => navigate('/clients?view=contacts')} />
        <StatCard icon={UserSquare2} label="Candidats" value={totaux.candidats} color="#047857" onClick={() => navigate('/candidats')} />
        <StatCard icon={Briefcase} label="Besoins ouverts" value={totaux.besoins_ouverts} color="#B45309" onClick={() => navigate('/besoins?groupe=ouverts')} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate2-500 uppercase tracking-wide mb-3">Actions rapides</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ShortcutButton icon={Plus} label="Nouveau client / contact" onClick={() => navigate('/clients?create=1')} />
          <ShortcutButton icon={UserPlus} label="Nouveau candidat" onClick={() => navigate('/candidats?create=1')} />
          <ShortcutButton icon={FilePlus2} label="Nouveau besoin" onClick={() => navigate('/besoins?create=1')} />
          <ShortcutButton icon={Target} label="Positionner un candidat" onClick={() => navigate('/besoins')} />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <h2 className="font-heading font-semibold text-slate2-900 mb-4 flex items-center gap-2"><Briefcase size={18} className="text-brand" /> Besoins détectés</h2>
          {besoins_en_cours.length === 0 && <p className="text-sm text-slate2-400">Aucun besoin détecté.</p>}
          <ul className="divide-y divide-slate2-100">
            {besoins_en_cours.map((b) => (
              <li key={b.id}>
                <Link to={`/besoins/${b.id}`} className="flex items-center justify-between gap-3 py-2.5 group hover:bg-brand-50 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate2-800 group-hover:text-brand truncate">
                      {b.titre} <span className="text-slate2-400 font-normal">— {b.entreprise_nom}</span>
                    </p>
                    <p className="text-xs text-slate2-500 mt-0.5">
                      {b.date_demarrage && <>Démarrage {formatDate(b.date_demarrage)} · </>}{b.nb_candidats} candidat(s) positionné(s)
                    </p>
                  </div>
                  <span className="shrink-0 flex items-center gap-2">
                    <StatusBadge category="besoin_priorite" value={b.priorite} small />
                    <ArrowRight size={14} className="text-slate2-300 group-hover:text-brand" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="font-heading font-semibold text-slate2-900 mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-brand" /> Derniers positionnements</h2>
          {candidats_positionnes_recemment.length === 0 && <p className="text-sm text-slate2-400">Aucun positionnement.</p>}
          <ul className="divide-y divide-slate2-100">
            {candidats_positionnes_recemment.map((p) => (
              <li key={p.id} className="py-2.5">
                <Link to={`/besoins/${p.besoin_id}`} className="flex items-center justify-between group">
                  <span className="text-sm text-slate2-800 group-hover:text-brand">{p.candidat_prenom} {p.candidat_nom} <span className="text-slate2-400">→ {p.besoin_titre}</span></span>
                  <StatusBadge category="positionnement_status" value={p.statut} small />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ActivityBarChart data={activiteMoisData} onBarClick={(d) => setDrillDown({ key: d.key, label: d.label })} />

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-heading font-semibold text-slate2-900 mb-4">Derniers échanges clients</h2>
          {derniers_echanges.length === 0 && <p className="text-sm text-slate2-400">Aucun échange enregistré.</p>}
          <ul className="divide-y divide-slate2-100">
            {derniers_echanges.map((e) => (
              <li key={e.id} className="py-2.5">
                <Link to={`/clients/contact/${e.contact_id}`} className="flex items-start justify-between gap-3 group">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate2-800 group-hover:text-brand truncate">{e.contact_prenom} {e.contact_nom} <span className="text-slate2-400 font-normal">— {e.entreprise_nom}</span></p>
                    <p className="text-xs text-slate2-500 truncate mt-0.5">{e.objet || e.compte_rendu}</p>
                  </div>
                  <span className="text-xs text-slate2-400 shrink-0 flex items-center gap-1"><Clock size={12} />{e.date_echange ? timeAgo(e.date_echange) : 'Date inconnue'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="card p-5 hover:shadow-card-hover transition-shadow cursor-pointer group/card"
          onClick={() => navigate('/besoins')}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold text-slate2-900 group-hover/card:text-brand">Besoins par statut</h2>
            <ArrowRight size={14} className="text-slate2-300 group-hover/card:text-brand" />
          </div>
          <div className="space-y-2">
            {besoins_par_statut.map((b) => (
              <div
                key={b.groupe}
                className="rounded-lg -mx-1.5 px-1.5 py-1 hover:bg-brand-50 transition-colors cursor-pointer"
                onClick={(e) => { e.stopPropagation(); navigate(`/besoins?groupe=${encodeURIComponent(b.groupe)}`); }}
                title={`Voir les besoins « ${b.groupe} »`}
              >
                <div className="flex justify-between text-xs text-slate2-500 mb-0.5">
                  <span className="font-medium text-slate2-700">{b.groupe}</span>
                  <span>{b.n}</span>
                </div>
                <div className="h-1.5 bg-slate2-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand rounded-full" style={{ width: `${(b.n / maxStatut) * 100}%` }} />
                </div>
              </div>
            ))}
            {besoins_par_statut.length === 0 && <p className="text-sm text-slate2-400">Aucun besoin enregistré.</p>}
          </div>
        </div>
      </div>

      {besoins_prioritaires && besoins_prioritaires.length > 0 && (
        <div className="card p-5">
          <h2 className="font-heading font-semibold text-slate2-900 mb-4 flex items-center gap-2"><Target size={18} className="text-brand" /> Besoins prioritaires</h2>
          <ul className="divide-y divide-slate2-100">
            {besoins_prioritaires.map((b) => (
              <li key={b.id}>
                <Link to={`/besoins/${b.id}`} className="flex items-center justify-between gap-3 py-2.5 group hover:bg-brand-50 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate2-800 group-hover:text-brand truncate">
                      {b.titre} <span className="text-slate2-400 font-normal">— {b.entreprise_nom}</span>
                    </p>
                    <p className="text-xs text-slate2-500 mt-0.5">
                      {b.priorite_motif}
                      {b.date_cle && <span> — {formatDate(b.date_cle)}</span>}
                      {' · '}{b.nb_candidats} candidat(s) positionné(s)
                    </p>
                  </div>
                  <span className="shrink-0 flex items-center gap-2">
                    <StatusBadge category="besoin_status" value={b.statut} small />
                    <ArrowRight size={14} className="text-slate2-300 group-hover:text-brand" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-heading font-semibold text-slate2-900 mb-4">Dernières fiches ajoutées</h2>
        <ul className="divide-y divide-slate2-100">
          {dernieres_fiches.map((c) => (
            <li key={c.id} className="py-2.5">
              <Link to={`/clients/contact/${c.id}`} className="flex items-center justify-between group">
                <span className="text-sm text-slate2-800 group-hover:text-brand">{c.prenom} {c.nom} <span className="text-slate2-400">— {c.entreprise_nom}</span></span>
                <ArrowRight size={14} className="text-slate2-300 group-hover:text-brand" />
              </Link>
            </li>
          ))}
          {dernieres_fiches.length === 0 && <p className="text-sm text-slate2-400">Aucune fiche.</p>}
        </ul>
      </div>

      <DrillDownModal
        open={!!drillDown}
        onClose={() => setDrillDown(null)}
        title={drillDown ? `${drillDown.label} — ce mois-ci` : ''}
        items={drillDownItems}
        renderItem={renderDrillDownItem}
      />
    </div>
  );
}
