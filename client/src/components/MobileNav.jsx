import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Building2, UserSquare2, Briefcase, Settings } from 'lucide-react';

// Navigation mobile (bas d'écran), affichée uniquement en dessous du
// breakpoint `md`. Remplace le menu latéral desktop pour une ergonomie au
// pouce, avec padding de zone de sécurité pour la barre d'accueil iPhone.
const NAV = [
  { to: '/', label: 'Accueil', icon: LayoutDashboard, end: true },
  { to: '/clients', label: 'Clients', icon: Building2 },
  { to: '/candidats', label: 'Candidats', icon: UserSquare2 },
  { to: '/besoins', label: 'Besoins', icon: Briefcase },
  { to: '/parametres', label: 'Réglages', icon: Settings },
];

export default function MobileNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-slate2-100 flex items-stretch"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] text-[11px] font-medium ${
              isActive ? 'text-brand-700' : 'text-slate2-500'
            }`
          }
        >
          <Icon size={20} strokeWidth={2} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
