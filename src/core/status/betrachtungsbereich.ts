/**
 * Der **Betrachtungsbereich**: welche Förder-Richtlinien zählen zum Arbeitsvorrat?
 *
 * Gemessen am Bestand (14 221 Anträge, August 2026) deckt die Trigger-Zuarbeit
 * neun Richtlinien mit 7 269 Anträgen ab; die übrigen 6 952 gehören zu
 * stillgelegten Altprogrammen (47 allein 4 190). Sie verzerren jede Arbeitsliste,
 * jeden Tab-Zähler und jede Kapazitätsrechnung — und zwar unsichtbar.
 *
 * **Leitprinzip: Arbeitsvorrat folgt dem Bereich, Evidenz nicht.** Der Bereich
 * ist ein expliziter Parameter jedes Konsumenten, nie ein stiller Filter im
 * Daten-Layer. Die globale Suche bleibt am Vollbestand, ein Deep-Link öffnet
 * jeden Antrag, und kein Zustand gilt ohne sichtbaren Chip (Pitfall #46).
 *
 * **Zwei Quellen, eine Reihenfolge** — dasselbe Muster wie die Kategorie-Fassade
 * (Pitfall #45): der Seed steht flag-unabhängig im Code, eine geladene
 * Katalog-Fassung überschreibt ihn. Damit gilt der Bereich auch in prod/as, wo
 * `initStatusKatalog` hinter `statusCockpit` nie läuft — dort eben mit dem
 * ausgelieferten Stand. Weicht eine gepflegte Fassung davon ab, sagt der
 * Status-Katalog das ausdrücklich („wirkt in prod erst mit dem nächsten
 * Release"), statt zwei stille Wahrheiten nebeneinander laufen zu lassen.
 *
 * Rein: keine IO, kein React.
 */
import { normKey } from './normalisierung';
import type { MappingVersion } from './typen';

/**
 * Die aktuelle Richtlinie und die beiden davor — deckungsgleich mit den
 * Programmen, für die die Trigger-Zuarbeit etwas führt.
 *
 * Ein Richtlinien-Wechsel ist eine Zeilen-Änderung im Status-Katalog; diese
 * Liste ist nur der Startzustand.
 */
export const BETRACHTUNGSBEREICH_SEED: readonly string[] = [
  '76', '77', '78', '79', '131', '136', '137', '138', '139',
];

/** Die gepflegte Programm-Liste, sonst die ausgelieferte. */
export function bereichsProgramme(version?: MappingVersion | null): readonly string[] {
  const gepflegt = version?.betrachtungsbereich?.programme;
  return gepflegt && gepflegt.length > 0 ? gepflegt : BETRACHTUNGSBEREICH_SEED;
}

/**
 * Weicht die gepflegte Liste vom ausgelieferten Stand ab?
 *
 * Der Preis von „Seed im Code": eine PL-Änderung wirkt dort, wo der Katalog
 * geladen wird (dev/pl/kurator), aber nicht in prod/as. Sichtbar gemacht, statt
 * nur dokumentiert — sonst fällt die Divergenz erst auf, wenn zwei Rechner
 * verschiedene Zahlen zeigen.
 */
export function bereichWeichtVomSeedAb(version?: MappingVersion | null): boolean {
  const gepflegt = version?.betrachtungsbereich?.programme;
  if (!gepflegt || gepflegt.length === 0) return false;
  const a = [...gepflegt].map(x => x.trim()).sort();
  const b = [...BETRACHTUNGSBEREICH_SEED].sort();
  return a.length !== b.length || a.some((x, i) => x !== b[i]);
}

/** Nachschlage-Menge aus einer Programm-Liste (normalisiert wie jeder Join). */
export function bereichsMenge(programme: readonly string[]): ReadonlySet<string> {
  const out = new Set<string>();
  for (const p of programme) {
    const k = normKey(p);
    if (k) out.add(k);
  }
  return out;
}

/**
 * Liegt dieser Antrag im Bereich?
 *
 * `programme === null` heißt **kein Filter** (Stufe „Alle"). Ein Antrag ohne
 * Programm-Nummer fällt heraus, sobald ein Bereich gilt — geraten wird nicht;
 * im Bestand kommt der Fall nicht vor (gemessen: 0).
 */
export function istImBereich(
  unterprogrammId: unknown, programme: ReadonlySet<string> | null,
): boolean {
  if (programme === null) return true;
  if (typeof unterprogrammId !== 'string') return false;
  const k = normKey(unterprogrammId);
  return k !== '' && programme.has(k);
}
