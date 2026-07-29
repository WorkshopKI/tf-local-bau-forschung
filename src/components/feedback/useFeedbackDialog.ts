import { create } from 'zustand';
import type { FeedbackCategory } from '@/core/types/feedback';

/**
 * Geteilter Öffnen-Zustand des Feedback-Dialogs. Damit teilen sich der globale
 * FAB (`FeedbackButton`) und der Feedback-Icon-Button im Sidebar-Footer denselben
 * Dialog — die Öffnen-Logik lebt an EINER Stelle statt dupliziert.
 *
 * `FeedbackButton` rendert das eigentliche `FeedbackPanel` und liest hier `open`
 * / `focusScreenshot`; jeder andere Auslöser ruft nur `openDialog()`.
 */
/**
 * Vorbelegung des Eingabe-Schritts für Auslöser, die den Anlass schon kennen —
 * z.B. „Hilfetext stimmt nicht" aus dem Seiten-Hilfe-Dialog. Spart dem Melder
 * die Typ-Wahl und das Formulieren einer Überschrift; der Text bleibt seiner.
 */
export interface FeedbackVorbelegung {
  kategorie?: FeedbackCategory;
  titel?: string;
}

interface FeedbackDialogState {
  open: boolean;
  /** true → Screenshot-Paste-Fläche im Panel fokussieren (Shortcut-Pfad). */
  focusScreenshot: boolean;
  vorbelegung: FeedbackVorbelegung | null;
  openDialog: (opts?: { focusScreenshot?: boolean; vorbelegung?: FeedbackVorbelegung }) => void;
  close: () => void;
}

export const useFeedbackDialog = create<FeedbackDialogState>(set => ({
  open: false,
  focusScreenshot: false,
  vorbelegung: null,
  openDialog: opts => set({
    open: true,
    focusScreenshot: opts?.focusScreenshot ?? false,
    vorbelegung: opts?.vorbelegung ?? null,
  }),
  close: () => set({ open: false, focusScreenshot: false, vorbelegung: null }),
}));
