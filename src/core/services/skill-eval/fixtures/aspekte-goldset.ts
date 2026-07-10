/**
 * Lädt das handkuratierte Aspekt-Goldset (`eval/eval-goldset-aspekte.json`) in den
 * Browser — für das In-App-Eval-Panel der Antrag-Aufbereitung.
 *
 * Bewusst über `?raw` + `JSON.parse` (KEIN `resolveJsonModule`, das im
 * App-tsconfig nicht aktiv ist; Muster wie `ChangelogDialog` den Changelog aus dem
 * Projekt-Root zieht): **eine** Quelle der Wahrheit mit der Node-CLI
 * (`aufbereitung-eval.ts`), die dieselbe Datei zur Laufzeit liest.
 *
 * Das Goldset trägt NUR fiktive Sektions-IDs → Aspekt-Buchstaben (kein VB-Inhalt);
 * die ~1,6 KB sind unbedenklich in jedem Varianten-Bundle. Die eigentlichen VB-
 * Fixtures (~2 MB) bleiben dev-only über `loadEvalFixtures()` (bundle.ts).
 */
import goldsetRaw from '../../../../../eval/eval-goldset-aspekte.json?raw';
import type { Goldset } from '../aspekte-metrik';

/** Parst das gebündelte Goldset. Wirft nur bei kaputtem JSON (Build-Fehler-Klasse). */
export function loadAspekteGoldset(): Goldset {
  return JSON.parse(goldsetRaw) as Goldset;
}
