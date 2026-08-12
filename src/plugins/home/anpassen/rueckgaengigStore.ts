/**
 * „Rückgängig" der Startseite — EIN Mechanismus für alle umkehrbaren Eingriffe.
 *
 * Gemerkt wird nicht die Aktion, sondern der **vorherige Config-Stand**. Damit
 * deckt derselbe Knopf Ausblenden, „alle aus" und „Startseite zurücksetzen" ab,
 * und Zurücksetzen braucht keinen Nachfrage-Dialog. Transient (kein Persist):
 * ein Reload verwirft die Reue-Frist, nicht die Änderung.
 *
 * Kein Eintrag für Einklappen, Primärfarbe und Hell/Dunkel — die sind sofort
 * sichtbar und ebenso schnell zurückgenommen (Handoff §2.4).
 */
import { create } from 'zustand';
import type { HomeWidgetConfig } from '../widgets/types';

export interface RueckgaengigEintrag {
  /** Satz in der Leiste, z.B. „Meine Anträge ausgeblendet". */
  text: string;
  /** Der Stand VOR der Änderung. */
  vorstand: HomeWidgetConfig;
  /** Unterscheidet aufeinanderfolgende Meldungen mit gleichem Text (Timer-Reset). */
  nr: number;
}

interface RueckgaengigState {
  eintrag: RueckgaengigEintrag | null;
  merke: (text: string, vorstand: HomeWidgetConfig | null) => void;
  leere: () => void;
}

export const useRueckgaengigStore = create<RueckgaengigState>((set, get) => ({
  eintrag: null,
  // Ohne geladene Config gibt es nichts zurückzunehmen — dann auch keine Leiste,
  // die etwas verspricht, das der Knopf nicht halten könnte.
  merke: (text, vorstand) => {
    if (!vorstand) return;
    set({ eintrag: { text, vorstand, nr: (get().eintrag?.nr ?? 0) + 1 } });
  },
  leere: () => set({ eintrag: null }),
}));
