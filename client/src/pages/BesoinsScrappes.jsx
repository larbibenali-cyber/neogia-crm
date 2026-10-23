import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ScanSearch, Building2, ExternalLink, Check, X, RotateCcw, Calendar, MapPin, Target, Pencil, Trash2, Plus, ShieldCheck, ChevronDown, ChevronUp, Linkedin, Users,
} from 'lucide-react';
import { api, qs } from '../lib/api';
import { Loading, EmptyState, Pagination, Modal, Field } from '../components/ui';
import EntrepriseCombo from '../components/EntrepriseCombo';
import { formatDate } from '../lib/format';
import { useToast } from '../lib/ToastContext';
import { useConfirm } from '../lib/ConfirmContext';
import { AgentLauncher, AgentsSubNav, StatCard, SubFilters, useList } from './Leads';

// Page « Besoins scrappés » : annonces Data/IA lues par l'agent Claude
// « attribution-annonces » sur Free-Work, Monster, Indeed… avec, pour chacune,
// le client final probable (client cité en clair, ou probabilités calculées à
// partir des périmètres clients : noms d'équipes, technos, sites…).
// Ces annonces restent ici : elles ne sont pas créées comme des besoins.

const TABS = [
  { key: 'annonces', label: 'Annonces', icon: ScanSearch },
  { key: 'perimetres', label: 'Périmètres clients', icon: Target },
];

const PROMPTS = [
  { label: 'Scanner les annonces', text: 'Scanne les annonces Data et IA sur Free-Work, Monster et Indeed et attribue-les à nos clients' },
  { label: 'Construire les périmètres', text: 'Construis les périmètres clients à partir du CRM' },
  { label: 'Analyser une annonce', text: 'Analyse cette annonce et dis-moi de quel client elle vient : [lien]' },
];

const INDICE_LABELS = {
  client: 'Client cité', equipe: 'Équipe', direction: 'Direction', techno: 'Techno', site: 'Lieu', secteur: 'Secteur',
  projet: 'Projet', vocabulaire: 'Tournure', autre: 'Indice',
};

export default function BesoinsScrappes() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'annonces';
  const [stats, setStats] = useState(null);
  const loadStats = useCallback(() => { api.get('/annonces/stats').then(setStats).catch(() => setStats(null)); }, []);
  useEffect(() => { loadStats(); }, [loadStats]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-slate2-900">Besoins scrappés</h1>
        <p className="text-slate2-500 text-sm mt-1">Annonces Data &amp; IA des job boards et client final probable derrière chaque annonce.</p>
      </div>
      <AgentsSubNav />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={ScanSearch} label="Annonces à traiter" value={stats?.a_traiter} sub={stats ? `${stats.semaine} cette semaine` : ''} onClick={() => setParams({ tab: 'annonces' })} />
        <StatCard icon={Check} label="Attributions fortes" value={stats?.fortes} sub="client cité ou ≥ 70 %" onClick={() => setParams({ tab: 'annonces' })} />
        <StatCard icon={Target} label="Périmètres clients" value={stats?.perimetres} sub={stats ? `${stats.perimetres_a_valider} à valider` : ''} onClick={() => setParams({ tab: 'perimetres' })} />
      </div>

      <AgentLauncher
        prompts={PROMPTS}
        note="L'agent tourne dans Claude : il lit les annonces, repère les indices (client cité, nom d'équipe, technos, lieu…) et les compare aux périmètres de vos clients. Confirmez ou corrigez ses attributions : il s'en sert pour viser plus juste."
      />

      <div className="flex flex-wrap border-b border-slate2-100">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setParams({ tab: t.key })}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.key ? 'border-brand text-brand' : 'border-transparent text-slate2-500 hover:text-slate2-800'}`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'annonces' && <AnnoncesTab onChange={loadStats} />}
      {tab === 'perimetres' && <PerimetresTab onChange={loadStats} />}
    </div>
  );
}

// ------------------------------------------------------------------ annonces

function ProbaBar({ value }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const color = v >= 70 ? 'bg-emerald-500' : v >= 40 ? 'bg-amber-400' : 'bg-slate2-300';
  return (
    <div className="flex items-center gap-2 w-28 shrink-0">
      <div className="h-1.5 flex-1 rounded-full bg-slate2-100 overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${v}%` }} /></div>
      <span className="text-xs font-semibold text-slate2-700 w-9 text-right">{v} %</span>
    </div>
  );
}

