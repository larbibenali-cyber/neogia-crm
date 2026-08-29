import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import Sidebar from './components/Sidebar';
import GlobalSearch from './components/GlobalSearch';
import Dashboard from './pages/Dashboard';
import ClientsList from './pages/Clients/ClientsList';
import ContactDetail from './pages/Clients/ContactDetail';
import EntrepriseDetail from './pages/Clients/EntrepriseDetail';
import CandidatsList from './pages/Candidats/CandidatsList';
import CandidatDetail from './pages/Candidats/CandidatDetail';
import BesoinsList from './pages/Besoins/BesoinsList';
import BesoinDetail from './pages/Besoins/BesoinDetail';
import Parametres from './pages/Parametres';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import { AuthProvider, useAuth } from './lib/AuthContext';
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
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate2-100 px-8 py-3 flex items-center justify-between gap-6">
          <GlobalSearch />
          <button onClick={signOut} className="btn btn-ghost shrink-0" title="Se déconnecter">
            <LogOut size={15} /> Déconnexion
          </button>
        </header>
        <main className="p-8 max-w-[1600px] mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients" element={<ClientsList />} />
            <Route path="/clients/entreprise/:id" element={<EntrepriseDetail />} />
            <Route path="/clients/contact/:id" element={<ContactDetail />} />
            <Route path="/candidats" element={<CandidatsList />} />
            <Route path="/candidats/:id" element={<CandidatDetail />} />
            <Route path="/besoins" element={<BesoinsList />} />
            <Route path="/besoins/:id" element={<BesoinDetail />} />
            <Route path="/parametres" element={<Parametres />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
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
