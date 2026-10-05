import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useToast } from '../lib/ToastContext';

// Bouton de dictée vocale basé sur la Web Speech API du navigateur (gratuite,
// aucun serveur ni clé API). Disponible sur Chrome et Edge ; absent sur
// Firefox et peu fiable sur Safari — dans ce cas le bouton ne s'affiche tout
// simplement pas (fonctionnalité d'appoint, jamais bloquante pour la saisie
// au clavier).
//
// Usage : <VoiceDictationButton value={form.notes} onChange={set('notes')} />
// `onChange` est appelé avec un objet `{ target: { value } }`, comme un
// événement natif de <textarea> — compatible avec les handlers `set(k)` et
// les setters React classiques (`(e) => setX(e.target.value)`) déjà utilisés
// partout dans l'application.
const SpeechRecognitionImpl = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

export default function VoiceDictationButton({ value, onChange, className = '' }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const baseValueRef = useRef(''); // valeur du champ au moment où la dictée démarre
  const toast = useToast();

  // Coupe proprement le micro si le composant est démonté en cours de dictée
  // (fermeture de la modale, navigation...).
  useEffect(() => () => { try { recognitionRef.current?.stop(); } catch { /* ignore */ } }, []);

  if (!SpeechRecognitionImpl) return null;

  const start = () => {
    const recognition = new SpeechRecognitionImpl();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = true;

    baseValueRef.current = value || '';

    recognition.onresult = (event) => {
      // `event.results` contient l'ensemble des segments reconnus depuis le
      // démarrage (définitifs + provisoire en cours) : on les recolle tels
      // quels à la valeur initiale du champ plutôt que de tenter un calcul
      // incrémental, plus simple et plus fiable.
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      const sep = baseValueRef.current && !/\s$/.test(baseValueRef.current) ? ' ' : '';
      onChange({ target: { value: `${baseValueRef.current}${sep}${transcript}` } });
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        toast('Micro refusé : autorisez l’accès au micro dans les réglages de votre navigateur.', 'error');
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        toast('La reconnaissance vocale a été interrompue.', 'error');
      }
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      // start() lève si un autre micro est déjà actif sur la page — on ignore.
    }
  };

  const stop = () => {
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    setListening(false);
  };

  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); listening ? stop() : start(); }}
      title={listening ? 'Arrêter la dictée vocale' : 'Dicter ce champ au micro'}
      className={`shrink-0 h-fit p-1.5 rounded-lg transition-colors ${
        listening ? 'bg-red-50 text-red-600 animate-pulse' : 'text-slate2-400 hover:text-brand hover:bg-slate2-50'
      } ${className}`}
    >
      {listening ? <MicOff size={15} /> : <Mic size={15} />}
    </button>
  );
}
