import { createSignalStore } from '@/core/lib/createSignalStore';

/**
 * Globaler „CSV-Quellen / -Schemas haben sich geändert"-Tick.
 *
 * Hintergrund: `useCsvAutoRefreshCheck` (Banner) prüft die CSV-Quellen sonst nur
 * EINMAL beim Mount (auf der pl gibt es keinen Kurator-Session-Reset, der den
 * Check neu armt). Damit:
 *  - erscheint nach „clear site data" kein „CSV-Ordner verknüpfen"-Banner, weil
 *    die Schemas erst NACH dem Erst-Check per Snapshot-Sync in die IDB kommen;
 *  - wirkt das Verknüpfen des Ordners in Einstellungen erst nach einem
 *    Browser-Reload (der Check läuft sonst nicht erneut).
 *
 * Bumper: Snapshot-Sync (neue/aktualisierte Schemas) + Ordner-Verknüpfen in
 * Einstellungen → Speicher. Konsument: `useCsvAutoRefreshCheck` läuft bei jeder
 * Version-Änderung erneut (`runCheck` ist idempotent — reiner IDB-Read).
 *
 * Mechanik: generischer Signal-Store, siehe `@/core/lib/createSignalStore`.
 */
const signal = createSignalStore();

/** Zustand-Hook — in React via Selector lesen: `useCsvSourcesSignal(s => s.version)`. */
export const useCsvSourcesSignal = signal.useSignal;

/** Außerhalb von React (Services/Callbacks) den Re-Check anstoßen. */
export function bumpCsvSourcesSignal(): void {
  signal.bump();
}
