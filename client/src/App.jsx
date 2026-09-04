import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import GlobalSearch from './components/GlobalSearch';
import Dashboard from './pages/Dashboard';
import ClientsList from './pages/Clients/ClientsList';
import ContactDetail from './pages/Clients/ContactDetail';
import EntrepriseDetail from './pages/Clients/EntrepriseDetail';
import CandidatsList from './pages/Candidats/CandidatsList';
import CandidatDetail from './pages/Candidats/CandidatDetail';
import BesoinsList from './pages/Besoins/BesoinsList';
import BesoinDetail from './pages/Besoins/BesoinDetail';
import Echanges from './pages/Echanges';
import EmailTemplates from './pages/EmailTemplates';
import Parametres from './pages/Parametres';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { usePickLists } from './lib/PickListsContext';
import { Loading } from './components/ui';

function RequireAuth({ children }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loading label="Vérification de la session..." /></div>;
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function AppShell() {
  const { signOut } = useAuth();
  const { loaded, reload } = usePickLists();
  useEffect(() => {
    // Le premier chargement des listes de statuts (au démarrage de l'app, avant
    // connexion) échoue volontairement (401, voir api.js) : on le relance ici,
    // une fois qu'on est certain d'être authentifié.
    if (!loaded) reload();
  }, [loaded, reload]);
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <header
          className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate2-100 px-4 md:px-8 py-3 flex items-center justify-between gap-3 md:gap-6"
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
        >
          <GlobalSearch />
          <button onClick={signOut} className="btn btn-ghost shrink-0 px-2 md:px-4" title="Se déconnecter">
            <LogOut size={15} /> <span className="hidden md:inline">Déconnexion</span>
          </button>
        </header>
        <main className="p-4 md:p-8 pb-24 md:pb-8 max-w-[1600px] mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients" element={<ClientsList />} />
            <Route path="/clients/entreprise/:id" element={<EntrepriseDetail />} />
            <Route path="/clients/contact/:id" element={<ContactDetail />} />
            <Route path="/candidats" element={<CandidatsList />} />
            <Route path="/candidats/:id" element={<CandidatDetail />} />
            <Route path="/besoins" element={<BesoinsList />} />
            <Route path="/besoins/:id" element={<BesoinDetail />} />
            <Route path="/echanges" element={<Echanges />} />
            <Route path="/modeles-email" element={<EmailTemplates />} />
            <Route path="/parametres" element={<Parametres />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<RequireAuth><ResetPassword /></RequireAuth>} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
