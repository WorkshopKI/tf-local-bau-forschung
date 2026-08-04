/**
 * Import der Trigger-Tabelle: welches Kürzel löst was aus.
 *
 * Drei Dinge macht dieser Import, die der Status-Katalog-Import nicht braucht:
 *
 * 1. **Programm als Schlüssel-Dimension.** Die Zuarbeit führt dieselben Kürzel
 *    für neun Programme mit je eigenen Triggern. Wird nur nach (Kürzel, Folge)
 *    geschlüsselt, fällt alles jenseits des ersten Programms als „Dublette" weg —
 *    gemessen 2450 → 362 Zeilen, ohne dass irgendwo etwas rot wird. Fehlt die
 *    Spalte ganz, **bricht der Import ab**: ein programmloser Bestand ließe sich
 *    keinem Antrag zuordnen.
 * 2. **Parsen mit Rest** — jede Zeile geht durch `parseTriggerZeile`. Nicht
 *    deutbare Zeilen werden mitgenommen und als „nicht interpretiert" markiert,
 *    nicht verworfen (siehe `trigger-parser.ts`). Der Import listet sie einzeln
 *    auf: eine plötzlich gestiegene Zahl heißt, dass sich das Schema der
 *    Zuarbeit geändert hat, und dann will man die Rohtexte sehen.
 * 3. **Abgleich gegen den Kürzel-Katalog** — referenziert ein Trigger ein
 *    Kürzel, das der einkompilierte Katalog nicht kennt, ist das eine
 *    **Warnung, kein Abbruch**. Der Trigger darf trotzdem übernommen werden;
 *    die Erklärung zeigt dann eben „unbekanntes Kürzel". Blockieren wäre falsch:
 *    die Trigger-Tabelle kann legitim neuer sein als die Kürzel-Zuarbeit, und
 *    dann wäre die App ohne Grund handlungsunfähig.
 *
 * Ausgenommen von dieser Warnung sind die vier Kürzel, welche die Fachabstimmung
 * benannt hat (`sonderkuerzel.ts`): sie stehen als **Auskunft** in der Vorschau,
 * nicht als Beanstandung. Eine Meldung, die jedes Mal dieselben vier bekannten
 * Namen aufzählt, liest irgendwann niemand mehr — und dann fällt der fünfte,
 * neue nicht mehr auf.
 */
import type { TriggerZeile } from '../typen';
import { parseTriggerZeile, referenzierteKuerzel, type TriggerRohzeile } from '../trigger-parser';
import { normKey } from '../normalisierung';
import { sonderKuerzel, type SonderKuerzel } from '../sonderkuerzel';
import { berechneDiff, type Diff } from './diff';
import { istLeseFehler, leseXlsxTabelle, spalte, zelle } from './xlsx-tabelle';

/** Blatt der Zuarbeit; fehlt es, wird über alle Blätter nach dem Kopf gesucht. */
export const TRIGGER_BLATT = 'Trigger-Prozeduren';

const ALIAS_KUERZEL = ['Kürzel', 'Kuerzel', 'Kurz', 'Code', 'Vorgangskürzel'];
const ALIAS_FOLGE = ['Folge', 'Nr', 'Reihenfolge', 'Schritt', 'Folge-Nr'];
const ALIAS_PROZEDUR = ['Prozedur', 'Trigger', 'Funktion', 'Aktion'];
const ALIAS_PARAMETER = ['Parameter', 'Argumente', 'Params', 'Werte'];
const ALIAS_PROGRAMM = ['Richtlinie', 'Richtlinie/Programm', 'RL', 'Programm', 'Programm-Nr', 'Förderprogramm'];

/**
 * Stabiler Vergleichsschlüssel einer Zeile: **Programm + Kürzel + Folge**.
 *
 * Das Programm gehört in den Schlüssel, nicht daneben — es ist der Grund, warum
 * es dieselbe (Kürzel, Folge) mehrfach gibt.
 */
export function triggerSchluessel(z: TriggerZeile): string {
  return `${normKey(z.programm)}#${normKey(z.kuerzel)}#${z.folge}`;
}

