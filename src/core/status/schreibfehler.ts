/**
 * Wortlaute, die im **Quellsystem** verschrieben sind — beim Lesen
 * normalisiert, nie zurückgeschrieben.
 *
 * **Warum das nicht als `varianten` in `STATUS_CODE_KATALOG` steht.** Das ist
 * die Fremddaten-Tabelle (Pitfall #43): sie sagt, wie ein Code amtlich heißt,
 * und `varianten` heißt dort „andere, gleichwertige Schreibweise". Ein
 * Tippfehler des Quellsystems dort einzutragen machte ihn von einer amtlichen
 * Schreibvariante ununterscheidbar — und aus einem Befund eine Tatsache. Hier
 * trägt er ein Urteil und einen Beleg.
 *
 * **Die App ändert keine Bestandsdaten.** `Antrag.status` bleibt der Rohwert
 * aus dem Export; normalisiert wird ausschließlich beim Nachschlagen, und die
 * Anzeige nennt den Rohwert daneben ({@link quellsystemZusatz}). Die Korrektur
 * selbst gehört ins Fachsystem — der Klärfragen-Reiter führt die bekannten
 * Fälle mit ihren gemessenen Vorkommen als Hinweis für die Fachseite.
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import { normalisiereWert } from './typen';
import type { KurationsBeleg } from './kuerzel-kuration';

/** Ein belegter Schreibfehler des Quellsystems. */
export interface Schreibfehler {
  /** Wie es im Export steht — wortgetreu. */
  roh: string;
  /** Der gemeinte amtliche Wortlaut. */
  gemeint: string;
  /** Der Code, den `gemeint` trägt. */
  code: number;
  beleg: KurationsBeleg;
}

export const SCHREIBFEHLER: readonly Schreibfehler[] = [
  {
    roh: 'VN gegrüft',
    gemeint: 'VN geprüft',
    code: 97,
    beleg: {
      quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07',
      frageId: 'wert-nicht-in-fassung:vn gegrüft',
    },
  },
];

const INDEX: ReadonlyMap<string, Schreibfehler> = new Map(
  SCHREIBFEHLER.map(s => [normalisiereWert(s.roh), s]),
);

/** Trifft ein Rohwert einen bekannten Schreibfehler? */
export function schreibfehlerFuer(roh: unknown): Schreibfehler | null {
  if (typeof roh !== 'string') return null;
  return INDEX.get(normalisiereWert(roh)) ?? null;
}

/**
 * Der gemeinte Wortlaut, oder der Rohwert unverändert. **Der eine Ort**, an dem
 * ein Schreibfehler aufgelöst wird — jeder Nachschlag geht hier durch.
 */
export function normalisiereSchreibfehler(roh: string): string {
  return schreibfehlerFuer(roh)?.gemeint ?? roh;
}

/**
 * Der Zusatz für die Anzeige: `im Quellsystem: „VN gegrüft"`. `null`, wo nichts
 * normalisiert wurde — dann steht auch nichts da.
 *
 * Gehört überall dorthin, wo der normalisierte Wortlaut erscheint: sonst sähe
 * jemand „VN geprüft" und suchte im Fachsystem vergeblich danach.
 */
export function quellsystemZusatz(roh: unknown): string | null {
  const s = schreibfehlerFuer(roh);
  return s === null ? null : `im Quellsystem: „${s.roh}“`;
}
