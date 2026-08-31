import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Mail, Phone, Smartphone, MapPin, Building2, ArrowLeft, Pencil, Archive, Trash2, Plus,
  Phone as PhoneIcon, Mail as MailIcon, Linkedin, Users, Video, MessageCircle, Briefcase,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Loading, EmptyState, Avatar } from '../../components/ui';
import StatusBadge from '../../components/StatusBadge';
import TechCloud from '../../components/TechCloud';
import ContactFormModal from '../../components/ContactFormModal';
import EchangeFormModal from '../../components/EchangeFormModal';
import BesoinFormModal from '../../components/BesoinFormModal';
import { usePickLists } from '../../lib/PickListsContext';
import { useToast } from '../../lib/ToastContext';
import { useConfirm } from '../../lib/ConfirmContext';
import { formatDate, timeAgo, formatPhoneFR, phoneHref } from '../../lib/format';

const TYPE_ICONS = { appel: PhoneIcon, email: MailIcon, linkedin: Linkedin, reunion: Users, visio: Video, autre: MessageCircle };

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState(null);
  const [tab, setTab] = useState('historique');
  const [editOpen, setEditOpen] = useState(false);
  const [echangeModal, setEchangeModal] = useState({ open: false, echange: null });
  const [besoinModal, setBesoinModal] = useState({ open: false, defaults: null });
  const { getLabel } = usePickLists();
  const toast = useToast();
  const confirm = useConfirm();

  const [error, setError] = useState(null);
  const load = () => {
    setError(null);
    return api.get(`/contacts/${id}`).then(setContact).catch((e) => setError(e.message || 'Impossible de charger ce contact.'));
  };
  useEffect(() => { load(); }, [id]);

  if (error) return <EmptyState title="Impossible de charger le contact" description={error} />;
  if (!contact) return <Loading />;

  const archive = async () => {
    if (!(await confirm({ title: 'Archiver ce contact ?', message: `${contact.prenom} ${contact.nom} sera archivé et n'apparaîtra plus dans les listes actives.`, danger: false, confirmLabel: 'Archiver' }))) return;
    await api.del(`/contacts/${id}`);
    toast('Contact archivé.', 'success');
    navigate('/clients');
  };

  const deleteEchange = async (echangeId) => {
    if (!(await confirm({ title: "Supprimer l'échange ?", message: 'Cette action est définitive.', danger: true }))) return;
    await api.del(`/echanges/${echangeId}`);
    toast('Échange supprimé.', 'success');
    load();
  };

  const createBesoinFromEchange = (echange) => {
    setBesoinModal({
      open: true,
      defaults: {
        entreprise_id: contact.entreprise_id,
        contact_id: contact.id,
        titre: `Besoin identifié - ${contact.prenom} ${contact.nom}`,
        description_contexte: echange.compte_rendu,
      },
    });
  };

  return (
    <div className="space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate2-500 hover:text-brand">
        <ArrowLeft size={14} /> Retour
      </button>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar prenom={contact.prenom} nom={contact.nom} size={56} />
            <div>
              <h1 className="text-xl font-heading font-semibold text-slate2-900">{contact.prenom} {contact.nom}</h1>
              <p className="text-slate2-500 text-sm">{contact.fonction || 'Fonction non renseignée'}</p>
              <div className="flex items-center gap-1.5 mt-1 text-sm text-slate2-600">
                <Building2 size={14} />
                <Link to={`/clients/entreprise/${contact.entreprise_id}`} className="hover:text-brand font-medium">{contact.entreprise_nom}</Link>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <StatusBadge category="contact_status" value={contact.statut} />
            <button className="btn btn-secondary" onClick={() => setEditOpen(true)}><Pencil size={14} /> Modifier</button>
            <button className="btn btn-danger" onClick={archive}><Archive size={14} /> Archiver</button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate2-100 text-sm">
          <InfoRow icon={Mail} value={contact.email} href={contact.email ? `mailto:${contact.email}` : null} />
          {contact.telephone_mobile && (
            <InfoRow icon={Smartphone} value={formatPhoneFR(contact.telephone_mobile)} href={phoneHref(contact.telephone_mobile)} />
          )}
          {contact.telephone_fixe && (
            <InfoRow icon={Phone} value={formatPhoneFR(contact.telephone_fixe)} href={phoneHref(contact.telephone_fixe)} />
          )}
          <InfoRow icon={MapPin} value={contact.localisation} />
        </div>

        <div className="grid sm:grid-cols-4 gap-3 mt-4 text-xs text-slate2-500">
          <div>Source : <span className="text-slate2-700">{contact.source || '—'}</span></div>
          <div>Responsable : <span className="text-slate2-700">{contact.responsable || '—'}</span></div>
          <div>Créé le : <span className="text-slate2-700">{formatDate(contact.created_at)}</span></div>
          <div>Dernier échange : <span className="text-slate2-700">{formatDate(contact.dernier_echange_at)}</span></div>
        </div>

        {contact.tags && contact.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {contact.tags.map((t) => <span key={t} className="tech-tag bg-slate2-100 text-slate2-600">{t}</span>)}
          </div>
        )}

        {contact.notes && (
          <div className="mt-4 p-3 bg-slate2-50 rounded-xl text-sm text-slate2-700 whitespace-pre-wrap">{contact.notes}</div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="font-heading font-semibold text-slate2-900 mb-3">Environnement technique — {contact.entreprise_nom}</h2>
        <TechCloud technologies={contact.technologies} groupByCategory size="lg" />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex border-b border-slate2-100">
          <TabBtn active={tab === 'historique'} onClick={() => setTab('historique')}>Historique des échanges ({contact.echanges.length})</TabBtn>
          <TabBtn active={tab === 'besoins'} onClick={() => setTab('besoins')}>Besoins ({contact.besoins.length})</TabBtn>
        </div>

        {tab === 'historique' && (
          <div className="p-6">
            <div className="flex justify-end mb-4">
              <button className="btn btn-primary" onClick={() => setEchangeModal({ open: true, echange: null })}><Plus size={14} /> Ajouter un échange</button>
            </div>
            {contact.echanges.length === 0 ? (
              <EmptyState title="Aucun échange enregistré" description="Ajoutez le premier échange avec ce contact." />
            ) : (
              <ol className="relative border-l-2 border-slate2-100 ml-2 space-y-6">
                {contact.echanges.map((e) => {
                  const Icon = TYPE_ICONS[e.type] || MessageCircle;
                  return (
                    <li key={e.id} className="ml-6">
                      <span className="absolute -left-[11px] flex items-center justify-center w-6 h-6 rounded-full bg-brand-50 border-2 border-white">
                        <Icon size={12} className="text-brand" />
                      </span>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate2-800">{formatDate(e.date_echange, true)}</span>
                          <span className="tech-tag bg-slate2-100 text-slate2-600">{getLabel('echange_type', e.type)}</span>
                          {e.date_approximative && <span className="text-[11px] text-slate2-400">(date approximative)</span>}
                        </div>
                        <div className="flex gap-1">
                          <button className="btn btn-ghost !px-2 !py-1" onClick={() => setEchangeModal({ open: true, echange: e })}><Pencil size={13} /></button>
                          <button className="btn btn-ghost !px-2 !py-1 text-red-500" onClick={() => deleteEchange(e.id)}><Trash2 size={13} /></button>
                          <button className="btn btn-secondary !px-2 !py-1" onClick={() => createBesoinFromEchange(e)}><Briefcase size={13} /> Créer un besoin</button>
                        </div>
                      </div>
                      {e.objet && <p className="text-sm font-medium text-slate2-700 mt-1">{e.objet}</p>}
                      <p className="text-sm text-slate2-600 mt-1 whitespace-pre-wrap">{e.compte_rendu}</p>
                      {e.prochaine_action && <p className="text-xs text-brand-700 mt-1">Prochaine action : {e.prochaine_action}</p>}
                      {e.date_relance && <p className="text-xs text-amber-600 mt-0.5">Relance prévue le {formatDate(e.date_relance)}</p>}
                      <p className="text-[11px] text-slate2-400 mt-1">Ajouté par {e.auteur} — {timeAgo(e.created_at)}</p>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}

        {tab === 'besoins' && (
          <div className="p-6">
            <div className="flex justify-end mb-4">
              <button className="btn btn-primary" onClick={() => setBesoinModal({ open: true, defaults: { entreprise_id: contact.entreprise_id, contact_id: contact.id } })}>
                <Plus size={14} /> Nouveau besoin
              </button>
            </div>
            {contact.besoins.length === 0 ? (
              <EmptyState title="Aucun besoin rattaché" description="Créez un besoin pour cette entreprise depuis cette fiche." />
            ) : (
              <div className="space-y-2">
                {contact.besoins.map((b) => (
                  <Link key={b.id} to={`/besoins/${b.id}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate2-50 border border-slate2-100">
                    <div>
                      <p className="text-sm font-medium text-slate2-800">{b.titre}</p>
                      <p className="text-xs text-slate2-400">{b.reference}</p>
                    </div>
                    <StatusBadge category="besoin_status" value={b.statut} small />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ContactFormModal open={editOpen} onClose={() => setEditOpen(false)} contact={contact} onSaved={load} />
      <EchangeFormModal
        open={echangeModal.open}
        onClose={() => setEchangeModal({ open: false, echange: null })}
        contactId={contact.id}
        echange={echangeModal.echange}
        onSaved={load}
      />
      <BesoinFormModal
        open={besoinModal.open}
        onClose={() => setBesoinModal({ open: false, defaults: null })}
        defaults={besoinModal.defaults}
        onSaved={(b) => navigate(`/besoins/${b.id}`)}
      />
    </div>
  );
}

function InfoRow({ icon: Icon, value, href }) {
  if (!value) return (
    <div className="flex items-center gap-2 text-slate2-300">
      <Icon size={14} /> <span className="italic">Non renseigné</span>
    </div>
  );
  const content = <><Icon size={14} /> <span className="truncate">{value}</span></>;
  return href
    ? <a href={href} className="flex items-center gap-2 text-brand hover:underline">{content}</a>
    : <div className="flex items-center gap-2 text-slate2-700">{content}</div>;
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-3.5 text-sm font-medium border-b-2 transition-colors ${active ? 'border-brand text-brand' : 'border-transparent text-slate2-500 hover:text-slate2-800'}`}
    >
      {children}
    </button>
  );
}
