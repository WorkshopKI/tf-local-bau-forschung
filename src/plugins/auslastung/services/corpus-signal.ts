import { createSignalStore } from '@/core/lib/createSignalStore';

/**
 * Globaler „Auslastungs-Embedding-Korpus hat sich geändert"-Tick (v2.29.1).
 *
 * Hintergrund (cold-start-store-refresh-Klasse): Ein Korpus-Download/-Build
 * schreibt die Embeddings in die IDB, aber die In-Memory-Konsumenten lesen sie
 * NICHT nach — sie laden ihren Stand nur einmal beim Mount:
 *  - [KlassifizierungsReview](../views/KlassifizierungsReview.tsx) hält die
 *    Verbund-Embeddings in `useState` (Effekt-Deps `[storage]`, Guard verhindert
 *    Re-Fire);
 *  - [useMatchingCorpus](../hooks/useMatchingCorpus.ts) cached den per-Antrag-
 *    Korpus über die `antraege`-Array-Referenz, die sich beim Download nicht
 *    ändert.
 * Folge: nach „Vom Datenspeicher laden" (oder dem v2.29-Start-Autoload) blieben
 * Klassifizierung/Matching leer bis zu einem manuellen Browser-Reload (Reload =
 * Remount = frischer IDB-Read).
 *
 * Bumper: jede Korpus-IDB-Mutation — Start-Autoload
 * ([useAuslastungCorpusAutoload](@/core/hooks/useAuslastungCorpusAutoload)),
 * manuelles „Vom Datenspeicher laden" / „Corpus aufbauen" / „Cache leeren"
 * ([EmbeddingCorpusSection](../views/admin/EmbeddingCorpusSection.tsx)).
 * Konsumenten lesen bei jeder Version-Änderung erneut aus der IDB. Konsumenten,
 * die den Download SELBST auslösen (Mount-Load), brauchen keinen Bump — sie
 * bekommen das Ergebnis direkt; der Bump deckt nur EXTERNE Mutationen ab (kein
 * Self-Trigger-Loop).
 *
 * Mechanik: generischer Signal-Store, siehe `@/core/lib/createSignalStore`.
 */
const signal = createSignalStore();

/** Zustand-Hook — in React via Selector lesen: `useAuslastungCorpusSignal(s => s.version)`. */
export const useAuslastungCorpusSignal = signal.useSignal;

/** Außerhalb von React (Services/Callbacks/Hooks) den Konsumenten-Reload anstoßen. */
export function bumpAuslastungCorpusSignal(): void {
  signal.bump();
}
