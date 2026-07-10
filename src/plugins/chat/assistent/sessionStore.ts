/**
 * Assistent-Panel (Phase 1) — session-only Konversations-Store.
 *
 * BEWUSST vanilla zustand (kein React, kein IDB): (a) node-testbar ohne jsdom,
 * (b) Phase 1 persistiert die Historie NICHT — sie lebt nur für die App-Sitzung
 * (Anti-Pattern: „Persistenz der Konversationshistorie"). „Neue Unterhaltung"
 * leert sie; Navigations-/Entitätswechsel NICHT (nur die Kontext-Chips ändern
 * sich, der nächste Turn nutzt den neuen Kontext).
 *
 * Fehlerpfad: die optimistisch angehängte Nutzer-Nachricht wird bei einem
 * gescheiterten Turn wieder zurückgenommen (Historie unverändert) und die Frage
 * als `letzteFehlerFrage` gemeldet — das Panel stellt sie ins Eingabefeld zurück.
 */
import { createStore } from 'zustand/vanilla';
import type { ChatMessage } from '../types';
import type { AssistentTurn } from '@/core/services/assistent/kontext';
import { fuehreAssistentTurnAus, type AssistentTurnDeps } from './turn';

function uuid(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `a-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

function toTurns(messages: ReadonlyArray<ChatMessage>): AssistentTurn[] {
  return messages.map(m => ({ rolle: m.role === 'user' ? 'nutzer' : 'assistent', text: m.content }));
}

export interface AssistentSessionState {
  /** Session-only Historie (kein IDB). */
  messages: ChatMessage[];
  busy: boolean;
  error: string | null;
  /** Der resetChat des letzten Turns war unbestätigt → mögliche Kontamination. */
  resetWarnung: boolean;
  /** Nach einem Fehler die betroffene Frage (Panel füllt das Eingabefeld). */
  letzteFehlerFrage: string | null;
  send: (frage: string, deps: AssistentTurnDeps) => Promise<void>;
  neueUnterhaltung: () => void;
  clearError: () => void;
  /** Lokales Daumen-Feedback auf einer Nachricht (in-memory, kein Backend). */
  setFeedback: (mid: string, fb: 'up' | 'down') => void;
}

export const assistentSessionStore = createStore<AssistentSessionState>((set, get) => ({
  messages: [],
  busy: false,
  error: null,
  resetWarnung: false,
  letzteFehlerFrage: null,

  send: async (frage, deps) => {
    const trimmed = frage.trim();
    if (!trimmed || get().busy) return;

    // Snapshot der Historie VOR dem optimistischen Anhängen → Rollback-Basis.
    const vorher = get().messages;
    const turns = toTurns(vorher);
    const userMsg: ChatMessage = {
      id: uuid(), role: 'user', content: trimmed, createdAt: new Date().toISOString(),
    };
    set({ messages: [...vorher, userMsg], busy: true, error: null, resetWarnung: false, letzteFehlerFrage: null });

    const res = await fuehreAssistentTurnAus(trimmed, turns, deps);

    if (res.ok) {
      const asstMsg: ChatMessage = {
        id: uuid(), role: 'assistant', content: res.antwort, createdAt: new Date().toISOString(),
        ...(res.thinking ? { thinking: res.thinking } : {}),
        ...(res.sources.length > 0 ? { sources: res.sources } : {}),
      };
      set(s => ({
        messages: [...s.messages, asstMsg],
        busy: false,
        resetWarnung: res.resetWarnung,
      }));
    } else {
      // Historie unverändert: optimistische Nutzer-Nachricht zurücknehmen.
      set({ messages: vorher, busy: false, error: res.fehler, letzteFehlerFrage: trimmed });
    }
  },

  neueUnterhaltung: () => set({ messages: [], error: null, resetWarnung: false, letzteFehlerFrage: null }),
  clearError: () => set({ error: null, letzteFehlerFrage: null }),
  setFeedback: (mid, fb) => set(s => ({
    messages: s.messages.map(m => (m.id === mid ? { ...m, feedback: m.feedback === fb ? undefined : fb } : m)),
  })),
}));
