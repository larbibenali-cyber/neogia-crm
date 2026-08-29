import { createClient } from '@supabase/supabase-js';

// Clé publique (anon/publishable) uniquement : elle est prévue pour être visible
// dans le navigateur et ne donne accès à rien sans une session utilisateur valide
// (RLS + vérification côté serveur). Aucune clé secrète n'est jamais présente ici.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Configuration manquante : VITE_SUPABASE_URL et/ou VITE_SUPABASE_ANON_KEY doivent être définies au moment du build du frontend.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
