import React from 'react';
import { X, Loader2, Inbox } from 'lucide-react';

export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-start md:items-center justify-center bg-slate2-900/40 p-4 overflow-y-auto">
      <div className={`card w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} my-8`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate2-100">
          <h3 className="font-heading font-semibold text-slate2-900">{title}</h3>
          <button onClick={onClose} className="text-slate2-400 hover:text-slate2-700 p-1 rounded-lg hover:bg-slate2-50">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 max-h-[75vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, required, hint }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-slate2-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-slate2-400 mt-1">{hint}</span>}
    </label>
  );
}

export function Select({ children, ...props }) {
  return <select className="input" {...props}>{children}</select>;
}

export function Loading({ label = 'Chargement...' }) {
  return (
    <div className="flex items-center justify-center gap-2 text-slate2-400 py-16">
      <Loader2 size={18} className="animate-spin" /> {label}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      <div className="bg-slate2-50 rounded-full p-4 mb-3">
        <Icon size={28} className="text-slate2-400" />
      </div>
      <h4 className="font-heading font-semibold text-slate2-800">{title}</h4>
      {description && <p className="text-sm text-slate2-500 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-1 py-3 text-sm text-slate2-500">
      <span>{total} résultat{total > 1 ? 's' : ''} — page {page}/{totalPages}</span>
      <div className="flex gap-1">
        <button className="btn btn-ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>Précédent</button>
        <button className="btn btn-ghost" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Suivant</button>
      </div>
    </div>
  );
}

export function Avatar({ prenom, nom, size = 36 }) {
  const initials = `${(prenom || '?')[0] || ''}${(nom || '')[0] || ''}`.toUpperCase();
  const colors = ['#4527EA', '#0369A1', '#BE185D', '#047857', '#B45309', '#6D28D9'];
  const idx = (initials.charCodeAt(0) || 0) % colors.length;
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-semibold shrink-0"
      style={{ width: size, height: size, background: colors[idx], fontSize: size * 0.38 }}
    >
      {initials || '?'}
    </div>
  );
}