/** Zeilen- und Kürzel-Zahl eines Programms — die Vorschau zeigt sie je Zeile. */
export interface ProgrammStatistik {
  programm: string;
  zeilen: number;
  kuerzel: number;
}

/** Eine Zeile, die der Parser nicht deuten konnte — konkret statt nur gezählt. */
export interface NichtInterpretiert {
  programm: string;
  kuerzel: string;
  folge: number;
  parameterRoh: string;
}

export interface TriggerImportErgebnis {
  zeilen: TriggerZeile[];
  diff: Diff<TriggerZeile> | null;
  fehler?: string;
  warnungen: string[];
  /** Je Programm: wie viele Zeilen, wie viele verschiedene Kürzel. */
  jeProgramm: ProgrammStatistik[];
  /** Zeilen, die der Parser nicht deuten konnte (sie sind trotzdem dabei). */
  nichtInterpretiert: NichtInterpretiert[];
  /** Referenzierte Kürzel ohne Eintrag im Katalog — Warnung, kein Blocker. */
  unbekannteKuerzel: string[];
  /** Katalogfremd, aber von der Fachseite erklärt — Auskunft statt Warnung. */
  sonderkuerzel: SonderKuerzel[];
  /** Programme, für die Anträge da sind, die Datei aber keine Trigger führt. */
  programmeOhneTrigger: { programm: string; antraege: number }[];
}

function fehlerErgebnis(fehler: string): TriggerImportErgebnis {
  return {
    zeilen: [], diff: null, fehler, warnungen: [],
    jeProgramm: [], nichtInterpretiert: [], unbekannteKuerzel: [], sonderkuerzel: [],
    programmeOhneTrigger: [],
  };
}

/** Zeilen je Programm zählen, aufsteigend nach Programm-Nummer. */
function statistik(zeilen: readonly TriggerZeile[]): ProgrammStatistik[] {
  const je = new Map<string, { programm: string; zeilen: number; kuerzel: Set<string> }>();
  for (const z of zeilen) {
    const key = normKey(z.programm);
    const eintrag = je.get(key);
    if (eintrag) {
      eintrag.zeilen += 1;
      eintrag.kuerzel.add(normKey(z.kuerzel));
    } else {
      je.set(key, { programm: z.programm, zeilen: 1, kuerzel: new Set([normKey(z.kuerzel)]) });
    }
  }
  return [...je.values()]
    .map(e => ({ programm: e.programm, zeilen: e.zeilen, kuerzel: e.kuerzel.size }))
    .sort((a, b) => a.programm.localeCompare(b.programm, 'de', { numeric: true }));
}

/**
 * Liest die XLSX, parst jede Zeile und stellt sie dem Bestand gegenüber.
 *
 * @param bekannteKuerzel     Codes des Kürzel-Katalogs (ohne `D_`/`T_`-Präfix).
 * @param programmeImBestand  Programme der importierten Anträge samt Anzahl —
 *   nur für die Meldung „für diese Programme fehlen Trigger". Der Import
 *   scheitert daran nie; er sagt nur, wo die App danach schweigen wird.
 */
