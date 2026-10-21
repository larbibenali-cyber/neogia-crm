import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Radar, Building2, ExternalLink, Check, X, RotateCcw, FileText, Users, Copy, Linkedin, Trash2, Sparkles, Calendar,
} from 'lucide-react';
import { api, qs } from '../lib/api';
import { Loading, EmptyState, Pagination, Modal, Avatar } from '../components/ui';
import StatusBadge from '../components/StatusBadge';
import { formatDate } from '../lib/format';
import { useToast } from '../lib/ToastContext';
import { useConfirm } from '../lib/ConfirmContext';

// Page « Leads détectés » : affiche ce que les agents Claude (brief de compte,
// détection de signaux, recherche de contacts) ont écrit dans la base. Les
// agents se lancent depuis Claude ; ici on consulte, qualifie ou écarte.

const TABS = [
  { key: 'signaux', label: 'Signaux de recrutement', icon: Radar },
  { key: 'contacts', label: 'Contacts trouvés', icon: Users },
  { key: 'briefs', label: 'Briefs de compte', icon: FileText },
];

const PROMPTS = [
  { label: 'Brief de compte', text: 'Fais-moi un brief sur [entreprise]' },
  { label: 'Signaux', text: 'Cherche les signaux de recrutement sur la banque et l\'assurance' },
  { label: 'Contacts', text: 'Trouve les contacts QA et Data chez [entreprise 1], [entreprise 2]' },
];

// Extrait la première URL après un libellé (« Offre : », « source : ») ou, à défaut, la première URL.
function extractUrl(text, label) {
  if (!text) return null;
  if (label) {
    const m = text.match(new RegExp(`${label}\\s*:\\s*(https?://\\S+)`, 'i'));
    if (m) return m[1].replace(/[).,;]+$/, '');
  }
  const m = text.match(/https?:\/\/\S+/);
  return m ? m[0].replace(/[).,;]+$/, '') : null;
}

function stripUrls(text) {
  return (text || '')
    .split('\n')
    .filter((l) => !/^\s*(Offre|Publiée le)\s*:/i.test(l))
    .join('\n')
    .trim();
}

