import { create } from 'zustand';

/**
 * Geteilter Öffnen-Zustand des Dialogs „Über die App". Zwei Auslöser teilen sich
 * denselben Dialog: die Versionsnummer in der Sidebar-Fußzeile (`BuildInfo`) und
 * der Link in der Fußzeile jedes Seiten-Hilfe-Dialogs (`SeitenHilfeButton`).
 *
 * Der Dialog wird deshalb GENAU EINMAL gemountet (ShellLayout) — nicht je
 * Auslöser. Grund ist nicht nur Ordnung: `UeberDieAppDialog` leitet die
 * Änderungsliste in `useMemo`s aus der ~400 KB großen CHANGELOG.md ab, und die
 * laufen VOR dem `if (!open) return null`. Jede zusätzliche Instanz wäre ein
 * weiterer Parse-Durchlauf beim Mounten der Seite.
 */
interface UeberAppDialogState {
  open: boolean;
  openDialog: () => void;
  close: () => void;
}

export const useUeberAppDialog = create<UeberAppDialogState>(set => ({
  open: false,
  openDialog: () => set({ open: true }),
  close: () => set({ open: false }),
}));
