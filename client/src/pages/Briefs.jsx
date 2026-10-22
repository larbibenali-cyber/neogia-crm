import React from 'react';
import { AgentLauncher, AgentsSubNav, BriefsTab } from './Leads';

// Page « Briefs de compte » : briefs d'une page générés par l'agent Claude
// « brief-compte » (table agent_briefs).
const PROMPTS = [
  { label: 'Brief de compte', text: 'Fais-moi un brief sur [entreprise]' },
];

export default function Briefs() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-slate2-900">Briefs de compte</h1>
        <p className="text-slate2-500 text-sm mt-1">Fiches d'une page préparées par l'agent avant un appel ou un rendez-vous.</p>
      </div>
      <AgentsSubNav />
      <AgentLauncher
        prompts={PROMPTS}
        note="L'agent tourne dans Claude. Copiez la phrase, remplacez [entreprise], collez-la dans Claude puis acceptez d'enregistrer le brief : il arrive ici."
      />
      <BriefsTab onChange={() => {}} />
    </div>
  );
}
