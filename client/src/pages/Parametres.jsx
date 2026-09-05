import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { UploadCloud, Download, DatabaseBackup, Plus, Pencil, Mail, CheckCircle2, XCircle, FileText, KeyRound } from 'lucide-react';
import { api, downloadFile } from '../lib/api';
import { usePickLists } from '../lib/PickListsContext';
import { useToast } from '../lib/ToastContext';
import { Modal, Field } from '../components/ui';
import ImportWizard from '../components/ImportWizard';

const CATEGORY_LABELS = {
  contact_status: 'Statuts client / contact',
  candidat_status: 'Statuts candidat',
  besoin_status: 'Statuts besoin',
  positionnement_status: 'Statuts positionnement',
  echange_type: "Types d'échange",
  besoin_priorite: 'Priorités de besoin',
};

export default function Parametres() {
  const { lists, reload } = usePickLists();
  const toast = useToast();
  const restoreInput = useRef(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [addCategory, setAddCategory] = useState(null);
  const [params, setParams] = useSearchParams();

  // Après le retour du flux OAuth Gmail (server/routes/gmailPublic.js
  // redirige ici avec ?gmail=connected|error), on informe l'utilisateur puis
  // on nettoie l'URL pour ne pas re-déclencher le toast à un rechargement.
  useEffect(() => {
    const status = params.get('gmail');
    if (!status) return;
    if (status === 'connected') toast(`Compte Gmail connecté (${params.get('email') || ''}).`, 'success');
    else if (status === 'error') toast(`Connexion Gmail impossible : ${params.get('reason') || 'erreur inconnue'}.`, 'error');
    const next = new URLSearchParams(params);
    next.delete('gmail'); next.delete('email'); next.delete('reason');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRestore = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post('/backup/restore', fd);
      toast(res.message, 'success');
    } catch (err) { toast(err.message, 'error'); }
  };

  const saveItem = async (item, patch) => {
    await api.put(`/picklists/${item.id}`, patch);
    reload();
    setEditItem(null);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-slate2-900">Paramètres</h1>
        <p className="text-slate2-500 text-sm mt-1">Import de données, sauvegardes et personnalisation des statuts.</p>
      </div>

      <GmailConnectionCard />

      <ExtensionLinkedInCard />

      <div className="card p-6">
        <h2 className="font-heading font-semibold text-slate2-900 mb-1">Import Excel</h2>
        <p className="text-sm text-slate2-500 mb-3">Importez ou réimportez un fichier Excel via l'assistant guidé : aperçu des données, confirmation du mapping des colonnes, puis import réel. Les entreprises et contacts déjà en base ne seront jamais dupliqués, seulement mis à jour.</p>
        <button className="btn btn-secondary" onClick={() => setWizardOpen(true)}><UploadCloud size={16} /> Lancer l'assistant d'import</button>
        <ImportWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onImported={reload} />
      </div>

      <div className="card p-6">
        <h2 className="font-heading font-semibold text-slate2-900 mb-1">Sauvegarde &amp; restauration</h2>
        <p className="text-sm text-slate2-500 mb-3">Exportez une sauvegarde complète des données (base) ou réimportez une sauvegarde précédente. Les CV sont conservés séparément et durablement dans le stockage Supabase.</p>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => downloadFile('/backup', 'neogia-crm-backup.zip').catch((e) => toast(e.message, 'error'))}>
            <DatabaseBackup size={16} /> Télécharger la sauvegarde
          </button>
          <button className="btn btn-secondary" onClick={() => restoreInput.current?.click()}><UploadCloud size={16} /> Restaurer une sauvegarde</button>
          <input ref={restoreInput} type="file" accept=".zip" hidden onChange={(e) => handleRestore(e.target.files[0])} />
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-heading font-semibold text-slate2-900 mb-1">Export des listes</h2>
        <p className="text-sm text-slate2-500 mb-3">Exportez l'ensemble des fiches au format Excel ou CSV.</p>
        <div className="flex flex-wrap gap-2">
          {['entreprises', 'contacts', 'candidats', 'besoins'].map((e) => (
            <div key={e} className="flex gap-1">
              <button className="btn btn-ghost" onClick={() => downloadFile(`/export/${e}.xlsx`, `${e}.xlsx`).catch((err) => toast(err.message, 'error'))}><Download size={14} /> {e} (.xlsx)</button>
              <button className="btn btn-ghost" onClick={() => downloadFile(`/export/${e}.csv`, `${e}.csv`).catch((err) => toast(err.message, 'error'))}><Download size={14} /> {e} (.csv)</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-heading font-semibold text-slate2-900 mb-3">Statuts &amp; listes personnalisables</h2>
        <div className="space-y-5">
          {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
            <div key={cat}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate2-700">{label}</h3>
                <button className="btn btn-ghost !text-xs" onClick={() => setAddCategory(cat)}><Plus size={13} /> Ajouter</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(lists[cat] || []).map((item) => (
                  <button key={item.id} className="tech-tag border" style={{ color: item.color, background: `${item.color}18` }} onClick={() => setEditItem(item)}>
                    {item.label} <Pencil size={11} className="ml-1" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {editItem && (
        <EditPickListModal item={editItem} onClose={() => setEditItem(null)} onSave={(patch) => saveItem(editItem, patch)} />
      )}
      {addCategory && (
        <AddPickListModal category={addCategory} onClose={() => setAddCategory(null)} onSaved={() => { reload(); setAddCategory(null); }} />
      )}
    </div>
  );
}

function EditPickListModal({ item, onClose, onSave }) {
  const [label, setLabel] = useState(item.label);
  const [color, setColor] = useState(item.color);
  return (
    <Modal open onClose={onClose} title="Modifier la valeur">
      <Field label="Libellé"><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
      <Field label="Couleur"><input type="color" className="input h-10" value={color} onChange={(e) => setColor(e.target.value)} /></Field>
      <div className="flex justify-between mt-4">
        <button className="btn btn-danger" onClick={() => onSave({ active: false })}>Désactiver</button>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={() => onSave({ label, color })}>Enregistrer</button>
        </div>
      </div>
    </Modal>
  );
}

// Carte "Prospection e-mail" : statut de connexion au compte Gmail
// professionnel (connecter / déconnecter / reconnecter) + accès à la
// rubrique Modèles d'e-mails. Le token lui-même n'est jamais renvoyé au
// frontend — seuls l'adresse connectée et la date de connexion le sont.
function GmailConnectionCard() {
  const toast = useToast();
  const [status, setStatus] = useState(null); // { connected, email, connectedAt } | null (chargement)
  const [busy, setBusy] = useState(false);
  const [signature, setSignature] = useState('');
  const [signatureSaving, setSignatureSaving] = useState(false);

  const load = () => {
    api.get('/gmail/status')
      .then(setStatus)
      .catch((e) => toast(e.message, 'error'));
  };
  useEffect(() => {
    load();
    api.get('/settings/signature').then((s) => setSignature(s.value || '')).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSignature = async () => {
    setSignatureSaving(true);
    try {
      await api.put('/settings/signature', { value: signature });
      toast('Signature enregistrée.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSignatureSaving(false); }
  };

  const connect = async () => {
    setBusy(true);
    try {
      const { url } = await api.get('/gmail/oauth/start');
      // Navigation complète (pas une popup) : l'écran de consentement Google
      // n'autorise pas toujours l'affichage en popup selon la configuration
      // du compte, et ça reste plus simple/fiable sur mobile (PWA).
      window.location.href = url;
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await api.post('/gmail/disconnect', {});
      toast('Compte Gmail déconnecté.', 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setBusy(false); }
  };

  return (
    <div className="card p-6">
      <h2 className="font-heading font-semibold text-slate2-900 mb-1">Prospection e-mail</h2>
      <p className="text-sm text-slate2-500 mb-4">Connectez votre adresse Gmail professionnelle pour envoyer des e-mails de prospection depuis le CRM. Votre mot de passe Gmail n'est jamais demandé ni enregistré — seule une autorisation Google (OAuth) est utilisée, révocable à tout moment.</p>

      {status === null && <p className="text-sm text-slate2-400">Vérification du statut...</p>}

      {status && (
        <div className="flex items-center justify-between flex-wrap gap-3 p-3 rounded-xl bg-slate2-50 mb-4">
          <div className="flex items-center gap-2">
            {status.connected ? <CheckCircle2 size={18} className="text-green-600" /> : <XCircle size={18} className="text-slate2-400" />}
            <div>
              <p className="text-sm font-medium text-slate2-800">
                {status.connected ? `Connecté : ${status.email}` : 'Aucun compte Gmail connecté'}
              </p>
              {status.connected && status.connectedAt && (
                <p className="text-xs text-slate2-400">Depuis le {new Date(status.connectedAt).toLocaleDateString('fr-FR')}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {status.connected ? (
              <>
                <button className="btn btn-ghost" disabled={busy} onClick={connect}><Mail size={14} /> Reconnecter</button>
                <button className="btn btn-danger" disabled={busy} onClick={disconnect}>Déconnecter</button>
              </>
            ) : (
              <button className="btn btn-primary" disabled={busy} onClick={connect}><Mail size={14} /> Connecter mon compte Gmail</button>
            )}
          </div>
        </div>
      )}

      <label className="block mb-4">
        <span className="block text-sm font-medium text-slate2-700 mb-1">Signature e-mail</span>
        <textarea
          className="input"
          rows={4}
          style={{ resize: 'vertical' }}
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder={"Cordialement,\nPrénom Nom\nNeogia — Data & IA"}
        />
        <span className="block text-xs text-slate2-400 mt-1">Utilisée par la variable {'{{signature}}'} dans les modèles d'e-mails.</span>
      </label>
      <div className="flex gap-2 flex-wrap">
        <button className="btn btn-secondary" disabled={signatureSaving} onClick={saveSignature}>
          {signatureSaving ? 'Enregistrement...' : 'Enregistrer la signature'}
        </button>
        <Link to="/modeles-email" className="btn btn-secondary">
          <FileText size={14} /> Gérer les modèles d'e-mails
        </Link>
      </div>
    </div>
  );
}

// Carte "Extension navigateur LinkedIn" : génère/révoque le jeton d'accès
// personnel utilisé par l'extension Chrome pour importer un contact depuis
// une fiche LinkedIn. Le jeton en clair n'est affiché qu'une seule fois, à
// la génération — seule sa présence (oui/non) et sa date sont conservées
// côté interface ensuite.
function ExtensionLinkedInCard() {
  const toast = useToast();
  const [status, setStatus] = useState(null); // { exists, createdAt } | null
  const [busy, setBusy] = useState(false);
  const [newToken, setNewToken] = useState(null);

  const load = () => {
    api.get('/settings/extension-token').then(setStatus).catch((e) => toast(e.message, 'error'));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const generate = async () => {
    if (status?.exists && !window.confirm("Un jeton existe déjà. Le régénérer invalidera l'extension actuellement configurée avec l'ancien jeton. Continuer ?")) return;
    setBusy(true);
    try {
      const res = await api.post('/settings/extension-token', {});
      setNewToken(res.token);
      load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };

  const revoke = async () => {
    if (!window.confirm("Révoquer ce jeton ? L'extension ne pourra plus importer de contacts tant qu'un nouveau jeton ne sera pas généré et reconfiguré dedans.")) return;
    setBusy(true);
    try {
      await api.del('/settings/extension-token');
      toast('Jeton révoqué.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };

  const copyToken = () => {
    if (!newToken) return;
    navigator.clipboard?.writeText(newToken).then(() => toast('Jeton copié.', 'success')).catch(() => {});
  };

  return (
    <div className="card p-6">
      <h2 className="font-heading font-semibold text-slate2-900 mb-1">Extension navigateur LinkedIn</h2>
      <p className="text-sm text-slate2-500 mb-4">
        L'extension Chrome fournie ajoute un bouton d'import en un clic sur les fiches LinkedIn : nom, poste, ville et
        lien du profil sont envoyés ici, avec confirmation avant de créer une nouvelle entreprise ou un contact en
        double. Générez un jeton d'accès ci-dessous, puis collez-le dans les réglages de l'extension — votre mot de
        passe du CRM n'est lui jamais demandé dans l'extension.
      </p>

      {status === null && <p className="text-sm text-slate2-400">Vérification du statut...</p>}

      {status && (
        <div className="flex items-center justify-between flex-wrap gap-3 p-3 rounded-xl bg-slate2-50 mb-2">
          <div className="flex items-center gap-2">
            {status.exists ? <CheckCircle2 size={18} className="text-green-600" /> : <XCircle size={18} className="text-slate2-400" />}
            <div>
              <p className="text-sm font-medium text-slate2-800">
                {status.exists ? 'Un jeton est actif' : 'Aucun jeton généré'}
              </p>
              {status.exists && status.createdAt && (
                <p className="text-xs text-slate2-400">Généré le {new Date(status.createdAt).toLocaleDateString('fr-FR')}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={busy} onClick={generate}>
              <KeyRound size={14} /> {status.exists ? 'Régénérer' : 'Générer un jeton'}
            </button>
            {status.exists && <button className="btn btn-danger" disabled={busy} onClick={revoke}>Révoquer</button>}
          </div>
        </div>
      )}

      {newToken && (
        <Modal open onClose={() => setNewToken(null)} title="Jeton d'accès généré">
          <p className="text-sm text-slate2-600 mb-3">
            Copiez ce jeton maintenant et collez-le dans les réglages de l'extension Chrome. Il ne sera plus jamais
            affiché — s'il est perdu, il faudra en régénérer un nouveau (ce qui invalidera celui-ci).
          </p>
          <div className="flex gap-2">
            <input className="input font-mono text-xs" readOnly value={newToken} onFocus={(e) => e.target.select()} />
            <button className="btn btn-secondary shrink-0" onClick={copyToken}>Copier</button>
          </div>
          <div className="flex justify-end mt-4">
            <button className="btn btn-primary" onClick={() => setNewToken(null)}>J'ai copié le jeton</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AddPickListModal({ category, onClose, onSaved }) {
  const [label, setLabel] = useState('');
  const toast = useToast();
  const submit = async () => {
    if (!label.trim()) return;
    const value = label.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_');
    try {
      await api.post('/picklists', { category, value, label, color: '#4527EA' });
      toast('Valeur ajoutée.', 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); }
  };
  return (
    <Modal open onClose={onClose} title="Ajouter une valeur">
      <Field label="Libellé"><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={submit}>Ajouter</button>
      </div>
    </Modal>
  );
}
