/**
 * In welchem Zustand die Aufbereitungs-Seite ihren Antrag vorfindet — rein/UI-frei,
 * damit die Fallunterscheidung node-testbar bleibt (Muster: `baueKiCta` in
 * `uebersicht.ts`).
 *
 * Hintergrund: Ohne diese Unterscheidung rendert die Seite bei nicht auflösbarem
 * Antrag ihr volles Gerüst inklusive „Neu aufbereiten" und „Mit KI aufbereiten" —
 * beide Aktionen brechen ohne Kontext wortlos ab (`if (!ctx) return`). Der Nutzer
 * sieht einen Knopf, der nichts tut, keine Meldung, keinen Ladezustand. Genau so
 * trat der Fehler auf. Der lädt-Fall ist ebenso wichtig: „gibt es nicht" darf
 * niemals während der laufenden Auflösung behauptet werden.
 */

export type KontextZustand = 'bereit' | 'laedt' | 'nicht-aufloesbar';

export function kontextZustand(eingabe: { ctxVorhanden: boolean; laedt: boolean }): KontextZustand {
  if (eingabe.ctxVorhanden) return 'bereit';
  return eingabe.laedt ? 'laedt' : 'nicht-aufloesbar';
}
