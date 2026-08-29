import React, { useRef, useState } from 'react';
import { UploadCloud, Download, DatabaseBackup, Plus, Pencil } from 'lucide-react';
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
