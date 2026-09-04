import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  History, Search, X, Building2,
  Phone as PhoneIcon, Mail as MailIcon, Linkedin, Users, Video, MessageCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { Loading, EmptyState } from '../components/ui';
import { usePickLists } from '../lib/PickListsContext';
import { OBJET_PRESETS } from '../components/EchangeFormModal';

const TYPE_ICONS = { appel: PhoneIcon, email: MailIcon, linkedin: Linkedin, reunion: Users, visio: Video, autre: MessageCircle };

// Clé de regroupement "YYYY-MM-DD" à partir de la date d'échange (ou, à
// défaut, de la date de création) — comparaisons/tri lexicaux sûrs car au
// format ISO.
function dayKey(dateEchange, createdAt) {
  const raw = dateEchange || createdAt || '';
  return raw.slice(0, 10);
}

// Heure "HH:MM" si l'échange en porte une (datetime-local), sinon null —
// dérivée directement de la chaîne brute pour ne pas dépendre du rendu
// (potentiellement variable selon l'environnement) de toLocaleDateString.
function timePart(dateEchange) {
  const raw = dateEchange || '';
  if (raw.includes('T')) return raw.split('T')[1]?.slice(0, 5) || null;
  if (raw.includes(' ')) return raw.split(' ')[1]?.slice(0, 5) || null;
  return null;
}

function localDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Libellé du bandeau de jour : "Aujourd'hui" / "Hier" / date complète en
// toutes lettres — calculé en heure locale pour que la frontière de jour
// corresponde à celle vécue par l'utilisateur (pas UTC).
function dayLabel(key) {
  const now = new Date();
  const todayKey = localDateKey(now);
  const yesterdayKey = localDateKey(new Date(now.getTime() - 86400000));
  if (key === todayKey) return "Aujourd'hui";
  if (key === yesterdayKey) return 'Hier';
  if (!key) return 'Date inconnue';
  const d = new Date(`${key}T00:00:00`);
  if (isNaN(d.getTime())) return 'Date inconnue';
  const label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function Echanges() {
  const [echanges, setEchanges] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [objet, setObjet] = useState('');
  const { getOptions, getLabel } = usePickLists();

  const load = useCallback(() => {
    api.get('/echanges')
      .then(setEchanges)
      .catch((e) => setError(e.message || 'Impossible de charger les échanges.'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!echanges) return [];
    const q = search.trim().toLowerCase();
    return echanges.filter((e) => {
      if (type && e.type !== type) return false;
      // Le filtre "Objet" retrouve les échanges déjà enregistrés sous cet objet
      // (ex. "Rendez-vous") — comparaison insensible à la casse/aux espaces pour
      // couvrir les échanges saisis avant l'ajout des presets ou légèrement
      // différents (ex. "rendez-vous", "Rendez vous").
      if (objet && (e.objet || '').trim().toLowerCase() !== objet.toLowerCase()) return false;
      if (!q) return true;
      const hay = `${e.contact_prenom} ${e.contact_nom} ${e.entreprise_nom} ${e.objet || ''} ${e.compte_rendu || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [echanges, search, type, objet]);

  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach((e) => {
      const key = dayKey(e.date_echange, e.created_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  if (error) return <EmptyState title="Impossible de charger les échanges" description={error} />;
  if (!echanges) return <Loading />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-slate2-900 flex items-center gap-2">
          <History size={22} className="text-brand" /> Journal des échanges
        </h1>
        <p className="text-slate2-500 text-sm mt-1">
          {filtered.length} échange{filtered.length !== 1 ? 's' : ''}{(search || type || objet) ? ' trouvé(s)' : ''} — récapitulatif jour par jour, toutes entreprises confondues
        </p>
      </div>

      <div className="card p-4">
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate2-300" />
            <input
              className="input pl-9"
              placeholder="Rechercher (contact, entreprise, objet, compte-rendu...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Tous les types</option>
            {getOptions('echange_type').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="input w-auto" value={objet} onChange={(e) => setObjet(e.target.value)}>
            <option value="">Tous les objets</option>
            {OBJET_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          {(search || type || objet) && (
            <button className="btn btn-ghost text-red-500" onClick={() => { setSearch(''); setType(''); setObjet(''); }}>
              <X size={14} /> Réinitialiser
            </button>
          )}
        </div>
      </div>

      {groups.length === 0 && (
        <EmptyState
          icon={History}
          title="Aucun échange trouvé"
          description={echanges.length === 0 ? "Aucun échange n'a encore été enregistré." : 'Essayez d\'ajuster votre recherche ou vos filtres.'}
        />
      )}

      {groups.map(([key, items]) => (
        <div key={key} className="card p-0 overflow-hidden">
          <div className="px-5 py-3 bg-slate2-50 border-b border-slate2-100 flex items-center justify-between">
            <h2 className="text-sm font-heading font-semibold text-slate2-800">{dayLabel(key)}</h2>
            <span className="text-xs text-slate2-400">{items.length} échange{items.length > 1 ? 's' : ''}</span>
          </div>
          <ul className="divide-y divide-slate2-100">
            {items.map((e) => {
              const Icon = TYPE_ICONS[e.type] || MessageCircle;
              const t = timePart(e.date_echange);
              return (
                <li key={e.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-50 shrink-0 mt-0.5">
                      <Icon size={14} className="text-brand" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link to={`/clients/contact/${e.contact_id}`} className="text-sm font-semibold text-slate2-800 hover:text-brand">
                            {e.contact_prenom} {e.contact_nom}
                          </Link>
                          <Link to={`/clients/entreprise/${e.entreprise_id}`} className="flex items-center gap-1 text-xs text-slate2-400 hover:text-brand">
                            <Building2 size={11} /> {e.entreprise_nom}
                          </Link>
                          <span className="tech-tag bg-slate2-100 text-slate2-600">{getLabel('echange_type', e.type)}</span>
                        </div>
                        {t && <span className="text-xs text-slate2-400 shrink-0">{t}</span>}
                      </div>
                      {e.objet && <p className="text-sm font-medium text-slate2-700 mt-1">{e.objet}</p>}
                      {e.compte_rendu && <p className="text-sm text-slate2-600 mt-1 whitespace-pre-wrap">{e.compte_rendu}</p>}
                      {e.prochaine_action && <p className="text-xs text-brand-700 mt-1">Prochaine action : {e.prochaine_action}</p>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
