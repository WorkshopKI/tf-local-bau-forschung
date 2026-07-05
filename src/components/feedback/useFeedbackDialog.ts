import { create } from 'zustand';

/**
 * Geteilter Öffnen-Zustand des Feedback-Dialogs. Damit teilen sich der globale
 * FAB (`FeedbackButton`) und der Feedback-Icon-Button im Sidebar-Footer denselben
 * Dialog — die Öffnen-Logik lebt an EINER Stelle statt dupliziert.
 *
 * `FeedbackButton` rendert das eigentliche `FeedbackPanel` und liest hier `open`
 * / `focusScreenshot`; jeder andere Auslöser ruft nur `openDialog()`.
 */
interface FeedbackDialogState {
  open: boolean;
  /** true → Screenshot-Paste-Fläche im Panel fokussieren (Shortcut-Pfad). */
  focusScreenshot: boolean;
  openDialog: (opts?: { focusScreenshot?: boolean }) => void;
  close: () => void;
}

export const useFeedbackDialog = create<FeedbackDialogState>(set => ({
  open: false,
  focusScreenshot: false,
  openDialog: opts => set({ open: true, focusScreenshot: opts?.focusScreenshot ?? false }),
  close: () => set({ open: false, focusScreenshot: false }),
}));
