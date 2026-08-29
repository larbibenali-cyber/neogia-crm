import React, { useRef, useState } from 'react';
import { UploadCloud, ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { Modal } from './ui';
import { useToast } from '../lib/ToastContext';

const FIELD_KEYS = ['col_nom', 'col_prenom', 'col_email', 'col_mobile', 'col_fixe', 'col_tech'];

export default function ImportWizard({ open, onClose, onImported }) {
  const [step, setStep] = useState('upload'); // upload | mapping | result
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const fileInput = useRef(null);
  const toast = useToast();

  const reset = () => { setStep('upload'); setFile(null); setPreview(null); setOverrides({}); setReport(null); };
  const close = () => { reset(); onClose(); };

  const handleFile = async (f) => {
    if (!f) return;
    setFile(f);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const data = await api.post('/import/preview', fd);
      setPreview(data);
      const initial = {};
      FIELD_KEYS.forEach((k) => { initial[k] = data.mapping_propose?.[k]?.index ?? -1; });
      setOverrides(initial);
      setStep('mapping');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const referenceSheet = preview?.feuilles?.find((s) => s.headers.length > 0) || preview?.feuilles?.[0];
  const headers = referenceSheet?.headers || [];

  const commit = async () => {
    setLoading(true);
    try {
      const summary = await api.post('/import/commit', {
        file_token: preview.file_token,
        original_name: preview.original_name,
        column_overrides: overrides,
      });
      setReport(summary);
      setStep('result');
      onImported && onImported();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Assistant d'import Excel" wide>
      {step === 'upload' && (
        <div>
          <p className="text-sm text-slate2-500 mb-4">
            Déposez un fichier Excel (une feuille par entreprise, mêmes colonnes que l'import initial). Aucune donnée n'est
            écrite en base à cette étape : vous pourrez vérifier et corriger le mapping des colonnes avant de valider.
          </p>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
            className="border-2 border-dashed border-slate2-200 rounded-2xl p-10 text-center hover:border-brand transition-colors"
          >
            <UploadCloud size={28} className="mx-auto text-brand mb-2" />
            <p className="text-sm text-slate2-600">Glissez-déposez un fichier .xlsx, ou</p>
            <button className="btn btn-secondary mt-2" onClick={() => fileInput.current?.click()} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : 'Parcourir'}
            </button>
            <input ref={fileInput} type="file" accept=".xlsx,.xls" hidden onChange={(e) => handleFile(e.target.files[0])} />
          </div>
        </div>
      )}

      {step === 'mapping' && preview && (
        <div>
          <div className="flex gap-4 text-sm mb-4">
            <div><span className="text-slate2-400">Feuilles détectées :</span> <strong>{preview.nb_feuilles}</strong></div>
            <div><span className="text-slate2-400">Lignes de données estimées :</span> <strong>{preview.nb_lignes_estimees}</strong></div>
          </div>
          <p className="text-sm text-slate2-500 mb-3">
            Vérifiez la correspondance entre chaque champ du CRM et la colonne détectée dans le fichier. Corrigez au besoin
            avant de lancer l'import — la même correspondance sera appliquée à toutes les feuilles.
          </p>
          <div className="border border-slate2-100 rounded-xl divide-y divide-slate2-100 mb-4">
            {FIELD_KEYS.map((k) => (
              <div key={k} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-sm font-medium text-slate2-700 w-48 shrink-0">{preview.mapping_propose?.[k]?.label || k}</span>
                <select
                  className="input"
                  value={overrides[k]}
                  onChange={(e) => setOverrides((o) => ({ ...o, [k]: Number(e.target.value) }))}
                >
                  <option value={-1}>— Ne pas importer —</option>
                  {headers.map((h, idx) => (
                    <option key={idx} value={idx}>{h || `(colonne ${idx + 1})`}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {referenceSheet?.sample?.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-slate2-500 uppercase tracking-wide mb-2">
                Aperçu — feuille « {referenceSheet.sheet_name} »
              </h4>
              <div className="overflow-x-auto border border-slate2-100 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-slate2-50 text-slate2-500">
                    <tr>
                      <th className="text-left px-3 py-2">Nom</th>
                      <th className="text-left px-3 py-2">Prénom</th>
                      <th className="text-left px-3 py-2">E-mail</th>
                      <th className="text-left px-3 py-2">Mobile</th>
                      <th className="text-left px-3 py-2">Environnement tech.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referenceSheet.sample.map((r, i) => (
                      <tr key={i} className="border-t border-slate2-100">
                        <td className="px-3 py-1.5">{r.nom}</td>
                        <td className="px-3 py-1.5">{r.prenom}</td>
                        <td className="px-3 py-1.5">{r.email}</td>
                        <td className="px-3 py-1.5">{r.mobile}</td>
                        <td className="px-3 py-1.5 max-w-xs truncate">{r.environnement_tech}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button className="btn btn-ghost" onClick={() => setStep('upload')}><ArrowLeft size={14} /> Changer de fichier</button>
            <button className="btn btn-primary" onClick={commit} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <>Valider et importer <ArrowRight size={14} /></>}
            </button>
          </div>
        </div>
      )}

      {step === 'result' && report && (
        <div>
          <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-xl px-4 py-3 mb-4">
            <CheckCircle2 size={18} /> <span className="text-sm font-medium">Import terminé avec succès.</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <Stat label="Lignes analysées" value={report.lignes_analysees} />
            <Stat label="Entreprises créées" value={report.entreprises_creees} />
            <Stat label="Entreprises mises à jour" value={report.entreprises_mises_a_jour} />
            <Stat label="Contacts créés" value={report.contacts_crees} />
            <Stat label="Contacts mis à jour" value={report.contacts_mis_a_jour} />
            <Stat label="Doublons fusionnés" value={report.doublons_fusionnes} />
            <Stat label="Échanges importés" value={report.echanges_crees} />
            <Stat label="Technologies distinctes" value={report.technologies_distinctes} />
            <Stat label="Lignes incomplètes" value={report.lignes_ignorees_incompletes} />
          </div>

          {report.doublons_signales?.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-slate2-700 flex items-center gap-1.5 mb-2">
                <AlertTriangle size={15} className="text-amber-500" /> Doublons potentiels signalés (non fusionnés automatiquement)
              </h4>
              <div className="max-h-40 overflow-y-auto border border-amber-100 bg-amber-50 rounded-xl p-3 text-xs space-y-1">
                {report.doublons_signales.slice(0, 30).map((d, i) => (
                  <div key={i}>{d.email} — présent chez {d.entreprises.join(' et ')}</div>
                ))}
                {report.doublons_signales.length > 30 && <div className="text-slate2-400">... et {report.doublons_signales.length - 30} de plus.</div>}
              </div>
              <p className="text-xs text-slate2-400 mt-1">Ces fiches n'ont pas été fusionnées automatiquement : vérifiez-les manuellement dans le module Clients.</p>
            </div>
          )}

          {Object.keys(report.technologies_non_reconnues || {}).length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-slate2-700 mb-2">Technologies non reconnues (conservées telles quelles)</h4>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(report.technologies_non_reconnues).map(([name, count]) => (
                  <span key={name} className="tech-tag bg-brand-50 text-brand border-brand-100">{name} ({count})</span>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={reset}>Importer un autre fichier</button>
            <button className="btn btn-primary" onClick={close}>Terminer</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value }) {
  return <div><div className="text-lg font-semibold text-slate2-900">{value}</div><div className="text-xs text-slate2-500">{label}</div></div>;
}
