import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Building2, UserSquare2, Briefcase, History, Settings, Radar, ScanSearch, FileText } from 'lucide-react';
import logo from '../assets/neogia-logo.png';

const NAV = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/clients', label: 'Clients', icon: Building2 },
  { to: '/candidats', label: 'Candidats', icon: UserSquare2 },
  { to: '/besoins', label: 'Besoins', icon: Briefcase },
  { to: '/echanges', label: 'Échanges', icon: History },
];

// Pages alimentées par les agents Claude, regroupées sous « Échanges ».
const AGENTS = [
  { to: '/besoins-scrappes', label: 'Besoins scrappés', icon: ScanSearch },
  { to: '/leads', label: 'Leads détectés', icon: Radar },
  { to: '/briefs', label: 'Briefs de compte', icon: FileText },
];

function NavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink
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
  );
}

export default function Sidebar() {
  return (
    <aside className="hidden md:flex w-64 shrink-0 h-screen sticky top-0 bg-white border-r border-slate2-100 flex-col">
      <div className="px-6 py-7">
        <img src={logo} alt="Neogia" className="h-9 w-auto" />
        <p className="text-[11px] uppercase tracking-widest text-slate2-400 mt-1 font-medium">CRM Data &amp; IA</p>
      </div>
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {NAV.map((item) => <NavItem key={item.to} {...item} />)}
        <p className="px-3 pt-4 pb-1 text-[11px] uppercase tracking-widest text-slate2-400 font-medium">Agents</p>
        {AGENTS.map((item) => <NavItem key={item.to} {...item} />)}
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
