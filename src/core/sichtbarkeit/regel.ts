/**
 * Die reinen Funktionen der Sichtbarkeits-Achsen — ohne React, ohne
 * `runtimeConfig`, ohne IDB. Alles, was entscheidet, steht hier und ist
 * einzeln testbar; die Anbindung (Store, Hook, Sidecar) liegt daneben.
 */
import type { KatalogEintrag, Marke, Marken, MarkenListe, Schalter } from './types';

/** Der leere Satz — Standard, immer sichtbar. Geteilt, damit `{}` nicht 179× entsteht. */
export const OHNE_MARKE: Marken = Object.freeze({});

/**
 * Die eine Regel: jede gesetzte Marke muss durch ihren Schalter gedeckt sein.
 *
 * UND, nicht ODER — beide Marken sind Einschränkungen. Wer `beta`+`experte`
 * trägt, ist neu UND tief: ein Experte ohne Beta-Schalter soll es nicht sehen
 * (es kann sich noch ändern), und ein Neugieriger ohne Expertenmodus auch
 * nicht (es ist nicht für ihn gedacht).
 */
export function istSichtbar(marken: Marken, schalter: Schalter): boolean {
  if (marken.beta && !schalter.beta) return false;
  if (marken.experte && !schalter.experte) return false;
  return true;
}

/** Trägt der Eintrag überhaupt eine Marke? */
export function istMarkiert(marken: Marken): boolean {
  return Boolean(marken.beta || marken.experte);
}

export function markenAusListe(liste: MarkenListe): Marken {
  const marken: Marken = {};
  if (liste.includes('beta')) marken.beta = true;
  if (liste.includes('experte')) marken.experte = true;
  return marken;
}

/** Stabile Reihenfolge (beta vor experte) — die Sidecar soll nicht diffen, weil sortiert wurde. */
export function markenZuListe(marken: Marken): MarkenListe {
  const liste: MarkenListe = [];
  if (marken.beta) liste.push('beta');
  if (marken.experte) liste.push('experte');
  return liste;
}

export function markenGleich(a: Marken, b: Marken): boolean {
  return Boolean(a.beta) === Boolean(b.beta) && Boolean(a.experte) === Boolean(b.experte);
}

/** Katalog als Nachschlagewerk. Einmal bauen, nicht je Abfrage. */
export function baueIndex(katalog: readonly KatalogEintrag[]): Map<string, KatalogEintrag> {
  return new Map(katalog.map(e => [e.id, e]));
}

/**
 * Was für diesen Eintrag GILT: die Kurator-Abweichung schlägt die Vorbelegung.
 *
 * Drei Fälle, die nicht zusammenfallen dürfen:
 * - Id unbekannt → `OHNE_MARKE`. Eine Id, die es nicht (mehr) gibt, darf nichts
 *   verbergen; die Sidecar behält sie trotzdem (siehe `sidecar.ts`).
 * - Eintrag unantastbar → `OHNE_MARKE`, **ohne** ins Overlay zu sehen. Sonst
 *   sperrte eine von Hand editierte Sidecar den Weg zu den Schaltern zu.
 * - sonst → Overlay-Eintrag, falls vorhanden, sonst die Vorbelegung.
 */
export function effektiveMarken(
  id: string,
  index: ReadonlyMap<string, KatalogEintrag>,
  overlay: ReadonlyMap<string, Marken>,
): Marken {
  const eintrag = index.get(id);
  if (!eintrag) return OHNE_MARKE;
  if (eintrag.unantastbar) return OHNE_MARKE;
  return overlay.get(id) ?? eintrag.marken;
}

/**
 * Reiter-Liste auf das Sichtbare kürzen. Generisch über den Schlüssel, weil die
 * App zwei Tab-Primitive kennt (`ScopeTabs` mit `key`, `Tabs` mit `id`).
 */
export function filtereReiter<T>(
  items: readonly T[],
  idVon: (item: T) => string,
  sichtbar: (id: string) => boolean,
): T[] {
  return items.filter(item => sichtbar(idVon(item)));
}

/**
 * Welcher Reiter nach dem Filtern aktiv ist.
 *
 * Der gemerkte Reiter ist die Falle: verschwindet er (Schalter aus, Kurator hat
 * markiert), zeigt die Seite sonst einen Inhalt ohne zugehörigen Reiter — oder
 * gar nichts. Dieselbe Klasse wie v4.107.2 („vom eigenen Reiter zurück auf
 * einen festen").
 *
 * Bleibt nichts übrig, gewinnt der bisherige Wert: eine leere Leiste ist besser
 * als ein erfundener Schlüssel. Der Guard `sichtbarkeit-seite-behaelt-reiter`
 * sorgt dafür, dass dieser Fall gar nicht erst eintritt.
 */
export function ersterSichtbarerReiter<T>(
  sichtbareItems: readonly T[],
  aktiv: string,
  keyVon: (item: T) => string,
): string {
  const erstes = sichtbareItems[0];
  if (erstes === undefined) return aktiv;
  if (sichtbareItems.some(item => keyVon(item) === aktiv)) return aktiv;
  return keyVon(erstes);
}

/**
 * Wie viele Einträge dieser Schalter **zusätzlich** einblendet — gemessen am
 * aktuellen Stand des anderen.
 *
 * Bei UND-Verknüpfung hängt der Zuwachs des einen Schalters vom anderen ab: mit
 * ausgeschaltetem Expertenmodus bringt „Beta" nur die reinen Beta-Einträge, mit
 * eingeschaltetem zusätzlich die `beta`+`experte`-Einträge. Eine feste Zahl in
 * der Kurzzeile wäre deshalb eine falsche Zusage.
 */
export function zaehleZugewinn(
  katalog: readonly KatalogEintrag[],
  overlay: ReadonlyMap<string, Marken>,
  schalter: Schalter,
  achse: Marke,
): number {
  const index = baueIndex(katalog);
  const nachher: Schalter = { ...schalter, [achse]: true };
  let n = 0;
  for (const eintrag of katalog) {
    const marken = effektiveMarken(eintrag.id, index, overlay);
    if (!istSichtbar(marken, schalter) && istSichtbar(marken, nachher)) n++;
  }
  return n;
}

export interface MarkenBilanz {
  gesamt: number;
  standard: number;
  nurBeta: number;
  nurExperte: number;
  beides: number;
}

/** Zähler für die Kopfzeile der Kurator-GUI. */
export function bilanziere(
  katalog: readonly KatalogEintrag[],
  overlay: ReadonlyMap<string, Marken>,
): MarkenBilanz {
  const index = baueIndex(katalog);
  const bilanz: MarkenBilanz = { gesamt: katalog.length, standard: 0, nurBeta: 0, nurExperte: 0, beides: 0 };
  for (const eintrag of katalog) {
    const m = effektiveMarken(eintrag.id, index, overlay);
    if (m.beta && m.experte) bilanz.beides++;
    else if (m.beta) bilanz.nurBeta++;
    else if (m.experte) bilanz.nurExperte++;
    else bilanz.standard++;
  }
  return bilanz;
}
