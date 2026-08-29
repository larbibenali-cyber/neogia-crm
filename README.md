# Neogia CRM — Cabinet de conseil Data & IA

CRM interne complet pour Neogia : gestion des clients (entreprises, contacts, historique d'échanges), des candidats/consultants (avec CV), des besoins commerciaux, et des positionnements candidat ↔ besoin, avec suggestions de compatibilité technique.

L'application est livrée **avec les données déjà importées et nettoyées** depuis le fichier Excel fourni (170 entreprises, 2 296 contacts). Les modules Candidats et Besoins sont vides à la livraison (le fichier Excel ne contenait pas ce type de données) et prêts à être alimentés.

## 1. Lancer l'application

Prérequis : [Node.js](https://nodejs.org) version 18 ou supérieure.

```bash
# 1. Installer les dépendances (backend + frontend)
npm install
cd client && npm install && npm run build && cd ..

# 2. Démarrer le serveur
npm start
```

Puis ouvrez **http://localhost:4000** dans votre navigateur. L'application fonctionne en local sur votre machine ; aucune connexion internet n'est nécessaire après l'installation (hormis le chargement des polices Google Fonts, avec repli automatique sur les polices système si hors ligne).

Pour arrêter l'application : `Ctrl + C` dans le terminal. Vos données sont conservées automatiquement (base SQLite dans `data/neogia_crm.sqlite`) : vous pouvez fermer et rouvrir l'application sans aucune perte.

### Réimporter le fichier Excel plus tard

Le fichier original n'a jamais été modifié (une copie horodatée est conservée dans `data/original_imports/`). Pour importer une mise à jour du fichier Excel (même structure : un onglet par entreprise) sans dupliquer les fiches existantes :

```bash
node import/import_excel.js /chemin/vers/nouveau_fichier.xlsx
```

Ou depuis l'application : **Paramètres → Import Excel**. Un rapport détaillé (créations, mises à jour, doublons fusionnés/signalés, technologies) s'affiche à chaque import.

## 2. Modifier les statuts et champs personnalisables

Les statuts (client, candidat, besoin, positionnement), les types d'échange et les niveaux de priorité sont stockés en base et modifiables sans toucher au code, depuis **Paramètres → Statuts & listes personnalisables** : ajout d'une valeur, renommage, changement de couleur, désactivation. Les technologies suivent le même principe : une technologie non reconnue automatiquement à l'import est conservée telle quelle et apparaît comme "technologie personnalisée" (fond violet) dans les nuages technologiques ; les catégories techniques (Cloud, Data Platforms, BI...) sont éditables dans `db/init.js` si vous souhaitez en ajouter.

Pour ajouter un champ de fiche (client, candidat, besoin), il faut : ajouter la colonne dans `db/schema.sql`, l'exposer dans la route API correspondante (`server/routes/*.js`), puis l'ajouter au formulaire React concerné (`client/src/components/*FormModal.jsx`).

## 3. Structure technique

- **Backend** : Node.js + Express, base de données **SQLite** (fichier local `data/neogia_crm.sqlite`, persistant) via `better-sqlite3`. API REST sous `/api/*`.
- **Frontend** : React + Vite + Tailwind CSS, compilé en fichiers statiques servis directement par Express (dossier `public/`).
- **Fichiers** : les CV (PDF) sont stockés sur disque dans `uploads/cvs/` et référencés en base.
- **Import Excel** : `import/import_excel.js` (nettoyage, normalisation, dédoublonnage, découpage de l'historique en échanges datés, normalisation des technologies) — voir `import/tech_taxonomy.js` pour la table de correspondance des technologies et `import/clean_utils.js` pour les fonctions de nettoyage.
- **Moteur de rapprochement candidat/besoin** : `server/matching.js` — score de compatibilité basé sur les compétences obligatoires/appréciées, le métier, l'expérience, la disponibilité et la localisation. Toujours une aide à la décision, jamais un positionnement automatique.
- **Comptes / droits** : un seul compte administrateur pour cette version (table `users` déjà prête en base avec un champ `role` pour ajouter plus tard plusieurs utilisateurs et niveaux de droits sans changer le schéma).

### Modèle de données → colonnes Excel

| Table | Origine Excel |
|---|---|
| `entreprises` | nom de l'onglet |
| `contacts` | Nom, Prénom, Adresse e-mail, Numéro mobile, Numéro fixe |
| `echanges` | Historique d'échange (découpé automatiquement par date détectée dans le texte) |
| `technologies` / `entreprise_technologies` | Environnement tech (normalisé et catégorisé) |
| `candidats`, `besoins`, `positionnements`, `cvs` | vides à l'import — alimentés depuis l'application |

## 4. Limites connues

- **Extraction automatique du CV** : une extraction indicative (e-mail, téléphone, années d'expérience, premier intitulé) est proposée après dépôt d'un CV, mais reste approximative selon la mise en forme du PDF — une validation manuelle est toujours demandée avant enregistrement, comme prévu dans le cahier des charges.
- **Restauration d'une sauvegarde** : le téléchargement de sauvegarde (Paramètres → Sauvegarde) fonctionne à chaud. La **restauration**, elle, dépose la sauvegarde sur disque puis nécessite un redémarrage manuel de l'application (`Ctrl+C` puis `npm start`) pour l'appliquer en toute sécurité — un remplacement à chaud du fichier de base de données pendant qu'il est utilisé serait risqué.
- **Dates d'échange importées** : le fichier Excel source ne comportait pas de colonne date dédiée ; les dates ont été extraites du texte libre de l'historique (format JJ/MM, parfois sans année). Environ 150 échanges sur 2 312 lignes comportaient une date exploitable — les autres échanges importés restent rattachés au contact mais sans date précise (affichée "—"), sans que l'information soit perdue.
- **Compte unique** : une seule session administrateur pour cette version ; l'authentification multi-utilisateurs n'est pas encore branchée (le modèle de données est prêt).
- **Application locale** : par défaut, l'application tourne sur votre machine (`localhost`). Voir la section hébergement ci-dessous pour un accès partagé/distant.

## 5. Recommandations pour la suite (sécurisation et hébergement)

Cette version est une application locale complète et fonctionnelle. Pour la déployer en ligne et la partager avec plusieurs collaborateurs :

1. **Hébergement** : déployer le backend Node.js sur un serveur ou PaaS (Railway, Render, Fly.io, ou un VPS classique). Le frontend compilé (`public/`) est déjà servi par le même serveur Express — aucun service séparé n'est nécessaire.
2. **Base de données** : SQLite convient pour un usage mono-serveur avec quelques utilisateurs concurrents ; pour davantage de charge ou une haute disponibilité, migrer vers PostgreSQL (le code SQL utilisé reste proche, migration raisonnable).
3. **Authentification** : ajouter un système de connexion (email/mot de passe ou SSO) et exploiter le champ `role` déjà présent sur `users` pour des droits différenciés (lecture seule, commercial, admin).
4. **HTTPS** : mettre l'application derrière un reverse proxy (nginx, Caddy) avec certificat TLS (Let's Encrypt).
5. **Sauvegardes automatiques** : planifier un export régulier via l'endpoint `/api/backup` (ex. tâche cron quotidienne) vers un stockage externe (S3, disque distant).
6. **Fichiers (CV)** : pour un hébergement cloud, remplacer le stockage disque local par un stockage objet (S3 ou équivalent) si plusieurs instances du serveur doivent partager les fichiers.
7. **Variables sensibles** : externaliser tout secret (clé de session, identifiants de base distante) dans des variables d'environnement, jamais dans le code.

## 6. Parcours testés

Les parcours suivants ont été validés de bout en bout (recherche → fiche → historique → besoin → candidat → CV → positionnement → vérification croisée → persistance → réimport) avant livraison.
