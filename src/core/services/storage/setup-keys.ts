/**
 * Setup-Schlüssel der Varianten-IndexedDB — was ein Reset NIEMALS mitnehmen darf.
 *
 * Hintergrund (recurring-bug-classes Klasse 12): Identität und Ordner-Zugriff
 * leben ausschliesslich lokal in `teamflow-<outputFilename>`. Wer sie löscht,
 * wirft den Nutzer zurück in Onboarding und Ordner-Auswahl — bei einem
 * Test-Reset ist das keine „Bereinigung", sondern Arbeit, die er neu leisten
 * muss. Konkreter Vorfall: bis v2.277 löschte der Dev-Szenario-Reset
 * (`resetAll`) jeden kv-Schlüssel ausser `smb-handles`, also auch `profile` +
 * `onboarding-complete` — der Tester tippte nach JEDEM Szenario-Klick Name und
 * Kürzel neu, während die Ordner verbunden blieben.
 *
 * Faustregel: **Setup überlebt einen Reset, Testzustand nicht.**
 *
 * Diese Liste ist die einzige Quelle dafür. Der Convention-Test
 * `no-blanket-idb-wipe` verlangt, dass jede Datei, die pauschal über ein
 * unpräfixiertes `keys()` iteriert UND löscht, aus diesem Modul importiert.
 */

import { SMB_HANDLES_IDB_KEY } from '@/core/services/infrastructure/types';

/** Identität: entscheidet allein, ob das Onboarding erscheint (siehe App.tsx). */
export const PROFILE_IDB_KEY = 'profile';
export const ONBOARDING_COMPLETE_IDB_KEY = 'onboarding-complete';

/**
 * Schlüssel, die ein pauschaler kv-Reset auslassen MUSS.
 *
 * Wer hier etwas ergänzt, beschreibt bitte auch, warum der Verlust den Nutzer
 * Arbeit kostet — Bequemlichkeit allein ist kein Grund, Testzustand zu erhalten.
 */
export const SETUP_IDB_KEYS: readonly string[] = [
  SMB_HANDLES_IDB_KEY,          // sonst Ordner-Picker bei jedem Reset
  PROFILE_IDB_KEY,              // sonst Name/Kürzel/Farbe neu eintippen
  ONBOARDING_COMPLETE_IDB_KEY,  // sonst kompletter Onboarding-Durchlauf
];

/** True, wenn der Schlüssel zum Setup gehört und einen Reset überleben muss. */
export function istSetupKey(key: string): boolean {
  return SETUP_IDB_KEYS.includes(key);
}
