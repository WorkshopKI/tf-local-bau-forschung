/**
 * Start-Bericht — das CSV-Ergebnis des Start-Passes auf dem Weg zum Banner.
 *
 * `runDataUpdate` läuft beim App-Start automatisch (App.tsx) und zeigte sein
 * CSV-Ergebnis bisher nur als 6-Sekunden-Toast. Drift heilte sich über den
 * Banner von selbst (die Quelle blieb Kandidat, der Nutzer klickte, der
 * Banner-Lauf lieferte den Bericht). Eine Divergenz-Warnung oder ein Fehler
 * aus dem Start-Lauf dagegen erreichte niemanden: die Quelle war gestempelt,
 * also kein Kandidat mehr, und `useCsvAutoRefreshCheck.report` füllt nur der
 * eigene Lauf des Hooks. Im Produktivsystem (Sept. 2026) lief so jeden Morgen
 * ein Import mit ~1000 „geänderten" Zeilen aus einer abweichenden Datei durch,
 * und kein Bildschirm sagte es.
 *
 * Der Store ist bewusst ein Übergabefach, kein Zustand: App.tsx legt den
 * Bericht ab, der Hook holt ihn beim nächsten Render ab und zeigt ihn wie einen
 * eigenen Lauf (Banner-Zeile + Dialog). Abgelegt wird nur, was zeigenswert ist
 * — ein glatter Import bleibt beim Toast.
 */

import { create } from 'zustand';
import type { RefreshReport } from './auto-refresh';

/** Hat der Lauf etwas, das am Bildschirm stehen bleiben muss? */
export function berichtZeigenswert(r: RefreshReport): boolean {
  if (r.divergenzen.length > 0 || r.drift.length > 0 || r.errors.length > 0) return true;
  return r.processed.some(p => (p.uebergangeneSpalten?.length ?? 0) > 0 || p.korrigiertesEncoding != null);
}

interface StartBerichtState {
  bericht: RefreshReport | null;
  /** Legt den Bericht ab — nur wenn er zeigenswert ist, sonst wird das Fach geleert. */
  setBericht: (r: RefreshReport | null) => void;
  /** Holt den Bericht ab und leert das Fach. */
  abholen: () => RefreshReport | null;
}

export const useStartBericht = create<StartBerichtState>((set, get) => ({
  bericht: null,
  setBericht: r => set({ bericht: r && berichtZeigenswert(r) ? r : null }),
  abholen: () => {
    const r = get().bericht;
    if (r) set({ bericht: null });
    return r;
  },
}));
