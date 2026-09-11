/**
 * Die Bestands-Generation als React-Wert.
 *
 * Wozu: Ein Leser, der seine Daten einmal im Mount-Effekt holt, bekommt einen
 * Import nicht mit — er zeigt bis zum Reload den Stand von davor. Gemessen am
 * 11.09.2026: nach einem Bestandswechsel las weder die Karte „Änderungen der
 * letzten Nacht" noch der Nachtlauf-Satz des Tagesbriefs das Journal neu. Die
 * Generation in den Effekt-Abhängigkeiten lässt ihn genau dann neu lesen, wenn
 * der Bestand ersetzt wurde — und sonst nie.
 *
 * `bestand-generation.ts` selbst importiert bewusst nichts (Zyklen); das Abo
 * über `useSyncExternalStore` wohnt deshalb hier.
 */
import { useSyncExternalStore } from 'react';
import { bestandGeneration, subscribeBestandGeneration } from '@/core/services/bestand-generation';

export function useBestandGeneration(): number {
  return useSyncExternalStore(subscribeBestandGeneration, bestandGeneration);
}
