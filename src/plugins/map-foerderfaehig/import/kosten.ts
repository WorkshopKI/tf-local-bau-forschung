/**
 * Kostenarten, Fördersatz und Zuwendung.
 *
 * Wichtige Falle: das Feld `normiertemonatskosten_number` der Einsatzplanung
 * widerspricht im Echtfall der tatsächlichen Rechnung (5.999 gegen effektiv
 * 5.833 €/PM). Es wird deshalb NIRGENDS zur Kostenermittlung herangezogen —
 * Wahrheit sind `gesamtkostenAP` und `pkma_number`. Ein Convention-Test
 * bewacht das.
 */
import type { MapKosten } from '../types';
import { alsText, alsZahl, leseAlias } from './pfad';
import type { MapSchemaDefinition } from './schema-typen';

/** Zielfelder, die aus der Schema-Definition kommen. */
const KOSTEN_ZIELE = [
  'kosten.personal', 'kosten.dritte', 'kosten.fue', 'kosten.temp',
  'kosten.uebrige', 'kosten.gesamt', 'kosten.beantragteZuwendung',
  'kosten.foerdersatz',
] as const;

export type KostenZiel = (typeof KOSTEN_ZIELE)[number];

/**
 * Normalisiert den Fördersatz. Die Quelle liefert ihn als Anteil (`0.45`);
 * eine Prozentangabe (`45`) wird toleriert und umgerechnet. Werte ausserhalb
 * von 0…1 nach der Umrechnung gelten als unbrauchbar — dann lieber `null` als
 * ein stiller Default, der die Zuwendungsprüfung verfälscht. Rein.
 */
export function normalisiereFoerdersatz(wert: unknown): number | null {
  const roh = alsZahl(wert);
  if (roh === null) return null;
  const anteil = roh > 1 ? roh / 100 : roh;
  return anteil >= 0 && anteil <= 1 ? anteil : null;
}

/**
 * Erntet den Kostenblock über die Alias-Ketten der Schema-Definition.
 * Der Aufrufer protokolliert die Feldbefunde separat (siehe `adapter.ts`).
 */
export function ernteKosten(quelle: unknown, schema: MapSchemaDefinition): MapKosten {
  const hole = (ziel: KostenZiel): unknown => {
    const spez = schema.felder.find(f => f.ziel === ziel);
    return spez ? leseAlias(quelle, spez.pfade).wert : undefined;
  };

  const foerdersatzRoh = hole('kosten.foerdersatz');

  return {
    personal: alsZahl(hole('kosten.personal')),
    dritte: alsZahl(hole('kosten.dritte')),
    fue: alsZahl(hole('kosten.fue')),
    temp: alsZahl(hole('kosten.temp')),
    uebrige: alsZahl(hole('kosten.uebrige')),
    gesamt: alsZahl(hole('kosten.gesamt')),
    beantragteZuwendung: alsZahl(hole('kosten.beantragteZuwendung')),
    foerdersatz: normalisiereFoerdersatz(foerdersatzRoh),
    foerdersatzQuelle: alsText(foerdersatzRoh) ?? (alsZahl(foerdersatzRoh)?.toString() ?? null),
  };
}

/** Summe der Einzel-Kostenarten; `null`, wenn keine einzige erfasst ist. Rein. */
export function summiereKostenarten(kosten: MapKosten): number | null {
  const teile = [kosten.personal, kosten.dritte, kosten.fue, kosten.temp, kosten.uebrige];
  const vorhanden = teile.filter((t): t is number => t !== null);
  if (vorhanden.length === 0) return null;
  return vorhanden.reduce((a, b) => a + b, 0);
}
