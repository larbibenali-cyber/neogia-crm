import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const remove = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <div key={t.id} className={`card flex items-start gap-2 p-3 shadow-card-hover border-l-4 ${
            t.type === 'success' ? 'border-l-emerald-500' : t.type === 'error' ? 'border-l-red-500' : 'border-l-brand'
          }`}>
            {t.type === 'success' && <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 shrink-0" />}
            {t.type === 'error' && <XCircle size={18} className="text-red-500 mt-0.5 shrink-0" />}
            {t.type === 'info' && <Info size={18} className="text-brand mt-0.5 shrink-0" />}
            <div className="text-sm text-slate2-800 flex-1">{t.message}</div>
            <button onClick={() => remove(t.id)} className="text-slate2-400 hover:text-slate2-700">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.push;
}
