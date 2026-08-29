import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Lock, Mail } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import logo from '../assets/neogia-logo.png';

export default function Login() {
  const { signIn, sendPasswordReset } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('login'); // 'login' | 'reset'
  const [resetSent, setResetSent] = useState(false);

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        err.message?.includes('Invalid login credentials')
          ? 'E-mail ou mot de passe incorrect.'
          : err.message || 'Connexion impossible.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setResetSent(true);
    } catch (err) {
      setError(err.message || 'Envoi impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate2-50 px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="Neogia" className="h-10 mb-4" />
          <h1 className="text-lg font-heading font-semibold text-slate2-900">
            {mode === 'login' ? 'Connexion au CRM' : 'Réinitialiser le mot de passe'}
          </h1>
          <p className="text-sm text-slate2-500 mt-1 text-center">
            {mode === 'login'
              ? 'Accès réservé aux administrateurs Neogia.'
              : "Vous recevrez un e-mail avec un lien pour choisir un nouveau mot de passe."}
          </p>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-sm font-medium text-slate2-700 mb-1">E-mail</span>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate2-400" />
                <input
                  type="email" required autoFocus autoComplete="email"
                  className="input !pl-9" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@neogia.fr"
                />
              </div>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate2-700 mb-1">Mot de passe</span>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate2-400" />
                <input
                  type="password" required autoComplete="current-password"
                  className="input !pl-9" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </label>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" className="btn btn-primary w-full justify-center" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Se connecter'}
            </button>
            <button
              type="button"
              className="text-sm text-slate2-500 hover:text-brand w-full text-center"
              onClick={() => { setMode('reset'); setError(null); }}
            >
              Mot de passe oublié ?
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            {resetSent ? (
              <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-3">
                Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d'être envoyé. Vérifiez votre boîte de réception.
              </p>
            ) : (
              <>
                <label className="block">
                  <span className="block text-sm font-medium text-slate2-700 mb-1">E-mail</span>
                  <input
                    type="email" required autoFocus className="input" value={email}
                    onChange={(e) => setEmail(e.target.value)} placeholder="vous@neogia.fr"
                  />
                </label>
                {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                <button type="submit" className="btn btn-primary w-full justify-center" disabled={loading}>
                  {loading ? <Loader2 size={16} className="animate-spin" /> : 'Envoyer le lien de réinitialisation'}
                </button>
              </>
            )}
            <button
              type="button"
              className="text-sm text-slate2-500 hover:text-brand w-full text-center"
              onClick={() => { setMode('login'); setError(null); setResetSent(false); }}
            >
              Retour à la connexion
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
