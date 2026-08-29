-- Neogia CRM — Schéma PostgreSQL (Supabase)
-- Traduit depuis db/schema.sql (SQLite). Toute donnée est protégée par RLS :
-- seul un utilisateur authentifié (Supabase Auth) peut lire/écrire quoi que ce soit.
-- Aucune policy n'est créée pour le rôle "anon" => accès public totalement refusé.

-- ==========================================================================
-- Listes de valeurs modifiables (statuts, types d'échange, catégories tech...)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS pick_lists (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category TEXT NOT NULL,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(category, value)
);

CREATE TABLE IF NOT EXISTS entreprises (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nom TEXT NOT NULL,
  nom_normalise TEXT NOT NULL,
  secteur TEXT,
  adresse TEXT,
  site_web TEXT,
  notes TEXT,
  archived BOOLEAN NOT NULL DEFAULT false,
  source_import TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entreprises_nom_normalise ON entreprises(nom_normalise);

CREATE TABLE IF NOT EXISTS contacts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entreprise_id BIGINT NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  nom TEXT,
  prenom TEXT,
  fonction TEXT,
  email TEXT,
  email_normalise TEXT,
  telephone_mobile TEXT,
  telephone_fixe TEXT,
  localisation TEXT,
  source TEXT,
  statut TEXT NOT NULL DEFAULT 'prospect_a_contacter',
  responsable TEXT,
  notes TEXT,
  tags TEXT,
  environnement_tech_notes TEXT,
  archived BOOLEAN NOT NULL DEFAULT false,
  duplicate_of BIGINT REFERENCES contacts(id),
  flagged_duplicate BOOLEAN NOT NULL DEFAULT false,
  flagged_reason TEXT,
  incomplete BOOLEAN NOT NULL DEFAULT false,
  dernier_echange_at TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contacts_entreprise ON contacts(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email_normalise ON contacts(email_normalise);
CREATE INDEX IF NOT EXISTS idx_contacts_nom ON contacts(nom, prenom);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_entreprise_email ON contacts(entreprise_id, email_normalise)
  WHERE email_normalise IS NOT NULL AND email_normalise != '';

CREATE TABLE IF NOT EXISTS echanges (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  contact_id BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  entreprise_id BIGINT NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  date_echange TEXT,
  date_approximative BOOLEAN NOT NULL DEFAULT false,
  type TEXT NOT NULL DEFAULT 'autre',
  objet TEXT,
  compte_rendu TEXT,
  prochaine_action TEXT,
  date_relance TEXT,
  auteur TEXT,
  source_import BOOLEAN NOT NULL DEFAULT false,
  dedup_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_echanges_contact ON echanges(contact_id);
CREATE INDEX IF NOT EXISTS idx_echanges_entreprise ON echanges(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_echanges_date ON echanges(date_echange);
CREATE UNIQUE INDEX IF NOT EXISTS idx_echanges_dedup ON echanges(contact_id, dedup_hash);

CREATE TABLE IF NOT EXISTS technologies (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nom TEXT NOT NULL UNIQUE,
  categorie TEXT NOT NULL DEFAULT 'Autre',
  aliases TEXT,
  custom BOOLEAN NOT NULL DEFAULT false,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_technologies_categorie ON technologies(categorie);

CREATE TABLE IF NOT EXISTS entreprise_technologies (
  entreprise_id BIGINT NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  technology_id BIGINT NOT NULL REFERENCES technologies(id) ON DELETE CASCADE,
  weight INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (entreprise_id, technology_id)
);

CREATE TABLE IF NOT EXISTS candidats (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prenom TEXT,
  nom TEXT,
  email TEXT,
  email_normalise TEXT,
  telephone TEXT,
  intitule_profil TEXT,
  metier TEXT,
  annees_experience REAL,
  competences_principales TEXT,
  secteurs TEXT,
  localisation TEXT,
  mobilite TEXT,
  disponibilite TEXT,
  disponibilite_date TEXT,
  tjm REAL,
  niveau_anglais TEXT,
  statut TEXT NOT NULL DEFAULT 'a_contacter',
  source TEXT,
  notes TEXT,
  archived BOOLEAN NOT NULL DEFAULT false,
  incomplete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_candidats_nom ON candidats(nom, prenom);
CREATE INDEX IF NOT EXISTS idx_candidats_email_normalise ON candidats(email_normalise);

CREATE TABLE IF NOT EXISTS candidat_technologies (
  candidat_id BIGINT NOT NULL REFERENCES candidats(id) ON DELETE CASCADE,
  technology_id BIGINT NOT NULL REFERENCES technologies(id) ON DELETE CASCADE,
  PRIMARY KEY (candidat_id, technology_id)
);

-- Les CV eux-mêmes sont dans Supabase Storage (bucket privé 'cvs') ;
-- cette table référence le chemin de l'objet dans le bucket (storage_path), jamais une URL publique.
CREATE TABLE IF NOT EXISTS cvs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  candidat_id BIGINT NOT NULL REFERENCES candidats(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime TEXT,
  size INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cvs_candidat ON cvs(candidat_id);

CREATE TABLE IF NOT EXISTS besoins (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  titre TEXT NOT NULL,
  entreprise_id BIGINT NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  contact_id BIGINT REFERENCES contacts(id) ON DELETE SET NULL,
  description_contexte TEXT,
  missions TEXT,
  competences_obligatoires TEXT,
  competences_appreciees TEXT,
  niveau_experience TEXT,
  localisation TEXT,
  teletravail TEXT,
  date_demarrage TEXT,
  duree_estimee TEXT,
  tjm_client REAL,
  tjm_candidat REAL,
  marge_estimee REAL,
  priorite TEXT NOT NULL DEFAULT 'normale',
  date_limite_reponse TEXT,
  source TEXT,
  notes_internes TEXT,
  statut TEXT NOT NULL DEFAULT 'lead_a_qualifier',
  echange_origine_id BIGINT REFERENCES echanges(id) ON DELETE SET NULL,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_besoins_entreprise ON besoins(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_besoins_statut ON besoins(statut);

CREATE TABLE IF NOT EXISTS besoin_technologies (
  besoin_id BIGINT NOT NULL REFERENCES besoins(id) ON DELETE CASCADE,
  technology_id BIGINT NOT NULL REFERENCES technologies(id) ON DELETE CASCADE,
  obligatoire BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (besoin_id, technology_id)
);

CREATE TABLE IF NOT EXISTS positionnements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  candidat_id BIGINT NOT NULL REFERENCES candidats(id) ON DELETE CASCADE,
  besoin_id BIGINT NOT NULL REFERENCES besoins(id) ON DELETE CASCADE,
  date_positionnement TIMESTAMPTZ NOT NULL DEFAULT now(),
  tjm_propose REAL,
  statut TEXT NOT NULL DEFAULT 'a_etudier',
  commentaires TEXT,
  date_entretien TEXT,
  retour_client TEXT,
  score_compatibilite REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(candidat_id, besoin_id)
);
CREATE INDEX IF NOT EXISTS idx_positionnements_candidat ON positionnements(candidat_id);
CREATE INDEX IF NOT EXISTS idx_positionnements_besoin ON positionnements(besoin_id);

CREATE TABLE IF NOT EXISTS import_reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  filename TEXT,
  report_json TEXT
);

-- ==========================================================================
-- Row Level Security : refus total par défaut, accès complet pour tout
-- utilisateur authentifié (le seul compte autorisé sera celui de l'admin,
-- l'inscription publique étant désactivée côté Supabase Auth).
-- ==========================================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'pick_lists','entreprises','contacts','echanges','technologies',
    'entreprise_technologies','candidats','candidat_technologies','cvs',
    'besoins','besoin_technologies','positionnements','import_reports'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS authenticated_full_access ON %I', t);
    EXECUTE format(
      'CREATE POLICY authenticated_full_access ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;
