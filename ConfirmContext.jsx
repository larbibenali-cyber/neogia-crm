import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

const ConfirmCtx = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { title, message, danger, resolve }
  const resolveRef = useRef(null);

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState(typeof opts === 'string' ? { message: opts } : opts);
    });
  }, []);

  const close = (result) => {
    if (resolveRef.current) resolveRef.current(result);
    setState(null);
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate2-900/40 p-4">
          <div className="card w-full max-w-sm p-6">
            <div className="flex items-start gap-3">
              <div className={`shrink-0 rounded-full p-2 ${state.danger ? 'bg-red-50' : 'bg-brand-50'}`}>
                <AlertTriangle size={20} className={state.danger ? 'text-red-500' : 'text-brand'} />
              </div>
              <div className="flex-1">
                <h3 className="font-heading font-semibold text-slate2-900">{state.title || 'Confirmer l\'action'}</h3>
                <p className="text-sm text-slate2-600 mt-1">{state.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn btn-ghost" onClick={() => close(false)}>Annuler</button>
              <button className={state.danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={() => close(true)}>
                {state.confirmLabel || 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
