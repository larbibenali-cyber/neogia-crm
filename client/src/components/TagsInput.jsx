import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function TagsInput({ value = [], onChange, placeholder = 'Ajouter et appuyer sur Entrée...' }) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft('');
  };

  return (
    <div className="input flex flex-wrap gap-1.5 items-center min-h-[42px] cursor-text" onClick={(e) => e.currentTarget.querySelector('input')?.focus()}>
      {value.map((tag) => (
        <span key={tag} className="tech-tag bg-brand-50 text-brand-700">
          {tag}
          <button onClick={() => onChange(value.filter((t) => t !== tag))} className="ml-1 opacity-60 hover:opacity-100">
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        className="flex-1 min-w-[120px] outline-none border-none text-sm"
        value={draft}
        placeholder={value.length ? '' : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
          if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
      />
    </div>
  );
}
