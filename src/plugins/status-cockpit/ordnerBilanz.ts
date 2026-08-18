/**
 * **Trägt dieser Ordner eine Spalte?** — die Auskunft, die dem Ordner-Editor
 * fehlte.
 *
 * Der Ordnerbaum sah lange nach Zierrat aus: über 25 Fassungen hat niemand ihn
 * umgebaut, vier seiner neunzehn Ordner sind leer, und 340 von 522 Kürzeln
 * liegen in „Nicht zugeordnet". Er ist es aber nicht — aus `kategorieId` leitet
 * [kategorie-projektion.ts](../../core/status/kategorie-projektion.ts) die
 * **Ordner-Spalten der Fördertabelle** ab, und jeder CSV-Import schreibt sie in
 * die Slim-Projektion.
 *
 * Genau deshalb ist ein leerer Ordner keine Kleinigkeit: er ist eine Spalte,
 * die in der Fördertabelle **nie** erscheinen kann. Das stand nirgends, und wer
 * die Spalte vermisste, suchte sie im Spaltenpicker statt hier.
 *
 * **Das Kriterium wird nicht nachgebaut**, sondern von `kategorienMitDatumsfeldern`
 * geholt: eine Spalte entsteht nur aus aktiven Datumsfeldern, deren Prominenz
 * nicht `ignoriert` ist, in einem aktiven Ordner. Eine zweite Fassung derselben
 * Regel liefe irgendwann auseinander, und dann behauptete diese Zeile etwas,
 * das die Tabelle nicht einlöst.
 *
 * Rein: keine IO, keine Uhr, kein React.
 */
import { kategorienMitDatumsfeldern } from '@/core/status';
import type { MappingVersion, StatusKategorie } from '@/core/status';

/** Die Ordner-Ids, aus denen wirklich eine Spalte der Fördertabelle wird. */
export function ordnerMitSpalte(version: MappingVersion): ReadonlySet<string> {
  return new Set(kategorienMitDatumsfeldern(version).map(k => k.kategorieId));
}

/**
 * Aktive Ordner, aus denen keine Spalte werden kann.
 *
 * **Stillgelegte bleiben draußen**: dass sie keine Spalte tragen, ist ihr Zweck
 * und kein Befund — dieselbe Regel wie bei den stillgelegten Kürzeln (v4.92)
 * und den stillgelegten To-do-Regeln (v4.95).
 */
export function ordnerOhneSpalte(version: MappingVersion): StatusKategorie[] {
  const traegt = ordnerMitSpalte(version);
  return (version.kategorien ?? []).filter(k => k.aktiv !== false && !traegt.has(k.id));
}

/**
 * Die Bilanzzeile über dem Baum — **namentlich**, wie bei den Schritten ohne
 * Datum und den wirkungslosen Regeln. Eine Anzahl allein schickte jemanden
 * durch neunzehn Ordner.
 *
 * Trägt jeder Ordner eine Spalte, sagt die Zeile das ausdrücklich: Schweigen
 * läse sich als „nicht geprüft".
 */
export function ordnerBilanzText(version: MappingVersion): string {
  const aktive = (version.kategorien ?? []).filter(k => k.aktiv !== false);
  const ohne = ordnerOhneSpalte(version);
  const kopf = `${aktive.length - ohne.length} von ${aktive.length} Ordnern tragen eine Spalte `
    + 'in der Fördertabelle';
  if (ohne.length === 0) return `${kopf} · jeder Ordner trägt eine`;
  return `${kopf} · ohne Spalte: ${ohne.map(k => k.label).join(', ')}`;
}
