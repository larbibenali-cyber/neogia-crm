import React from 'react';
import { usePickLists } from '../lib/PickListsContext';

function hexToRgba(hex, alpha) {
  if (!hex) return `rgba(148,163,184,${alpha})`;
  const h = hex.replace('#', '');
  const bigint = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function StatusBadge({ category, value, small }) {
  const { getLabel, getColor } = usePickLists();
  const color = getColor(category, value);
  const label = getLabel(category, value);
  return (
    <span
      className="badge"
      style={{
        color,
        background: hexToRgba(color, 0.13),
        fontSize: small ? '0.68rem' : undefined,
        padding: small ? '0.1rem 0.5rem' : undefined,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
