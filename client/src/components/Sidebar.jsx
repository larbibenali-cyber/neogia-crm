import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Building2, UserSquare2, Briefcase, Settings } from 'lucide-react';
import logo from '../assets/neogia-logo.png';

const NAV = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/clients', label: 'Clients', icon: Building2 },
  { to: '/candidats', label: 'Candidats', icon: UserSquare2 },
  { to: '/besoins', label: 'Besoins', icon: Briefcase },
];

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 bg-white border-r border-slate2-100 flex flex-col">
      <div className="px-6 py-7">
        <img src={logo} alt="Neogia" className="h-9 w-auto" />
        <p className="text-[11px] uppercase tracking-widest text-slate2-400 mt-1 font-medium">CRM Data &amp; IA</p>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate2-600 hover:bg-slate2-50 hover:text-slate2-900'
              }`
            }
          >
            <Icon size={18} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-slate2-100">
        <NavLink
          to="/parametres"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive ? 'bg-brand-50 text-brand-700' : 'text-slate2-500 hover:bg-slate2-50'
            }`
          }
        >
          <Settings size={18} />
          Paramètres
        </NavLink>
        <div className="px-3 pt-3 text-xs text-slate2-400">Administrateur Neogia</div>
      </div>
    </aside>
  );
}
