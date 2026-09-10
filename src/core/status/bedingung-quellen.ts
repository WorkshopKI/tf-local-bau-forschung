/**
 * Die **Quellspalten** einer Bedingung oder Feldliste als Erklärung — der
 * Inhalt des Tooltips neben jeder abgeleiteten Aussage (CONTEXT.md
 * „Quellspalte").
 *
 * Zwei Regeln tragen das Modul:
 *
 * 1. **Die Felder kommen aus `bedingungFeldRefs`** — derselben Aufzählung, mit
 *    der der Evaluator seinen Kontext baut. Ein Operator mit zwei Feldern
 *    (`datumNachFeld`) steht damit automatisch mit beiden in der Erklärung.
 * 2. **Die Spalten kommen aus dem Schema** (`baueQuellSpaltenIndex`), nicht aus
 *    einer abgeschriebenen Liste. Ein Tooltip, der eine falsche Spalte nennt,
 *    verdeckte genau die Fehler, die er finden helfen soll.
 *
 * Der Satz ist `bedingungSatz` — derselbe Text, der sichtbar daneben steht.
 *
 * Rein; den Index reicht der Aufrufer herein.
 */
import { einzeiligesLabel, type QuellSpaltenIndex } from '@/core/services/csv/spalten-inventar';
import { bedingungFeldRefs } from './bedingung';
import { bedingungSatz, labelAufloeser, type FeldLabelQuelle } from './bedingung-text';
import type { Bedingung } from './typen';

/**
 * Strukturgleich mit `SpaltenHilfe` aus der Daten-Tabelle — gerendert wird mit
 * demselben `SpaltenHilfeInhalt`. Der Typ wohnt hier, weil der Kern keine
 * Komponenten importiert.
 */
export interface QuellSpaltenErklaerung {
  satz: string;
  /** Je Quellspalte eine Zeile; `fuer` nennt das Feld, das sie speist. */
  felder: { code: string; label: string; fuer?: string }[];
  regel?: string;
  hinweis?: string;
}

/**
 * Die Quellspalten einer Liste von `feldId`s.
 *
 * Zwei Fälle stehen ausdrücklich als Hinweis da, statt still zu fehlen:
 * - ein Feld ohne jede Quellspalte (nicht gemappt oder kein Import-Feld),
 * - ein Feld, das nur einige Programme mappen — dort bleibt es leer, und eine
 *   Bedingung darauf trifft nie. Genau das ist eine der Fehlerquellen, nach der
 *   ein Fachmensch mit diesem Tooltip sucht.
 */
export function feldQuellen(
  feldIds: readonly string[],
  index: QuellSpaltenIndex,
  satz: string,
  optionen: { labelVon?: (feldId: string) => string; regel?: string } = {},
): QuellSpaltenErklaerung {
  const labelVon = optionen.labelVon ?? index.labelVon;
  const felder: QuellSpaltenErklaerung['felder'] = [];
  const ohneSpalte: string[] = [];
  const luecken: string[] = [];

  for (const feldId of feldIds) {
    const name = labelVon(feldId);
    const fuer = name === feldId ? feldId : `${name} (${feldId})`;
    const { spalten, fehltIn } = index.quellSpaltenVon(feldId);
    if (spalten.length === 0) {
      ohneSpalte.push(fuer);
      continue;
    }
    for (const s of spalten) felder.push({ code: s.code, label: einzeiligesLabel(s.label), fuer });
    if (fehltIn.length > 0) luecken.push(`${name}: ${fehltIn.join(', ')}`);
  }

  const hinweise: string[] = [];
  if (ohneSpalte.length > 0) {
    hinweise.push(
      `Keine CSV-Spalte gefunden für ${ohneSpalte.join(', ')} — der Wert kommt nicht aus `
      + 'einem Import-Schema oder ist nicht gemappt.',
    );
  }
  if (luecken.length > 0) {
    hinweise.push(`In diesen Programmen nicht gemappt, dort bleibt das Feld leer: ${luecken.join('; ')}.`);
  }

  return {
    satz,
    felder,
    ...(optionen.regel ? { regel: optionen.regel } : null),
    ...(hinweise.length > 0 ? { hinweis: hinweise.join(' ') } : null),
  };
}

/** Die Quellspalten einer Bedingung — Satz und Feldnamen wie im sichtbaren Text. */
export function bedingungQuellen(
  b: Bedingung,
  index: QuellSpaltenIndex,
  quelle: FeldLabelQuelle,
  regel?: string,
): QuellSpaltenErklaerung {
  return feldQuellen(bedingungFeldRefs(b), index, bedingungSatz(b, quelle), {
    labelVon: labelAufloeser(quelle),
    ...(regel ? { regel } : null),
  });
}
