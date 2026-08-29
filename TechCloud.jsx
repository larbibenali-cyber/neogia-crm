import React from 'react';
import { useNavigate } from 'react-router-dom';

export const CATEGORY_COLORS = {
  cloud: { text: '#0369A1', bg: '#E0F2FE' },
  data_platforms: { text: '#4338CA', bg: '#E0E7FF' },
  data_engineering: { text: '#6D28D9', bg: '#EDE9FE' },
  business_intelligence: { text: '#BE185D', bg: '#FCE7F3' },
  etl: { text: '#B45309', bg: '#FEF3C7' },
  ia: { text: '#047857', bg: '#D1FAE5' },
  devops: { text: '#334155', bg: '#F1F5F9' },
  langages: { text: '#15803D', bg: '#DCFCE7' },
  autre: { text: '#64748B', bg: '#F1F5F9' },
};

export function TechTag({ tech, onClick, removable, onRemove, size = 'md' }) {
  const colors = CATEGORY_COLORS[tech.categorie] || CATEGORY_COLORS.autre;
  const big = size === 'lg' && tech.weight >= 3;
  return (
    <span
      className="tech-tag"
      style={{
        color: colors.text,
        background: colors.bg,
        fontSize: big ? '0.9rem' : size === 'sm' ? '0.72rem' : '0.78rem',
        fontWeight: big ? 700 : 500,
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
      title={tech.custom ? 'Technologie personnalisée (non standard)' : undefined}
    >
      {tech.nom}
      {removable && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(tech); }}
          className="ml-1 opacity-60 hover:opacity-100"
        >
          ×
        </button>
      )}
    </span>
  );
}

export default function TechCloud({ technologies = [], groupByCategory = false, onTagClick, removable, onRemove, size = 'md' }) {
  const navigate = useNavigate();
  const handleClick = (tech) => {
    if (onTagClick) return onTagClick(tech);
    navigate(`/clients?tech=${encodeURIComponent(tech.nom)}`);
  };

  if (!technologies.length) {
    return <p className="text-sm text-slate2-400 italic">Aucune technologie renseignée</p>;
  }

  if (!groupByCategory) {
    const sorted = [...technologies].sort((a, b) => (b.weight || 0) - (a.weight || 0));
    return (
      <div className="flex flex-wrap gap-1.5">
        {sorted.map((t) => (
          <TechTag key={t.id} tech={t} onClick={() => handleClick(t)} removable={removable} onRemove={onRemove} size={size} />
        ))}
      </div>
    );
  }

  const CATEGORY_LABELS = {
    cloud: 'Cloud', data_platforms: 'Data Platforms', data_engineering: 'Data Engineering',
    business_intelligence: 'Business Intelligence', etl: 'ETL', ia: 'Intelligence Artificielle',
    devops: 'DevOps', langages: 'Langages & Frameworks', autre: 'Autre',
  };
  const groups = {};
  technologies.forEach((t) => { (groups[t.categorie] = groups[t.categorie] || []).push(t); });
  const order = Object.keys(CATEGORY_LABELS);

  return (
    <div className="space-y-3">
      {order.filter((c) => groups[c]).map((c) => (
        <div key={c}>
          <div className="text-xs font-semibold text-slate2-500 uppercase tracking-wide mb-1">{CATEGORY_LABELS[c]}</div>
          <div className="flex flex-wrap gap-1.5">
            {groups[c].sort((a, b) => (b.weight || 0) - (a.weight || 0)).map((t) => (
              <TechTag key={t.id} tech={t} onClick={() => handleClick(t)} removable={removable} onRemove={onRemove} size={size} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
