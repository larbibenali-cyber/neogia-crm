import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const Ctx = createContext(null);

export function PickListsProvider({ children }) {
  const [lists, setLists] = useState({});
  const [loaded, setLoaded] = useState(false);

  const reload = () => api.get('/picklists').then((d) => { setLists(d); setLoaded(true); });

  useEffect(() => { reload(); }, []);

  const getLabel = (category, value) => {
    const item = (lists[category] || []).find((i) => i.value === value);
    return item ? item.label : value;
  };
  const getColor = (category, value) => {
    const item = (lists[category] || []).find((i) => i.value === value);
    return item ? item.color : '#94A3B8';
  };
  const getOptions = (category) => (lists[category] || []).filter((i) => i.active);

  return (
    <Ctx.Provider value={{ lists, loaded, reload, getLabel, getColor, getOptions }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePickLists() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePickLists must be used within PickListsProvider');
  return ctx;
}