// ------------------------------------------------------------------ rendu markdown minimal (briefs)
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function inline(s) {
  let out = escapeHtml(s);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-brand underline">$1</a>');
  out = out.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer" class="text-brand underline break-all">$2</a>');
  return out;
}
function markdownToHtml(md) {
  const lines = (md || '').replace(/\r/g, '').split('\n');
  const html = [];
  let list = null;
  const closeList = () => { if (list) { html.push(`</${list}>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { closeList(); continue; }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      closeList();
      const lvl = m[1].length;
      const cls = lvl <= 1 ? 'text-xl font-heading font-semibold mt-2 mb-2' : lvl === 2 ? 'text-base font-heading font-semibold mt-5 mb-2 text-slate2-900' : 'font-semibold mt-4 mb-1';
      html.push(`<h${lvl + 1} class="${cls}">${inline(m[2])}</h${lvl + 1}>`);
    } else if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) {
      if (list !== 'ul') { closeList(); html.push('<ul class="list-disc pl-5 space-y-1 my-2">'); list = 'ul'; }
      html.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      if (list !== 'ol') { closeList(); html.push('<ol class="list-decimal pl-5 space-y-1 my-2">'); list = 'ol'; }
      html.push(`<li>${inline(m[1])}</li>`);
    } else {
      closeList();
      html.push(`<p class="my-2">${inline(line)}</p>`);
    }
  }
  closeList();
  return html.join('\n');
}

// ------------------------------------------------------------------ page

export default function Leads() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'signaux';
  const [stats, setStats] = useState(null);
  const toast = useToast();

  const loadStats = useCallback(() => {
    api.get('/leads/stats').then(setStats).catch(() => setStats(null));
  }, []);
  useEffect(() => { loadStats(); }, [loadStats]);

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); toast('Phrase copiée — collez-la dans Claude.', 'success'); }
    catch { toast('Copie impossible, sélectionnez le texte à la main.', 'error'); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-slate2-900">Leads détectés</h1>
        <p className="text-slate2-500 text-sm mt-1">Ce que vos agents ont trouvé : à qualifier ou à écarter.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={Radar} label="Signaux à traiter" value={stats?.signaux_a_traiter} sub={stats ? `${stats.signaux_7j} cette semaine` : ''} onClick={() => setParams({ tab: 'signaux' })} />
        <StatCard icon={Users} label="Contacts trouvés" value={stats?.contacts_total} sub={stats ? `${stats.contacts_7j} cette semaine` : ''} onClick={() => setParams({ tab: 'contacts' })} />
        <StatCard icon={FileText} label="Briefs de compte" value={stats?.briefs_total} sub={stats ? `${stats.briefs_7j} cette semaine` : ''} onClick={() => setParams({ tab: 'briefs' })} />
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate2-800">
          <Sparkles size={16} className="text-brand" /> Lancer un agent
        </div>
        <p className="text-xs text-slate2-500 mt-1">
          Les agents tournent dans Claude. Copiez une phrase, collez-la dans Claude, validez la liste proposée : les résultats arrivent ici.
          La recherche de signaux tourne aussi automatiquement chaque lundi matin.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {PROMPTS.map((p) => (
            <button key={p.label} onClick={() => copy(p.text)} className="btn btn-secondary text-left" title={p.text}>
              <Copy size={14} /> <span className="font-medium">{p.label}</span>
              <span className="hidden lg:inline text-slate2-500 font-normal">· « {p.text} »</span>
            </button>
          ))}
          <a href="https://claude.ai/new" target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            <ExternalLink size={14} /> Ouvrir Claude
          </a>
        </div>
      </div>

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

      {tab === 'signaux' && <SignauxTab onChange={loadStats} />}
      {tab === 'contacts' && <ContactsTab onChange={loadStats} />}
      {tab === 'briefs' && <BriefsTab onChange={loadStats} />}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, onClick }) {
  return (
    <button onClick={onClick} className="card p-4 text-left hover:shadow-card-hover transition-shadow">
      <div className="flex items-center gap-2 text-xs font-medium text-slate2-500"><Icon size={14} /> {label}</div>
      <div className="text-2xl font-heading font-semibold text-slate2-900 mt-1">{value ?? '—'}</div>
      <div className="text-xs text-slate2-400 mt-0.5">{sub}</div>
    </button>
  );
}

function SubFilters({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${value === o.key ? 'bg-brand text-white' : 'bg-slate2-50 text-slate2-600 hover:bg-slate2-100'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function useList(path, deps) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get(path).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { data, loading, error, load };
}

// ------------------------------------------------------------------ onglet signaux

function SignauxTab({ onChange }) {
  const [vue, setVue] = useState('a_traiter');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const toast = useToast();
  const path = `/leads/signaux${qs({ vue, search, page })}`;
  const { data, loading, error, load } = useList(path, [path]);

  const act = async (id, action, msg) => {
    try {
      await api.post(`/leads/signaux/${id}/${action}`, {});
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
          options={[{ key: 'a_traiter', label: 'À traiter' }, { key: 'qualifies', label: 'Qualifiés' }, { key: 'ecartes', label: 'Écartés' }]}
        />
        <input className="input max-w-xs" placeholder="Rechercher (poste, entreprise...)" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {loading && <Loading />}
      {!loading && error && <EmptyState title="Impossible de charger les signaux" description={error} />}
      {!loading && !error && data && data.results.length === 0 && (
        <EmptyState
          icon={Radar}
          title={vue === 'a_traiter' ? 'Aucun signal à traiter' : vue === 'qualifies' ? 'Aucun signal qualifié' : 'Aucun signal écarté'}
          description={vue === 'a_traiter' ? 'La prochaine recherche automatique a lieu lundi matin. Vous pouvez aussi la lancer depuis Claude.' : ''}
        />
      )}
      {!loading && !error && data && data.results.length > 0 && (
        <div className="space-y-2">
          {data.results.map((s) => {
            const offre = extractUrl(s.description_contexte, 'Offre');
            const resume = stripUrls(s.description_contexte);
            return (
              <div key={s.id} className="card p-4">
                <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge category="besoin_priorite" value={s.priorite} small />
                      <span className="text-xs text-slate2-400">{(s.source || '').replace(/^Agent signaux\s*[–-]\s*/i, '')}</span>
                      <span className="text-xs text-slate2-400 flex items-center gap-1"><Calendar size={11} />{formatDate(s.date_identification || s.created_at)}</span>
                    </div>
                    <Link to={`/besoins/${s.id}`} className="block font-medium text-slate2-800 mt-1 hover:text-brand">
                      {(s.titre || '').replace(/^\[Signal\]\s*/i, '')}
                    </Link>
                    {s.entreprise_id && (
                      <Link to={`/clients/entreprise/${s.entreprise_id}`} className="text-xs text-slate2-500 hover:text-brand flex items-center gap-1 mt-0.5">
                        <Building2 size={12} /> {s.entreprise_nom}{s.localisation ? ` · ${s.localisation}` : ''}
                      </Link>
                    )}
                    {resume && <p className="text-sm text-slate2-600 mt-2 whitespace-pre-line">{resume}</p>}
                    {s.notes_internes && <p className="text-xs text-slate2-500 mt-2 whitespace-pre-line bg-slate2-50 rounded-lg px-3 py-2">{s.notes_internes}</p>}
                  </div>
                  <div className="flex md:flex-col gap-2 shrink-0 flex-wrap">
                    {offre && <a href={offre} target="_blank" rel="noopener noreferrer" className="btn btn-ghost"><ExternalLink size={14} /> Voir l'offre</a>}
                    {vue === 'a_traiter' && <>
                      <button className="btn btn-primary" onClick={() => act(s.id, 'qualifier', 'Signal qualifié : il passe en « Besoin détecté ».')}><Check size={14} /> Qualifier</button>
                      <button className="btn btn-secondary" onClick={() => act(s.id, 'ecarter', 'Signal écarté.')}><X size={14} /> Écarter</button>
                    </>}
                    {vue === 'qualifies' && <Link to={`/besoins/${s.id}`} className="btn btn-secondary">Ouvrir le besoin</Link>}
                    {vue === 'ecartes' && <button className="btn btn-secondary" onClick={() => act(s.id, 'restaurer', 'Signal remis à traiter.')}><RotateCcw size={14} /> Remettre à traiter</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!loading && !error && data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
    </div>
  );
}

// ------------------------------------------------------------------ onglet contacts

function ContactsTab({ onChange }) {
  const [vue, setVue] = useState('actifs');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const toast = useToast();
  const path = `/leads/contacts${qs({ vue, search, page })}`;
  const { data, loading, error, load } = useList(path, [path]);

  const act = async (id, action, msg) => {
    try {
      await api.post(`/leads/contacts/${id}/${action}`, {});
      toast(msg, 'success');
      load();
      onChange();
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <SubFilters value={vue} onChange={(v) => { setVue(v); setPage(1); }} options={[{ key: 'actifs', label: 'Dans le CRM' }, { key: 'ecartes', label: 'Écartés' }]} />
        <input className="input max-w-xs" placeholder="Rechercher (nom, fonction, entreprise...)" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {loading && <Loading />}
      {!loading && error && <EmptyState title="Impossible de charger les contacts" description={error} />}
      {!loading && !error && data && data.results.length === 0 && (
        <EmptyState icon={Users} title="Aucun contact trouvé par les agents" description={vue === 'actifs' ? 'Demandez à Claude : « Trouve les contacts Data chez … » puis validez la liste.' : ''} />
      )}
      {!loading && !error && data && data.results.length > 0 && (
        <div className="space-y-2">
          {data.results.map((c) => {
            const source = extractUrl(c.notes, 'source');
            return (
              <div key={c.id} className="card p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar prenom={c.prenom} nom={c.nom} />
                  <div className="min-w-0">
                    <Link to={`/clients/contact/${c.id}`} className="font-medium text-slate2-800 hover:text-brand">{[c.prenom, c.nom].filter(Boolean).join(' ')}</Link>
                    <p className="text-sm text-slate2-600 truncate">{c.fonction || '—'}</p>
                    <div className="flex items-center gap-3 text-xs text-slate2-500 mt-0.5 flex-wrap">
                      {c.entreprise_id && <Link to={`/clients/entreprise/${c.entreprise_id}`} className="flex items-center gap-1 hover:text-brand"><Building2 size={12} />{c.entreprise_nom}</Link>}
                      {c.localisation && <span>{c.localisation}</span>}
                      <span>Ajouté le {formatDate(c.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap">
                  {source && <a href={source} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" title={source}><ExternalLink size={14} /> Source</a>}
                  {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost"><Linkedin size={14} /> Profil</a>}
                  <Link to={`/clients/contact/${c.id}`} className="btn btn-secondary">Ouvrir la fiche</Link>
                  {vue === 'actifs'
                    ? <button className="btn btn-ghost text-red-500" onClick={() => act(c.id, 'ecarter', 'Contact écarté (archivé).')}><X size={14} /> Écarter</button>
                    : <button className="btn btn-secondary" onClick={() => act(c.id, 'restaurer', 'Contact restauré.')}><RotateCcw size={14} /> Restaurer</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!loading && !error && data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
    </div>
  );
}

// ------------------------------------------------------------------ onglet briefs

function BriefsTab({ onChange }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);
  const toast = useToast();
  const confirm = useConfirm();
  const path = `/leads/briefs${qs({ search })}`;
  const { data, loading, error, load } = useList(path, [path]);

  const openBrief = async (id) => {
    try { setOpen(await api.get(`/leads/briefs/${id}`)); }
    catch (e) { toast(e.message, 'error'); }
  };
  const remove = async (b) => {
    if (!(await confirm({ title: 'Supprimer ce brief ?', message: b.titre }))) return;
    try {
      await api.del(`/leads/briefs/${b.id}`);
      toast('Brief supprimé.', 'success');
      setOpen(null);
      load();
      onChange();
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <input className="input max-w-xs" placeholder="Rechercher une entreprise..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {loading && <Loading />}
      {!loading && error && <EmptyState title="Impossible de charger les briefs" description={error} />}
      {!loading && !error && data && data.results.length === 0 && (
        <EmptyState icon={FileText} title="Aucun brief enregistré" description="Demandez à Claude : « Fais-moi un brief sur … », puis acceptez de l'enregistrer dans le CRM." />
      )}
      {!loading && !error && data && data.results.length > 0 && (
        <div className="grid md:grid-cols-2 gap-3">
          {data.results.map((b) => (
            <button key={b.id} onClick={() => openBrief(b.id)} className="card p-4 text-left hover:shadow-card-hover transition-shadow">
              <div className="flex items-center gap-2 text-xs text-slate2-500"><Building2 size={12} /> {b.entreprise_nom} · {formatDate(b.created_at)}</div>
              <p className="font-medium text-slate2-800 mt-1">{b.titre}</p>
              <p className="text-sm text-slate2-500 mt-1 line-clamp-3">{(b.apercu || '').replace(/[#*]/g, '')}</p>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.titre || ''} size="xl">
        {open && (
          <div>
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="text-xs text-slate2-500">Généré le {formatDate(open.created_at, true)}</div>
              <div className="flex gap-2">
                {open.entreprise_id && <Link to={`/clients/entreprise/${open.entreprise_id}`} className="btn btn-secondary" onClick={() => setOpen(null)}><Building2 size={14} /> Fiche entreprise</Link>}
                <button className="btn btn-danger" onClick={() => remove(open)}><Trash2 size={14} /> Supprimer</button>
              </div>
            </div>
            <div className="text-sm text-slate2-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: markdownToHtml(open.contenu) }} />
          </div>
        )}
      </Modal>
    </div>
  );
}
