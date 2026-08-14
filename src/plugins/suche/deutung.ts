/**
 * „Gesucht wird" — was die Suche aus der Eingabe gemacht hat.
 *
 * Die Suchseite gab bisher keinerlei Rückmeldung darüber, wie eine Anfrage
 * gedeutet wurde. Ob „laser schweißen" als zwei Wörter oder als Wortfolge
 * gelesen wurde, ob ein Wort überhaupt beitrug, ob die Ähnlichkeitssuche etwas
 * dazugenommen hat — all das war unsichtbar, und eine unerwartete Trefferzahl
 * sah aus wie ein leerer Bestand.
 *
 * Die Zeile zeigt es nicht nur, sie ist BEDIENBAR: ein abgewähltes Wort fällt
 * aus der Anfrage. Damit ist sie die schnellste Korrektur, die die Seite hat —
 * schneller als im Feld herumzueditieren.
 *
 * Rein — kein React, kein Store. Die Abwahl lebt sitzungs-lokal im
 * [store.ts](src/plugins/suche/store.ts).
 */
import type { SuchVerknuepfung } from '@/core/hooks/useSuchVerknuepfung';
import { zerlegeFeldAnfrage } from '@/core/services/search/feldpraefix';
import type { Trefferfeld } from '@/core/services/search/trefferstelle';

export interface DeutungsChip {
  /**
   * Der Teil, wie der Nutzer ihn getippt hat — MIT Feld-Präfix. Er ist die
   * Identität des Chips: darüber läuft die Abwahl, und daraus setzt
   * `wirksameAnfrage` die Anfrage wieder zusammen.
   */
  wort: string;
  /** Der reine Suchwert ohne Präfix — das, wonach gesucht und was markiert wird. */
  wert: string;
  /** Das getippte Feld, falls der Teil eines nannte (`ast:GMBU` → `organisation`). */
  feld?: Trefferfeld;
  /** Abgewählte Wörter bleiben sichtbar, zählen aber nicht mehr mit. */
  aktiv: boolean;
}

/**
 * Zerlegt die Eingabe in die Chips der Deutungszeile.
 *
 * Gelesen wird mit demselben Parser wie in der Suchstufe
 * ([feldpraefix.ts](src/core/services/search/feldpraefix.ts)) — sonst zeigte die
 * Zeile eine andere Deutung an, als gesucht wird, und das wäre schlimmer als
 * keine Zeile.
 *
 * Bei „genauer Wortfolge" gibt es GENAU EINEN Chip: dort ist die ganze Eingabe
 * ein Suchbegriff, und ein einzelnes Wort daraus abzuwählen hieße, etwas
 * anderes zu suchen als angezeigt.
 */
export function baueWortChips(
  query: string,
  verknuepfung: SuchVerknuepfung,
  abgewaehlt: readonly string[],
): DeutungsChip[] {
  const aus = new Set(abgewaehlt.map(w => w.toLowerCase()));
  const gesehen = new Set<string>();
  const chips: DeutungsChip[] = [];
  for (const t of zerlegeFeldAnfrage(query, verknuepfung === 'wortfolge')) {
    const klein = t.roh.toLowerCase();
    // Wer „laser laser" tippt, meint einmal Laser. Zwei gleiche Chips wären
    // zwei Schalter für dieselbe Sache.
    if (gesehen.has(klein)) continue;
    gesehen.add(klein);
    chips.push({ wort: t.roh, wert: t.wert, feld: t.feld, aktiv: !aus.has(klein) });
  }
  return chips;
}

/**
 * Die Anfrage, die tatsächlich gesucht wird — ohne die abgewählten Wörter.
 *
 * Sind ALLE Wörter abgewählt, kommt die ursprüngliche Anfrage zurück: eine
 * leere Suche wäre der Sprung in den Startzustand, und dort sähe der Nutzer
 * seine Chips nicht mehr und käme nicht zurück. Ein Zustand ohne Rückweg ist
 * kein Zustand, den man anbieten darf.
 */
export function wirksameAnfrage(
  query: string,
  verknuepfung: SuchVerknuepfung,
  abgewaehlt: readonly string[],
): string {
  if (abgewaehlt.length === 0) return query;
  const chips = baueWortChips(query, verknuepfung, abgewaehlt);
  const aktive = chips.filter(c => c.aktiv).map(c => c.wort);
  if (aktive.length === 0) return query;
  return aktive.join(' ');
}

/** Die aktiven Wörter als Nadeln für die Markierung im Treffertext. Ohne
 *  Präfix: markiert wird, wonach gesucht wurde — `ast:` steht in keinem Feld. */
export function markierWoerter(
  query: string,
  verknuepfung: SuchVerknuepfung,
  abgewaehlt: readonly string[],
): string[] {
  return baueWortChips(query, verknuepfung, abgewaehlt)
    .filter(c => c.aktiv)
    .map(c => c.wert);
}
