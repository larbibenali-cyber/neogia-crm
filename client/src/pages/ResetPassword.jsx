import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import logo from '../assets/neogia-logo.png';

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Le mot de passe doit contenir au moins 8 caractères.');
    if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas.');
    setLoading(true);
    try {
      await updatePassword(password);
      setDone(true);
      setTimeout(() => navigate('/', { replace: true }), 1500);
    } catch (err) {
      setError(err.message || 'Impossible de mettre à jour le mot de passe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate2-50 px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="Neogia" className="h-10 mb-4" />
          <h1 className="text-lg font-heading font-semibold text-slate2-900">Choisir un nouveau mot de passe</h1>
          <p className="text-sm text-slate2-500 mt-1 text-center">Ce mot de passe sera le vôtre : personne d'autre ne le connaîtra.</p>
        </div>
        {done ? (
          <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-3">Mot de passe mis à jour. Redirection...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-sm font-medium text-slate2-700 mb-1">Nouveau mot de passe</span>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate2-400" />
                <input type="password" required autoFocus className="input !pl-9" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8 caractères minimum" />
              </div>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate2-700 mb-1">Confirmer le mot de passe</span>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate2-400" />
                <input type="password" required className="input !pl-9" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="8 caractères minimum" />
              </div>
            </label>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" className="btn btn-primary w-full justify-center" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Enregistrer'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
