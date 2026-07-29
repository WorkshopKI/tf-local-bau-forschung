/**
 * Spiegel des Themen-Vektoren-Ladevorgangs (v2.352) — damit der Seitenkopf des
 * Moduls EINEN Ladezustand zeigen kann statt drei verstreuter Hinweise.
 *
 * Der eigentliche Load lebt in [KlassifizierungsReview](../views/KlassifizierungsReview.tsx)
 * (lokaler State, weil er dort zusätzlich die Korpus-Hinweis-Banner steuert); dieser
 * Store ist nur die modul-globale Sichtbarkeit für [ModulLadeStreifen](../components/ModulLadeStreifen.tsx).
 *
 * Bewusst NICHT in `services/matching/corpus-signal.ts` gemischt: der ist ein reiner
 * Versions-Zähler (`createSignalStore`) für „Korpus hat sich geändert, neu lesen".
 *
 * Der Korpus verzögert `useAuslastungReady().ready` NICHT — ein Download vom
 * Datenspeicher kann Minuten dauern, die Seite ist derweil voll bedienbar.
 */
import { create } from 'zustand';

interface KorpusLadeStatusState {
  laden: boolean;
  setLaden: (laden: boolean) => void;
}

export const useKorpusLadeStatus = create<KorpusLadeStatusState>((set) => ({
  laden: false,
  setLaden: (laden) => set({ laden }),
}));
