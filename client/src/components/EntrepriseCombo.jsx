import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { api } from '../lib/api';

export default function EntrepriseCombo({ value, onChange, placeholder = 'Rechercher une entreprise...' }) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const boxRef = useRef(null);

  useEffect(() => {
    if (value && !label) {
      api.get(`/entreprises/${value}`).then((e) => setLabel(e.nom)).catch(() => {});
    }
    if (!value) setLabel('');
  }, [value]);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get(`/entreprises?search=${encodeURIComponent(query)}&pageSize=15`).then((d) => setOptions(d.results)).catch(() => setOptions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

  useEffect(() => {
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <input
          className="input pr-8"
          placeholder={placeholder}
          value={open ? query : label}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setOpen(true); setQuery(''); }}
        />
        <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate2-400 pointer-events-none" />
      </div>
      {open && (
        <div className="absolute mt-1 w-full card shadow-card-hover max-h-64 overflow-y-auto z-50 p-1">
          {options.length === 0 && <div className="px-3 py-2 text-sm text-slate2-400">Aucun résultat</div>}
          {options.map((o) => (
            <div
              key={o.id}
              className="px-3 py-2 text-sm rounded-lg hover:bg-brand-50 cursor-pointer"
              onClick={() => { onChange(o.id); setLabel(o.nom); setOpen(false); }}
            >
              {o.nom}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