export async function importiereTriggerTabelle(
  datei: File,
  bestand: readonly TriggerZeile[],
  bekannteKuerzel: readonly string[],
  programmeImBestand: readonly { programm: string; antraege: number }[] = [],
): Promise<TriggerImportErgebnis> {
  const tabelle = await leseXlsxTabelle(
    datei,
    [ALIAS_PROGRAMM, ALIAS_KUERZEL, ALIAS_PROZEDUR, ALIAS_PARAMETER],
    { blattName: TRIGGER_BLATT },
  );
  if (istLeseFehler(tabelle)) return fehlerErgebnis(tabelle.fehler);

  const iProgramm = spalte(tabelle.kopf, ALIAS_PROGRAMM);
  const iKuerzel = spalte(tabelle.kopf, ALIAS_KUERZEL);
  const iFolge = spalte(tabelle.kopf, ALIAS_FOLGE);
  const iProzedur = spalte(tabelle.kopf, ALIAS_PROZEDUR);
  const iParameter = spalte(tabelle.kopf, ALIAS_PARAMETER);

  const warnungen: string[] = [];
  const zeilen: TriggerZeile[] = [];
  const gesehen = new Set<string>();

  tabelle.zeilen.forEach((row, i) => {
    const zeilenNr = tabelle.kopfZeileNr + 1 + i;
    const kuerzel = zelle(row, iKuerzel);
    if (!kuerzel) {
      warnungen.push(`Zeile ${zeilenNr}: ohne Kürzel — übersprungen.`);
      return;
    }
    const programm = zelle(row, iProgramm);
    if (!programm) {
      // Nicht „gilt für alle": eine Zeile ohne Programm ließe sich keinem Antrag
      // zuordnen und stünde bei jedem — genau der Fehler, den dieser Import behebt.
      warnungen.push(`Zeile ${zeilenNr}: ${kuerzel} ohne Programm-Angabe — übersprungen.`);
      return;
    }
    const roh: TriggerRohzeile = {
      programm,
      kuerzel,
      // Fehlt die Folge-Spalte ganz, ist die Reihenfolge die der Datei.
      folge: iFolge >= 0 ? zelle(row, iFolge) : String(i + 1),
      prozedur: zelle(row, iProzedur),
      parameter: zelle(row, iParameter),
    };
    const geparst = parseTriggerZeile(roh);
    const schluessel = triggerSchluessel(geparst);
    if (gesehen.has(schluessel)) {
      // Nach der Programm-Dimension ist das eine echte Dublette INNERHALB eines
      // Programms; Umlaut-Kürzel sind über `normKey` (NFC) bereits vereinheitlicht.
      // V7 bestätigt (Fachabstimmung 03.08.2026): „erster Eintrag gilt" bleibt —
      // die doppelten AZBE/Folge-1-Zeilen in 79 und 139 sind identisch, die
      // Warnung genügt. Kein Zusammenführen, kein stilles Verwerfen.
      warnungen.push(
        `Zeile ${zeilenNr}: ${geparst.kuerzel}/Folge ${geparst.folge} steht in Programm `
        + `${geparst.programm} mehrfach — erster Eintrag gilt.`,
      );
      return;
    }
    gesehen.add(schluessel);
    zeilen.push(geparst);
  });

  if (zeilen.length === 0) return fehlerErgebnis('Keine gültige Zeile gefunden (kein Kürzel mit Programm in der Datei).');

  const katalog = new Set(bekannteKuerzel.map(k => normKey(k)));
  const unbekannt = new Map<string, string>();
  const sonder = new Map<string, SonderKuerzel>();
  for (const z of zeilen) {
    for (const k of referenzierteKuerzel(z)) {
      const key = normKey(k);
      if (katalog.has(key)) continue;
      const erklaert = sonderKuerzel(k);
      // Erklärt ⇒ eigene Liste. Nur was danach übrigbleibt, ist wirklich neu.
      if (erklaert) sonder.set(key, erklaert);
      else if (!unbekannt.has(key)) unbekannt.set(key, k);
    }
  }

  const jeProgramm = statistik(zeilen);
  const mitTriggern = new Set(jeProgramm.map(p => normKey(p.programm)));
  const programmeOhneTrigger = programmeImBestand
    .filter(p => p.programm.trim() && !mitTriggern.has(normKey(p.programm)))
    .sort((a, b) => b.antraege - a.antraege);

  const diff = berechneDiff(
    bestand, zeilen,
    triggerSchluessel,
    z => ({ prozedur: z.prozedur, parameterRoh: z.parameterRoh }),
  );

  return {
    zeilen,
    diff,
    warnungen,
    jeProgramm,
    nichtInterpretiert: zeilen
      .filter(z => z.geparst === null)
      .map(z => ({
        programm: z.programm, kuerzel: z.kuerzel, folge: z.folge, parameterRoh: z.parameterRoh,
      })),
    unbekannteKuerzel: [...unbekannt.values()].sort((a, b) => a.localeCompare(b, 'de')),
    sonderkuerzel: [...sonder.values()].sort((a, b) => a.kuerzel.localeCompare(b.kuerzel, 'de')),
    programmeOhneTrigger,
  };
}