function AnnoncesTab({ onChange }) {
  const [vue, setVue] = useState('a_traiter');
  const [force, setForce] = useState('');
  const [site, setSite] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [autre, setAutre] = useState(null); // annonce pour laquelle on choisit un autre client
  const toast = useToast();
  const path = `/annonces${qs({ vue, force, site, search, page })}`;
  const { data, loading, error, load } = useList(path, [path]);

  const act = async (id, action, body, msg) => {
    try {
      await api.post(`/annonces/${id}/${action}`, body || {});
      toast(msg, 'success');
      load();
      onChange();
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <SubFilters
          value={vue}
          onChange={(v) => { setVue(v); setPage(1); }}
          options={[{ key: 'a_traiter', label: 'À traiter' }, { key: 'confirmees', label: 'Confirmées' }, { key: 'ecartees', label: 'Écartées' }, { key: 'toutes', label: 'Toutes' }]}
        />
        <div className="flex flex-wrap gap-2">
          <select className="input w-auto" value={force} onChange={(e) => { setForce(e.target.value); setPage(1); }}>
            <option value="">Toutes attributions</option>
            <option value="fortes">Fortes (cité ou ≥ 70 %)</option>
          </select>
          <select className="input w-auto" value={site} onChange={(e) => { setSite(e.target.value); setPage(1); }}>
            <option value="">Tous les sites</option>
            {(data?.sites || []).map((s) => <option key={s.site} value={s.site}>{s.site} ({s.n})</option>)}
          </select>
          <input className="input max-w-xs" placeholder="Rechercher (poste, client, cabinet...)" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      {loading && <Loading />}
      {!loading && error && <EmptyState title="Impossible de charger les annonces" description={error} />}
      {!loading && !error && data && data.results.length === 0 && (
        <EmptyState
          icon={ScanSearch}
          title={vue === 'a_traiter' ? 'Aucune annonce à traiter' : 'Aucune annonce'}
          description={vue === 'a_traiter' ? 'Lancez l\'agent depuis Claude avec « Scanner les annonces » : les annonces Data & IA arriveront ici avec leur client probable.' : ''}
        />
      )}
      {!loading && !error && data && data.results.length > 0 && (
        <div className="space-y-2">
          {data.results.map((a, i) => {
            const jour = jourDe(a);
            const nouveauJour = i === 0 || jourDe(data.results[i - 1]) !== jour;
            const nb = data.results.filter((x) => jourDe(x) === jour).length;
            return (
            <React.Fragment key={a.id}>
            {nouveauJour && (
              <div className="flex items-center gap-2 pt-3 pb-1 first:pt-0">
                <Calendar size={14} className="text-brand" />
                <h3 className="text-sm font-semibold text-slate2-700 first-letter:uppercase">{libelleJour(jour)}</h3>
                <span className="text-xs text-slate2-400">{nb} annonce{nb > 1 ? 's' : ''}</span>
                <div className="flex-1 border-t border-slate2-100" />
              </div>
            )}
            <AnnonceCard
              a={a}
              onConfirm={(eid, nom) => act(a.id, 'confirmer', { entreprise_id: eid }, `Attribution confirmée : ${nom}.`)}
              onAutre={() => setAutre(a)}
              onEcarter={() => act(a.id, 'ecarter', null, 'Annonce écartée.')}
              onRestaurer={() => act(a.id, 'restaurer', null, 'Annonce remise à traiter.')}
            />
            </React.Fragment>
            );
          })}
        </div>
      )}
      {!loading && !error && data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}

      <AutreClientModal
        annonce={autre}
        onClose={() => setAutre(null)}
        onSave={(eid) => { const a = autre; setAutre(null); act(a.id, 'confirmer', { entreprise_id: eid }, 'Client réel enregistré.'); }}
      />
    </div>
  );
}

// Jour de parution (AAAA-MM-JJ) : sert à empiler les annonces par jour, les plus récentes en haut.
function jourDe(a) {
  return String(a.date_publication || a.created_at || '').slice(0, 10);
}

function libelleJour(jour) {
  if (!jour) return 'Date inconnue';
  const d = new Date(`${jour}T12:00:00`);
  const auj = new Date(); auj.setHours(12, 0, 0, 0);
  const ecart = Math.round((auj - d) / 86400000);
  const txt = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  if (ecart === 0) return `Aujourd'hui — ${txt}`;
  if (ecart === 1) return `Hier — ${txt}`;
  return txt;
}

function AnnonceCard({ a, onConfirm, onAutre, onEcarter, onRestaurer }) {
  const [open, setOpen] = useState(false);
  const hypotheses = Array.isArray(a.hypotheses) ? a.hypotheses : [];
  const indices = Array.isArray(a.indices) ? a.indices : [];
  const decideurs = Array.isArray(a.decideurs) ? a.decideurs : [];
  const meta = [a.localisation, a.type_contrat, a.tjm && `TJM ${a.tjm}`, a.duree].filter(Boolean);

  return (
    <div className="card p-4">
      <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap text-xs text-slate2-400">
            <span className="px-2 py-0.5 rounded-full bg-slate2-50 text-slate2-600 font-medium">{a.site}</span>
            {a.intermediaire && <span>publiée par <span className="text-slate2-600">{a.intermediaire}</span></span>}
            <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(a.date_publication || a.created_at)}</span>
          </div>
          <a href={a.url} target="_blank" rel="noopener noreferrer" className="block font-medium text-slate2-800 mt-1 hover:text-brand">{a.titre}</a>
          {meta.length > 0 && <p className="text-xs text-slate2-500 mt-0.5 flex items-center gap-1"><MapPin size={11} />{meta.join(' · ')}</p>}

          {a.statut === 'confirmee' && (
            <div className="mt-3 text-sm flex items-center gap-2 text-emerald-700">
              <ShieldCheck size={16} /> Client confirmé :
              <Link to={`/clients/entreprise/${a.entreprise_confirmee_id}`} className="font-semibold hover:underline">{a.entreprise_confirmee_nom}</Link>
            </div>
          )}

          {a.client_nomme && a.statut !== 'confirmee' && (
            <div className="mt-3 text-sm flex items-center gap-2 text-emerald-700">
              <Check size={16} /> Client cité dans l'annonce :
              {a.entreprise_id
                ? <Link to={`/clients/entreprise/${a.entreprise_id}`} className="font-semibold hover:underline">{a.entreprise_nom}</Link>
                : <span className="font-semibold">{hypotheses[0]?.entreprise_nom || '—'}</span>}
            </div>
          )}

          {hypotheses.length > 0 && !(a.client_nomme && hypotheses.length === 1) && (
            <div className="mt-3 space-y-2">
              <div className="text-xs font-medium text-slate2-500">Client probable</div>
              {hypotheses.map((h, i) => (
                <div key={`${h.entreprise_id || h.entreprise_nom}-${i}`} className="flex items-start gap-3">
                  <ProbaBar value={h.probabilite} />
                  <div className="min-w-0 flex-1">
                    {h.entreprise_id
                      ? <Link to={`/clients/entreprise/${h.entreprise_id}`} className="text-sm font-medium text-slate2-800 hover:text-brand">{h.entreprise_nom}</Link>
                      : <span className="text-sm font-medium text-slate2-800">{h.entreprise_nom} <span className="text-xs text-slate2-400 font-normal">(pas dans le CRM)</span></span>}
                    {h.raisons && <p className="text-xs text-slate2-500">{Array.isArray(h.raisons) ? h.raisons.join(' · ') : h.raisons}</p>}
                  </div>
                  {a.statut === 'a_traiter' && h.entreprise_id && (
                    <button className="btn btn-ghost text-xs py-1" onClick={() => onConfirm(h.entreprise_id, h.entreprise_nom)} title="Confirmer ce client">
                      <Check size={12} /> C'est lui
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {hypotheses.length === 0 && !a.client_nomme && (
            <p className="mt-3 text-sm text-slate2-500">Aucun client du CRM ne correspond aux indices de cette annonce.</p>
          )}

          {decideurs.length > 0 && (
            <div className="mt-3 rounded-lg border border-slate2-100 bg-slate2-50/60 px-3 py-2">
              <div className="text-xs font-medium text-slate2-500 flex items-center gap-1 mb-1.5"><Users size={12} /> Décideurs probables</div>
              <div className="space-y-1.5">
                {decideurs.map((d, i) => (
                  <div key={`${d.linkedin || d.nom}-${i}`} className="flex items-start gap-2">
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${d.pertinence === 'forte' ? 'bg-emerald-500' : d.pertinence === 'moyenne' ? 'bg-amber-400' : 'bg-slate2-300'}`} title={`Pertinence ${d.pertinence || '?'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">
                        {d.contact_id
                          ? <Link to={`/clients/contact/${d.contact_id}`} className="font-medium text-slate2-800 hover:text-brand">{d.nom}</Link>
                          : <span className="font-medium text-slate2-800">{d.nom}</span>}
                        {d.poste && <span className="text-slate2-500"> · {d.poste}</span>}
                        {d.contact_id
                          ? <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium align-middle">Dans ton CRM</span>
                          : <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 font-medium align-middle">Nouveau</span>}
                      </div>
                      {d.raison && <p className="text-xs text-slate2-500">{d.raison}</p>}
                    </div>
                    {d.linkedin && (
                      <a href={d.linkedin} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-xs py-1 shrink-0" title="Ouvrir le profil LinkedIn">
                        <Linkedin size={12} /> Profil
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {indices.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {indices.map((ind, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700" title={ind.citation || ''}>
                  {INDICE_LABELS[ind.type] || INDICE_LABELS.autre} : {ind.valeur}
                </span>
              ))}
            </div>
          )}

          {a.extrait && (
            <div className="mt-2">
              <button className="text-xs text-slate2-500 hover:text-brand flex items-center gap-1" onClick={() => setOpen(!open)}>
                {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Extrait de l'annonce
              </button>
              {open && <p className="text-sm text-slate2-600 mt-1 whitespace-pre-line bg-slate2-50 rounded-lg px-3 py-2">{a.extrait}</p>}
            </div>
          )}
          {a.notes && <p className="text-xs text-slate2-500 mt-2 whitespace-pre-line">{a.notes}</p>}
        </div>

        <div className="flex md:flex-col gap-2 shrink-0 flex-wrap">
          <a href={a.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost"><ExternalLink size={14} /> Voir l'annonce</a>
          {a.statut === 'a_traiter' && <>
            {a.client_nomme && a.entreprise_id && (
              <button className="btn btn-primary" onClick={() => onConfirm(a.entreprise_id, a.entreprise_nom)}><Check size={14} /> Confirmer</button>
            )}
            <button className="btn btn-secondary" onClick={onAutre}><Building2 size={14} /> Autre client…</button>
            <button className="btn btn-secondary" onClick={onEcarter}><X size={14} /> Écarter</button>
          </>}
          {a.statut !== 'a_traiter' && <button className="btn btn-secondary" onClick={onRestaurer}><RotateCcw size={14} /> Remettre à traiter</button>}
        </div>
      </div>
    </div>
  );
}

function AutreClientModal({ annonce, onClose, onSave }) {
  const [eid, setEid] = useState(null);
  useEffect(() => { setEid(null); }, [annonce]);
  return (
    <Modal open={!!annonce} onClose={onClose} title="Quel est le vrai client ?">
      {annonce && (
        <div className="space-y-4">
          <p className="text-sm text-slate2-600">{annonce.titre}</p>
          <Field label="Client">
            <EntrepriseCombo value={eid} onChange={setEid} />
          </Field>
          <p className="text-xs text-slate2-500">L'agent tiendra compte de votre correction pour les prochaines annonces.</p>
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
            <button className="btn btn-primary" disabled={!eid} onClick={() => onSave(eid)}><Check size={14} /> Enregistrer</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ------------------------------------------------------------------ périmètres clients

const EMPTY = { entreprise_id: null, nom_equipe: '', alias: '', direction: '', sites: '', technologies: '', mots_cles: '', description: '' };
const joinArr = (v) => (Array.isArray(v) ? v.join(', ') : v || '');

function Chips({ label, values }) {
  if (!values || values.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      <span className="text-xs text-slate2-400 w-20 shrink-0">{label}</span>
      {values.map((v) => <span key={v} className="text-xs px-2 py-0.5 rounded-full bg-slate2-50 text-slate2-700">{v}</span>)}
    </div>
  );
}

function PerimetresTab({ onChange }) {
  const [vue, setVue] = useState('actifs');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null); // {id?, ...champs}
  const toast = useToast();
  const confirm = useConfirm();
  const path = `/annonces/perimetres${qs({ vue, search })}`;
  const { data, loading, error, load } = useList(path, [path]);

  const refresh = () => { load(); onChange(); };
  const valider = async (p) => {
    try { await api.post(`/annonces/perimetres/${p.id}/valider`, {}); toast('Périmètre validé.', 'success'); refresh(); }
    catch (e) { toast(e.message, 'error'); }
  };
  const supprimer = async (p) => {
    if (!(await confirm({ title: 'Supprimer ce périmètre ?', message: `${p.entreprise_nom} — ${p.nom_equipe}` }))) return;
    try { await api.del(`/annonces/perimetres/${p.id}`); toast('Périmètre supprimé.', 'success'); refresh(); }
    catch (e) { toast(e.message, 'error'); }
  };
  const save = async () => {
    try {
      if (form.id) await api.put(`/annonces/perimetres/${form.id}`, form);
      else await api.post('/annonces/perimetres', form);
      toast('Périmètre enregistré.', 'success');
      setForm(null);
      refresh();
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <SubFilters value={vue} onChange={setVue} options={[{ key: 'actifs', label: 'Tous' }, { key: 'a_valider', label: 'À valider' }]} />
        <div className="flex flex-wrap gap-2">
          <input className="input max-w-xs" placeholder="Rechercher (client, équipe, techno...)" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY })}><Plus size={14} /> Ajouter</button>
        </div>
      </div>
      <p className="text-xs text-slate2-500">
        Un périmètre décrit une équipe chez un client (ex. « Datalab » chez tel client) : c'est ce que l'agent compare aux annonces anonymes.
        Ceux construits par l'agent sont « à valider » : corrigez-les ou validez-les.
      </p>

      {loading && <Loading />}
      {!loading && error && <EmptyState title="Impossible de charger les périmètres" description={error} />}
      {!loading && !error && data && data.results.length === 0 && (
        <EmptyState icon={Target} title="Aucun périmètre" description="Demandez à Claude : « Construis les périmètres clients à partir du CRM », ou ajoutez-en un à la main." />
      )}
      {!loading && !error && data && data.results.length > 0 && (
        <div className="grid md:grid-cols-2 gap-3">
          {data.results.map((p) => (
            <div key={p.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to={`/clients/entreprise/${p.entreprise_id}`} className="text-xs text-slate2-500 hover:text-brand flex items-center gap-1"><Building2 size={12} />{p.entreprise_nom}</Link>
                  <p className="font-medium text-slate2-800 mt-0.5">{p.nom_equipe}{p.direction ? <span className="text-slate2-500 font-normal"> · {p.direction}</span> : null}</p>
                </div>
                {p.valide
                  ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 shrink-0">Validé</span>
                  : <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 shrink-0">À valider</span>}
              </div>
              <Chips label="Aussi appelé" values={p.alias} />
              <Chips label="Lieux" values={p.sites} />
              <Chips label="Technos" values={p.technologies} />
              <Chips label="Tournures" values={p.mots_cles} />
              {p.description && <p className="text-sm text-slate2-600 mt-2 whitespace-pre-line">{p.description}</p>}
              <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
                <span className="text-xs text-slate2-400">{p.source}</span>
                <div className="flex gap-1">
                  {!p.valide && <button className="btn btn-ghost text-xs py-1" onClick={() => valider(p)}><Check size={12} /> Valider</button>}
                  <button className="btn btn-ghost text-xs py-1" onClick={() => setForm({ ...p, alias: joinArr(p.alias), sites: joinArr(p.sites), technologies: joinArr(p.technologies), mots_cles: joinArr(p.mots_cles) })}><Pencil size={12} /> Modifier</button>
                  <button className="btn btn-ghost text-xs py-1 text-red-500" onClick={() => supprimer(p)}><Trash2 size={12} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Modifier le périmètre' : 'Nouveau périmètre client'}>
        {form && (
          <div className="space-y-3">
            {!form.id && (
              <Field label="Client" required>
                <EntrepriseCombo value={form.entreprise_id} onChange={(v) => setForm({ ...form, entreprise_id: v })} />
              </Field>
            )}
            <Field label="Nom de l'équipe" required hint="Tel qu'il apparaît dans les annonces : Datalab, Data Factory, DSI Groupe…">
              <input className="input" value={form.nom_equipe} onChange={(e) => setForm({ ...form, nom_equipe: e.target.value })} />
            </Field>
            <Field label="Direction / métier"><input className="input" value={form.direction || ''} onChange={(e) => setForm({ ...form, direction: e.target.value })} /></Field>
            <Field label="Autres appellations" hint="Séparées par des virgules"><input className="input" value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} /></Field>
            <Field label="Lieux / sites" hint="Séparés par des virgules"><input className="input" value={form.sites} onChange={(e) => setForm({ ...form, sites: e.target.value })} /></Field>
            <Field label="Technos" hint="Séparées par des virgules"><input className="input" value={form.technologies} onChange={(e) => setForm({ ...form, technologies: e.target.value })} /></Field>
            <Field label="Tournures typiques des annonces" hint="Séparées par des virgules"><input className="input" value={form.mots_cles} onChange={(e) => setForm({ ...form, mots_cles: e.target.value })} /></Field>
            <Field label="Notes"><textarea className="input" rows={3} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="flex justify-end gap-2">
              <button className="btn btn-secondary" onClick={() => setForm(null)}>Annuler</button>
              <button className="btn btn-primary" disabled={!form.nom_equipe || (!form.id && !form.entreprise_id)} onClick={save}><Check size={14} /> Enregistrer</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
