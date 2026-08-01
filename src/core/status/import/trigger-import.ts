/**
 * Import der Trigger-Tabelle: welches Kürzel löst was aus.
 *
 * Zwei Dinge macht dieser Import, die der Status-Katalog-Import nicht braucht:
 *
 * 1. **Parsen mit Rest** — jede Zeile geht durch `parseTriggerZeile`. Nicht
 *    deutbare Zeilen werden mitgenommen und als „nicht interpretiert" markiert,
 *    nicht verworfen (siehe `trigger-parser.ts`). Der Import meldet, wie viele
 *    das sind: eine plötzlich gestiegene Zahl heißt, dass sich das Schema der
 *    Zuarbeit geändert hat.
 * 2. **Abgleich gegen den Kürzel-Katalog** — referenziert ein Trigger ein
 *    Kürzel, das der einkompilierte Katalog nicht kennt, ist das eine
 *    **Warnung, kein Abbruch**. Der Trigger darf trotzdem übernommen werden;
 *    die Erklärung zeigt dann eben „unbekanntes Kürzel". Blockieren wäre falsch:
 *    die Trigger-Tabelle kann legitim neuer sein als die Kürzel-Zuarbeit, und
 *    dann wäre die App ohne Grund handlungsunfähig.
 */
import type { TriggerZeile } from '../typen';
import { parseTriggerZeile, referenzierteKuerzel, type TriggerRohzeile } from '../trigger-parser';
import { normKey } from '../normalisierung';
import { berechneDiff, type Diff } from './diff';
import { istLeseFehler, leseXlsxTabelle, spalte, zelle } from './xlsx-tabelle';

const ALIAS_KUERZEL = ['Kürzel', 'Kuerzel', 'Kurz', 'Code', 'Vorgangskürzel'];
const ALIAS_FOLGE = ['Folge', 'Nr', 'Reihenfolge', 'Schritt', 'Folge-Nr'];
const ALIAS_PROZEDUR = ['Prozedur', 'Trigger', 'Funktion', 'Aktion'];
const ALIAS_PARAMETER = ['Parameter', 'Argumente', 'Params', 'Werte'];
const ALIAS_RICHTLINIE = ['Richtlinie', 'RL', 'Programm'];

/** Stabiler Vergleichsschlüssel einer Zeile: Kürzel + Folge. */
export function triggerSchluessel(z: TriggerZeile): string {
  return `${normKey(z.kuerzel)}#${z.folge}`;
}

export interface TriggerImportErgebnis {
  zeilen: TriggerZeile[];
  diff: Diff<TriggerZeile> | null;
  fehler?: string;
  warnungen: string[];
  /** Wie viele Zeilen der Parser nicht deuten konnte (sie sind trotzdem dabei). */
  nichtInterpretiert: number;
  /** Referenzierte Kürzel ohne Eintrag im Katalog — Warnung, kein Blocker. */
  unbekannteKuerzel: string[];
}

function fehlerErgebnis(fehler: string): TriggerImportErgebnis {
  return {
    zeilen: [], diff: null, fehler, warnungen: [],
    nichtInterpretiert: 0, unbekannteKuerzel: [],
  };
}

/**
 * Liest die XLSX, parst jede Zeile und stellt sie dem Bestand gegenüber.
 *
 * @param bekannteKuerzel Codes des Kürzel-Katalogs (ohne `D_`/`T_`-Präfix).
 */
export async function importiereTriggerTabelle(
  datei: File,
  bestand: readonly TriggerZeile[],
  bekannteKuerzel: readonly string[],
): Promise<TriggerImportErgebnis> {
  const tabelle = await leseXlsxTabelle(datei, [ALIAS_KUERZEL, ALIAS_PROZEDUR, ALIAS_PARAMETER]);
  if (istLeseFehler(tabelle)) return fehlerErgebnis(tabelle.fehler);

  const iKuerzel = spalte(tabelle.kopf, ALIAS_KUERZEL);
  const iFolge = spalte(tabelle.kopf, ALIAS_FOLGE);
  const iProzedur = spalte(tabelle.kopf, ALIAS_PROZEDUR);
  const iParameter = spalte(tabelle.kopf, ALIAS_PARAMETER);
  const iRichtlinie = spalte(tabelle.kopf, ALIAS_RICHTLINIE);

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
    const roh: TriggerRohzeile = {
      kuerzel,
      // Fehlt die Folge-Spalte ganz, ist die Reihenfolge die der Datei.
      folge: iFolge >= 0 ? zelle(row, iFolge) : String(i + 1),
      prozedur: zelle(row, iProzedur),
      parameter: zelle(row, iParameter),
      ...(iRichtlinie >= 0 ? { richtlinie: zelle(row, iRichtlinie) } : {}),
    };
    const geparst = parseTriggerZeile(roh);
    const schluessel = triggerSchluessel(geparst);
    if (gesehen.has(schluessel)) {
      warnungen.push(`Zeile ${zeilenNr}: ${geparst.kuerzel}/Folge ${geparst.folge} steht mehrfach — erster Eintrag gilt.`);
      return;
    }
    gesehen.add(schluessel);
    zeilen.push(geparst);
  });

  if (zeilen.length === 0) return fehlerErgebnis('Keine gültige Zeile gefunden (kein Kürzel in der Datei).');

  const katalog = new Set(bekannteKuerzel.map(k => normKey(k)));
  const unbekannt = new Set<string>();
  for (const z of zeilen) {
    for (const k of referenzierteKuerzel(z)) {
      if (!katalog.has(normKey(k))) unbekannt.add(k);
    }
  }

  const diff = berechneDiff(
    bestand, zeilen,
    triggerSchluessel,
    z => ({ prozedur: z.prozedur, parameterRoh: z.parameterRoh }),
  );

  return {
    zeilen,
    diff,
    warnungen,
    nichtInterpretiert: zeilen.filter(z => z.geparst === null).length,
    unbekannteKuerzel: [...unbekannt].sort(),
  };
}
