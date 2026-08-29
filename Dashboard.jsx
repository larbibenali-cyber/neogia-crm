import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2, UserSquare2, Briefcase, AlertCircle, Plus, MessageSquarePlus,
  UserPlus, FilePlus2, Target, Clock, TrendingUp, ArrowRight,
} from 'lucide-react';
import { api } from '../lib/api';
import { Loading } from '../components/ui';
import StatusBadge from '../components/StatusBadge';
import { timeAgo, formatDate } from '../lib/format';

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className="rounded-2xl p-3" style={{ background: `${color}18` }}>
        <Icon size={22} style={{ color }} />
      </div>
      <div>
        <div className="text-2xl font-heading font-semibold text-slate2-900">{value}</div>
        <div className="text-sm text-slate2-500">{label}</div>
      </div>
    </div>
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
  const navigate = useNavigate();

  useEffect(() => { api.get('/dashboard').then(setData); }, []);

  if (!data) return <Loading />;
  const { totaux, besoins_urgents, derniers_echanges, dernieres_fiches, besoins_par_statut, candidats_positionnes_recemment, alertes } = data;
  const maxStatut = Math.max(1, ...besoins_par_statut.map((b) => b.n));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-slate2-900">Tableau de bord</h1>
        <p className="text-slate2-500 text-sm mt-1">Vue d'ensemble de l'activité commerciale Neogia</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Clients (entreprises)" value={totaux.entreprises} color="#4527EA" />
        <StatCard icon={UserSquare2} label="Contacts" value={totaux.contacts} color="#0369A1" />
        <StatCard icon={UserSquare2} label="Candidats" value={totaux.candidats} color="#047857" />
        <StatCard icon={Briefcase} label="Besoins ouverts" value={totaux.besoins_ouverts} color="#B45309" />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate2-500 uppercase tracking-wide mb-3">Actions rapides</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <ShortcutButton icon={Plus} label="Nouveau client / contact" onClick={() => navigate('/clients?create=1')} />
          <ShortcutButton icon={MessageSquarePlus} label="Ajouter un échange" onClick={() => navigate('/clients')} />
          <ShortcutButton icon={UserPlus} label="Nouveau candidat" onClick={() => navigate('/candidats?create=1')} />
          <ShortcutButton icon={FilePlus2} label="Nouveau besoin" onClick={() => navigate('/besoins?create=1')} />
          <ShortcutButton icon={Target} label="Positionner un candidat" onClick={() => navigate('/besoins')} />
        </div>
      </div>

      {(alertes.relances_en_retard.length > 0 || alertes.besoins_sans_candidat.length > 0 || alertes.candidats_prochainement_disponibles.length > 0 || alertes.fiches_incompletes > 0) && (
        <div className="card p-5 border-l-4 border-l-amber-400">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={18} className="text-amber-500" />
            <h2 className="font-heading font-semibold text-slate2-900">Alertes &amp; relances</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            {alertes.relances_en_retard.length > 0 && (
              <div>
                <p className="font-medium text-slate2-700 mb-1">Relances arrivées à échéance ({alertes.relances_en_retard.length})</p>
                <ul className="space-y-1">
                  {alertes.relances_en_retard.slice(0, 5).map((r) => (
                    <li key={r.id}>
                      <Link to={`/clients/contact/${r.contact_id}`} className="text-brand hover:underline">
                        {r.contact_prenom} {r.contact_nom}
                      </Link> — {r.entreprise_nom} <span className="text-slate2-400">({formatDate(r.date_relance)})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {alertes.besoins_sans_candidat.length > 0 && (
              <div>
                <p className="font-medium text-slate2-700 mb-1">Besoins sans candidat positionné ({alertes.besoins_sans_candidat.length})</p>
                <ul className="space-y-1">
                  {alertes.besoins_sans_candidat.slice(0, 5).map((b) => (
                    <li key={b.id}>
                      <Link to={`/besoins/${b.id}`} className="text-brand hover:underline">{b.titre}</Link> — {b.entreprise_nom}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {alertes.candidats_prochainement_disponibles.length > 0 && (
              <div>
                <p className="font-medium text-slate2-700 mb-1">Candidats prochainement disponibles ({alertes.candidats_prochainement_disponibles.length})</p>
                <ul className="space-y-1">
                  {alertes.candidats_prochainement_disponibles.slice(0, 5).map((c) => (
                    <li key={c.id}>
                      <Link to={`/candidats/${c.id}`} className="text-brand hover:underline">{c.prenom} {c.nom}</Link>
                      {c.disponibilite_date && <span className="text-slate2-400"> — dès le {formatDate(c.disponibilite_date)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {alertes.fiches_incompletes > 0 && (
              <div>
                <p className="font-medium text-slate2-700 mb-1">Fiches incomplètes</p>
                <Link to="/clients?incomplete=true" className="text-brand hover:underline">{alertes.fiches_incompletes} fiche(s) sans e-mail ni téléphone</Link>
              </div>
            )}
          </div>
        </div>
      )}

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

        <div className="card p-5">
          <h2 className="font-heading font-semibold text-slate2-900 mb-4">Besoins par statut</h2>
          <div className="space-y-2">
            {besoins_par_statut.map((b) => (
              <div key={b.statut}>
                <div className="flex justify-between text-xs text-slate2-500 mb-0.5">
                  <StatusBadge category="besoin_status" value={b.statut} small />
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

      <div className="grid lg:grid-cols-2 gap-5">
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

        <div className="card p-5">
          <h2 className="font-heading font-semibold text-slate2-900 mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-brand" /> Candidats récemment positionnés</h2>
          <ul className="divide-y divide-slate2-100">
            {candidats_positionnes_recemment.map((p) => (
              <li key={p.id} className="py-2.5">
                <Link to={`/besoins/${p.besoin_id}`} className="flex items-center justify-between group">
                  <span className="text-sm text-slate2-800 group-hover:text-brand">{p.candidat_prenom} {p.candidat_nom} <span className="text-slate2-400">→ {p.besoin_titre}</span></span>
                  <StatusBadge category="positionnement_status" value={p.statut} small />
                </Link>
              </li>
            ))}
            {candidats_positionnes_recemment.length === 0 && <p className="text-sm text-slate2-400">Aucun positionnement.</p>}
          </ul>
        </div>
      </div>
    </div>
  );
}
