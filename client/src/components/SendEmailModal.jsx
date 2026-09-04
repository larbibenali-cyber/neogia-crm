import React, { useEffect, useState } from 'react';
import { Send, Paperclip, X, Mail } from 'lucide-react';
import { Modal, Field, Select } from './ui';
import { api } from '../lib/api';
import { useToast } from '../lib/ToastContext';
import { useConfirm } from '../lib/ConfirmContext';
import { resolveTemplateVars } from '../pages/EmailTemplates';

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENTS_BYTES = 20 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;

// Envoi individuel d'un e-mail de prospection à UN contact, depuis sa fiche.
// Étapes dans une seule modale : choix du modèle -> objet/contenu
// pré-remplis mais librement modifiables -> pièces jointes optionnelles
// (plusieurs) -> confirmation explicite avant l'envoi réel (rien ne part
// automatiquement).
export default function SendEmailModal({ open, onClose, contact, onSent }) {
  const [templates, setTemplates] = useState(null);
  const [signature, setSignature] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    if (!open) return;
    setTemplateId(''); setSubject(''); setBody(''); setAttachments([]); setTemplates(null);
    Promise.all([
      api.get('/email-templates?actif=true'),
      api.get('/settings/signature').catch(() => ({ value: '' })),
    ]).then(([tpls, sig]) => {
      setTemplates(tpls);
      setSignature(sig.value || '');
    }).catch(() => setTemplates([]));
  }, [open]);

  const pickTemplate = (id) => {
    setTemplateId(id);
    const t = (templates || []).find((x) => String(x.id) === String(id));
    if (!t) return;
    setSubject(resolveTemplateVars(t.objet, { contact, signature }));
    setBody(resolveTemplateVars(t.contenu, { contact, signature }));
  };

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    const next = [...attachments];
    for (const file of incoming) {
      if (next.length >= MAX_ATTACHMENTS) {
        toast(`Maximum ${MAX_ATTACHMENTS} pièces jointes.`, 'error');
        break;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast(`« ${file.name} » est trop volumineux (15 Mo maximum par fichier).`, 'error');
        continue;
      }
      const total = next.reduce((s, f) => s + f.size, 0) + file.size;
      if (total > MAX_TOTAL_ATTACHMENTS_BYTES) {
        toast('Taille totale des pièces jointes trop importante (20 Mo maximum au total).', 'error');
        continue;
      }
      next.push(file);
    }
    setAttachments(next);
  };

  const removeFile = (idx) => setAttachments((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    if (!subject.trim()) return toast("L'objet est requis.", 'error');
    if (!body.trim()) return toast('Le contenu est requis.', 'error');
    const ok = await confirm({
      title: "Envoyer cet e-mail ?",
      message: `L'e-mail sera envoyé maintenant, réellement, à ${contact.prenom} ${contact.nom} (${contact.email}) depuis votre compte Gmail. Cette action ne peut pas être annulée après confirmation.`,
      confirmLabel: 'Envoyer',
    });
    if (!ok) return;

    setSending(true);
    try {
      const fd = new FormData();
      fd.append('subject', subject);
      fd.append('body', body);
      if (templateId) fd.append('template_id', templateId);
      attachments.forEach((file) => fd.append('attachments', file));
      await api.post(`/contacts/${contact.id}/send-email`, fd);
      toast('E-mail envoyé.', 'success');
      onSent();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSending(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Envoyer un e-mail" wide>
      <div className="flex items-center gap-2 p-3 rounded-xl bg-slate2-50 mb-4 text-sm">
        <Mail size={15} className="text-brand shrink-0" />
        <span className="text-slate2-600">Destinataire : <strong className="text-slate2-800">{contact.prenom} {contact.nom}</strong> — {contact.email}</span>
      </div>

      <Field label="Modèle" hint="Optionnel : pré-remplit l'objet et le contenu ci-dessous, que vous pouvez ensuite modifier librement.">
        <Select value={templateId} onChange={(e) => pickTemplate(e.target.value)} disabled={!templates}>
          <option value="">{templates ? 'Sélectionner un modèle...' : 'Chargement...'}</option>
          {(templates || []).map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
        </Select>
      </Field>

      <Field label="Objet" required>
        <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </Field>

      <Field label="Contenu" required>
        <textarea
          className="input"
          rows={12}
          style={{ resize: 'vertical', minHeight: '14rem' }}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </Field>

      <Field label="Pièces jointes (facultatif)" hint={`Jusqu'à ${MAX_ATTACHMENTS} fichiers, 15 Mo max par fichier.`}>
        <div className="space-y-2">
          {attachments.map((file, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate2-200 text-sm">
              <span className="flex items-center gap-2 text-slate2-700 truncate"><Paperclip size={14} /> {file.name} ({Math.round(file.size / 1024)} Ko)</span>
              <button className="btn btn-ghost !px-2 !py-1 text-red-500" onClick={() => removeFile(idx)}><X size={14} /></button>
            </div>
          ))}
          {attachments.length < MAX_ATTACHMENTS && (
            <label className="btn btn-secondary cursor-pointer w-fit">
              <Paperclip size={14} /> Joindre un fichier
              <input type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            </label>
          )}
        </div>
      </Field>

      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate2-100">
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={sending} onClick={submit}>
          <Send size={14} /> {sending ? 'Envoi en cours...' : 'Envoyer'}
        </button>
      </div>
    </Modal>
  );
}
