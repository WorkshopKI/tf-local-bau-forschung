/**
 * Fixture-Zugriff der MAP-Tests.
 *
 * Zwei Klassen von Fixtures, streng getrennt:
 *
 * - `fixtures/` ist **committet** und enthält ausschliesslich fiktive Daten.
 *   Die Dummy-Fixture ist eine gescrubbte Fassung des Plattform-Exports:
 *   strukturgleich (identische Pfadmenge, identische Zahlen), aber mit
 *   ersetzten Namen, Adressen und Kontonummern.
 * - `fixtures-local/` ist **gitignored** und trägt den teil-anonymisierten
 *   Echtfall. Das Repo ist öffentlich; diese Datei darf es nie erreichen.
 *   Tests, die sie brauchen, überspringen sich sauber, wenn sie fehlt — so
 *   bleibt der Lauf auf jedem Clone grün.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));

export const DUMMY_PFAD = path.join(HIER, 'fixtures', 'dummy-2025.json');
export const DRIFT_PFAD = path.join(HIER, 'fixtures', 'drift-2027.json');
export const ECHTFALL_PFAD = path.join(HIER, 'fixtures-local', 'echtfall-2026.json');

export const ECHTFALL_VORHANDEN = existsSync(ECHTFALL_PFAD);

/** Rohtext inklusive BOM — der Import muss ihn genau so verkraften. */
export function leseFixture(pfad: string): string {
  return readFileSync(pfad, 'utf-8');
}

/** Standard-Kontext für Import-Tests (feste Werte, damit nichts driftet). */
export const TEST_KONTEXT = {
  dateiname: 'test.json',
  importiertVon: 'TST',
  importiertAm: '2026-07-20T10:00:00.000Z',
} as const;
