import React, { useEffect, useState } from 'react';
import { ListChecks, Clock, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { Loading, EmptyState } from '../components/ui';

const PRIORITE_STYLE = {
  haute: { label: 'Haute', color: '#F87171' },
  moyenne: { label: 'Moyenne', color: '#FBBF24' },
  basse: { label: 'Basse', color: '#94A3B8' },
};

function PrioriteBadge({ value }) {
  const s = PRIORITE_STYLE[value] || PRIORITE_STYLE.basse;
  return (
    <span className="badge" style={{ color: s.color, background: s.color + '22' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  const label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Page de lecture du module « Priorisation activité ». Les bilans sont
// produits chaque soir à 19h par une tâche planifiée Claude (hors de cette
// appli) qui lit Gmail + ce CRM — cette page se contente de les afficher.
export default function Priorisation() {
  const [history, setHistory] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [bilan, setBilan] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/priorisation?limit=30')
      .then((rows) => {
        setHistory(rows);
        if (rows.length > 0) setSelectedDate(rows[0].date_bilan);
      })
      .catch((e) => setError(e.message || "Impossible de charger l'historique."));
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    setBilan(null);
    api.get('/priorisation/' + selectedDate)
      .then(setBilan)
      .catch((e) => setError(e.message || 'Impossible de charger ce bilan.'));
  }, [selectedDate]);

  if (error) return <EmptyState title="Impossible de charger la priorisation" description={error} />;
  if (!history) return <Loading />;

  if (history.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Pas encore de bilan"
        description="Le premier bilan sera généré ce soir à 19h, à partir de tes e-mails et de l'activité du CRM. Reviens demain matin."
      />
    );
  }

  const items = (bilan && bilan.items ? bilan.items : []).slice().sort((a, b) => {
    const order = { haute: 0, moyenne: 1, basse: 2 };
    return (order[a.priorite] ?? 3) - (order[b.priorite] ?? 3);
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-slate2-900 flex items-center gap-2">
            <ListChecks size={22} className="text-brand" /> Priorisation activité
          </h1>
          <p className="text-slate2-500 text-sm mt-1 flex items-center gap-1.5">
            <Clock size={13} /> Généré chaque soir à 19h à partir de tes e-mails et du CRM — {formatDate(selectedDate)}
          </p>
        </div>
        {history.length > 1 && (
          <select className="input w-auto" value={selectedDate || ''} onChange={(e) => setSelectedDate(e.target.value)}>
            {history.map((h) => (
              <option key={h.date_bilan} value={h.date_bilan}>{formatDate(h.date_bilan)}</option>
            ))}
          </select>
        )}
      </div>

      {!bilan ? (
        <Loading />
      ) : (
        <>
          {bilan.resume && (
            <div className="card p-5">
              <h2 className="text-sm font-heading font-semibold text-slate2-800 mb-2">Résumé</h2>
              <p className="text-sm text-slate2-600 whitespace-pre-wrap">{bilan.resume}</p>
            </div>
          )}

          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-3 bg-slate2-50 border-b border-slate2-100">
              <h2 className="text-sm font-heading font-semibold text-slate2-800">Ce qui compte, et ce qu'il faut faire</h2>
            </div>
            {items.length === 0 ? (
              <EmptyState
                icon={AlertCircle}
                title="Rien de prioritaire identifié"
                description="Aucune action particulière n'est ressortie de l'analyse de cette journée."
              />
            ) : (
              <ul className="divide-y divide-slate2-100">
                {items.map((it, i) => (
                  <li key={i} className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate2-800">{it.compte}</span>
                        {it.contact && <span className="text-xs text-slate2-400">{it.contact}</span>}
                      </div>
                      <PrioriteBadge value={it.priorite} />
                    </div>
                    {it.contexte && <p className="text-sm text-slate2-600 mt-1.5">{it.contexte}</p>}
                    {it.action && <p className="text-sm text-brand-700 font-medium mt-1.5">→ {it.action}</p>}
                    {it.source && <p className="text-xs text-slate2-400 mt-1">{it.source}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
