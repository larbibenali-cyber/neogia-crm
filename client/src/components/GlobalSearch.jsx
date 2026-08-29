import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, User, UserSquare2, Briefcase, Tag, MessageSquare } from 'lucide-react';
import { api } from '../lib/api';

export default function GlobalSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!q || q.length < 2) { setResults(null); setLoading(false); setError(null); return; }
    setLoading(true);
    setError(null);
    const t = setTimeout(() => {
      // Coupe-circuit : si l'API ne répond pas en 10s (jamais le cas en fonctionnement
      // normal), on affiche une erreur explicite plutôt que de rester bloqué en chargement.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      api.get(`/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((d) => { setResults(d); setOpen(true); setLoading(false); })
        .catch(() => { setError('La recherche a échoué. Réessayez.'); setLoading(false); setOpen(true); })
        .finally(() => clearTimeout(timeout));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (path) => { setOpen(false); setQ(''); navigate(path); };

  const hasResults = results && (
    results.entreprises.length || results.contacts.length || results.candidats.length ||
    results.besoins.length || results.technologies.length || results.echanges.length
  );

  return (
    <div className="relative w-full max-w-xl" ref={boxRef}>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate2-400" />
        <input
          className="input pl-9"
          placeholder="Rechercher un client, contact, candidat, besoin, technologie..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => q.length >= 2 && setOpen(true)}
        />
      </div>
      {open && (loading || error || results) && (
        <div className="absolute mt-2 w-full card shadow-card-hover max-h-[70vh] overflow-y-auto z-50 p-2">
          {loading && <div className="p-4 text-sm text-slate2-400 text-center">Recherche en cours…</div>}
          {!loading && error && <div className="p-4 text-sm text-red-500 text-center">{error}</div>}
          {!loading && !error && !hasResults && <div className="p-4 text-sm text-slate2-400 text-center">Aucun résultat pour « {q} »</div>}

          {!loading && !error && results && (
            <>
              {results.entreprises.length > 0 && (
                <Section title="Entreprises" icon={Building2}>
                  {results.entreprises.map((r) => (
                    <Item key={r.id} onClick={() => go(`/clients/entreprise/${r.id}`)}>{r.nom}</Item>
                  ))}
                </Section>
              )}
              {results.contacts.length > 0 && (
                <Section title="Contacts" icon={User}>
                  {results.contacts.map((r) => (
                    <Item key={r.id} onClick={() => go(`/clients/contact/${r.id}`)}>
                      {r.prenom} {r.nom} <span className="text-slate2-400">— {r.entreprise_nom}</span>
                    </Item>
                  ))}
                </Section>
              )}
              {results.candidats.length > 0 && (
                <Section title="Candidats" icon={UserSquare2}>
                  {results.candidats.map((r) => (
                    <Item key={r.id} onClick={() => go(`/candidats/${r.id}`)}>
                      {r.prenom} {r.nom} {r.metier && <span className="text-slate2-400">— {r.metier}</span>}
                    </Item>
                  ))}
                </Section>
              )}
              {results.besoins.length > 0 && (
                <Section title="Besoins" icon={Briefcase}>
                  {results.besoins.map((r) => (
                    <Item key={r.id} onClick={() => go(`/besoins/${r.id}`)}>
                      {r.titre} <span className="text-slate2-400">— {r.entreprise_nom} ({r.reference})</span>
                    </Item>
                  ))}
                </Section>
              )}
              {results.technologies.length > 0 && (
                <Section title="Technologies" icon={Tag}>
                  {results.technologies.map((r) => (
                    <Item key={r.id} onClick={() => go(`/clients?view=entreprises&tech=${encodeURIComponent(r.nom)}`)}>{r.nom}</Item>
                  ))}
                </Section>
              )}
              {results.echanges.length > 0 && (
                <Section title="Échanges" icon={MessageSquare}>
                  {results.echanges.map((r) => (
                    <Item key={r.id} onClick={() => go(`/clients/contact/${r.contact_id}`)}>
                      {r.contact_prenom} {r.contact_nom} — <span className="text-slate2-400">{(r.objet || r.compte_rendu || '').slice(0, 60)}</span>
                    </Item>
                  ))}
                </Section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold uppercase text-slate2-400">
        <Icon size={12} /> {title}
      </div>
      {children}
    </div>
  );
}
function Item({ children, onClick }) {
  return (
    <div onClick={onClick} className="px-2 py-1.5 rounded-lg text-sm hover:bg-brand-50 cursor-pointer text-slate2-800">
      {children}
    </div>
  );
}
