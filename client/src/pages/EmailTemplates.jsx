import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Copy, Trash2, FileText, EyeOff, Eye } from 'lucide-react';
import { api } from '../lib/api';
import { Loading, EmptyState, Modal, Field } from '../components/ui';
import { useToast } from '../lib/ToastContext';
import { useConfirm } from '../lib/ConfirmContext';

// Variables de personnalisation disponibles dans l'objet et le contenu d'un
// modèle — utilisées à la fois ici (aide-mémoire) et à l'étape de
// prévisualisation/envoi (résolution réelle par destinataire).
export const TEMPLATE_VARIABLES = [
  { key: 'prenom', desc: 'Prénom du contact' },
  { key: 'nom', desc: 'Nom du contact' },
  { key: 'entreprise', desc: "Nom de l'entreprise" },
  { key: 'fonction', desc: 'Fonction du contact' },
  { key: 'signature', desc: 'Votre signature (réglée dans Paramètres)' },
];

// Remplace {{variable}} par sa valeur réelle pour un contact donné — utilisé
// à la fois pour l'aperçu instantané et pour le texte réellement envoyé.
export function resolveTemplateVars(str, { contact, signature }) {
  if (!str) return '';
  const values = {
    prenom: contact?.prenom || '',
    nom: contact?.nom || '',
    entreprise: contact?.entreprise_nom || '',
    fonction: contact?.fonction || '',
    signature: signature || '',
  };
  return str.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key) => (key in values ? values[key] : m));
}

const EMPTY = { nom: '', objet: '', contenu: '', actif: true };

export default function EmailTemplates() {
  const [templates, setTemplates] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState({ open: false, template: null });
  const toast = useToast();
  const confirm = useConfirm();

  const load = () => {
    api.get('/email-templates')
      .then(setTemplates)
      .catch((e) => setError(e.message || 'Impossible de charger les modèles.'));
  };
  useEffect(() => { load(); }, []);

  const duplicate = async (t) => {
    try {
      await api.post(`/email-templates/${t.id}/duplicate`, {});
      toast('Modèle dupliqué.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  };

  const toggleActif = async (t) => {
    try {
      await api.put(`/email-templates/${t.id}`, { actif: !t.actif });
      load();
    } catch (err) { toast(err.message, 'error'); }
  };

  const remove = async (t) => {
    const ok = await confirm({
      title: 'Supprimer ce modèle ?',
      message: `« ${t.nom} » sera définitivement supprimé. L'historique des e-mails déjà envoyés avec ce modèle est conservé.`,
      danger: true,
      confirmLabel: 'Supprimer',
    });
    if (!ok) return;
    try {
      await api.del(`/email-templates/${t.id}`);
      toast('Modèle supprimé.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <Link to="/parametres" className="text-sm text-slate2-500 hover:text-brand flex items-center gap-1 mb-2">
          <ArrowLeft size={14} /> Paramètres
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-heading font-semibold text-slate2-900 flex items-center gap-2">
              <FileText size={22} className="text-brand" /> Modèles d'e-mails
            </h1>
            <p className="text-slate2-500 text-sm mt-1">Utilisés lors de l'envoi d'e-mails de prospection depuis un contact ou une entreprise.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setModal({ open: true, template: null })}>
            <Plus size={14} /> Nouveau modèle
          </button>
        </div>
      </div>

      <div className="card p-4">
        <p className="text-xs text-slate2-500">
          Variables disponibles dans l'objet et le contenu :{' '}
          {TEMPLATE_VARIABLES.map((v, i) => (
            <span key={v.key}>
              <code className="bg-slate2-100 text-slate2-700 px-1.5 py-0.5 rounded" title={v.desc}>{'{{'}{v.key}{'}}'}</code>
              {i < TEMPLATE_VARIABLES.length - 1 ? ' ' : ''}
            </span>
          ))}
        </p>
      </div>

      {error && <EmptyState title="Impossible de charger les modèles" description={error} />}
      {!error && !templates && <Loading />}
      {!error && templates && templates.length === 0 && (
        <EmptyState icon={FileText} title="Aucun modèle" description="Créez votre premier modèle d'e-mail de prospection." />
      )}

      {!error && templates && templates.length > 0 && (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className={`card p-4 ${!t.actif ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-heading font-semibold text-slate2-900">{t.nom}</h3>
                    {!t.actif && <span className="tech-tag bg-slate2-100 text-slate2-500">Désactivé</span>}
                  </div>
                  <p className="text-sm text-slate2-600 mt-1">{t.objet || <span className="text-slate2-400 italic">Sans objet</span>}</p>
                  <p className="text-sm text-slate2-400 mt-1 line-clamp-2 whitespace-pre-wrap">{t.contenu}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button className="btn btn-ghost" title="Modifier" onClick={() => setModal({ open: true, template: t })}><Pencil size={14} /></button>
                  <button className="btn btn-ghost" title="Dupliquer" onClick={() => duplicate(t)}><Copy size={14} /></button>
                  <button className="btn btn-ghost" title={t.actif ? 'Désactiver' : 'Activer'} onClick={() => toggleActif(t)}>
                    {t.actif ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button className="btn btn-ghost text-red-500" title="Supprimer" onClick={() => remove(t)}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <TemplateFormModal
        open={modal.open}
        template={modal.template}
        onClose={() => setModal({ open: false, template: null })}
        onSaved={load}
      />
    </div>
  );
}

function TemplateFormModal({ open, template, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (open) setForm(template ? { ...EMPTY, ...template } : EMPTY);
  }, [open, template]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.nom.trim()) return toast('Le nom du modèle est requis.', 'error');
    if (!form.objet.trim()) return toast("L'objet est requis.", 'error');
    if (!form.contenu.trim()) return toast('Le contenu est requis.', 'error');
    setSaving(true);
    try {
      if (template) await api.put(`/email-templates/${template.id}`, form);
      else await api.post('/email-templates', form);
      toast('Modèle enregistré.', 'success');
      onSaved();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={template ? 'Modifier le modèle' : 'Nouveau modèle'} wide>
      <Field label="Nom du modèle" required hint="Usage interne, non visible par le destinataire.">
        <input className="input" value={form.nom} onChange={set('nom')} placeholder="Ex. Première prise de contact" />
      </Field>
      <Field label="Objet" required>
        <input className="input" value={form.objet} onChange={set('objet')} placeholder="Ex. {{prenom}}, une question sur {{entreprise}}" />
      </Field>
      <Field label="Contenu" required hint="Variables disponibles : {{prenom}}, {{nom}}, {{entreprise}}, {{fonction}}, {{signature}}.">
        <textarea
          className="input"
          rows={12}
          style={{ resize: 'vertical', minHeight: '14rem' }}
          value={form.contenu}
          onChange={set('contenu')}
          placeholder={"Bonjour {{prenom}},\n\n...\n\n{{signature}}"}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-slate2-700 mt-1">
        <input type="checkbox" checked={!!form.actif} onChange={(e) => setForm((f) => ({ ...f, actif: e.target.checked }))} />
        Modèle actif (proposé lors de l'envoi)
      </label>

      <div className="flex justify-end gap-2 mt-4">
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={saving} onClick={submit}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
      </div>
    </Modal>
  );
}
