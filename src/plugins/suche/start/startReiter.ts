/**
 * Welche Reiter der Startzustand hat, was an ihnen steht und welcher zuletzt
 * offen war.
 *
 * Der Startzustand zeigte bis v4.72 sechs gleichrangige Blöcke untereinander —
 * vier Spalten und zwei Sektionen. Zwei davon trugen nichts Eigenes: „Aus dem
 * Index" nannte dieselben zwei Zahlen, die seit v4.69 am rechten Ende der
 * Optionszeile stehen ([SuchOptionenZeile.tsx](src/plugins/suche/SuchOptionenZeile.tsx)),
 * und „Häufig gesucht" ist die zweite Hälfte derselben Verlaufsliste, aus der
 * auch „Letzte Suchen" kommt ([suchseite-utils.ts](src/plugins/suche/suchseite-utils.ts)).
 * Sechs Orte, an denen nichts heraussticht, sind kein Einstieg.
 *
 * **Der Zähler an einem Reiter sagt, was drin steht** — nicht, was es
 * theoretisch gäbe. Eine Zahl an einem Reiter ist dieselbe Zusage wie eine an
 * einer Facette: wer „Suchsprache 9" liest und sieben Zeilen vorfindet, hat
 * einmal zu oft nachgezählt.
 *
 * Rein — kein React, kein localStorage (der Leser bekommt den Rohwert gereicht,
 * damit er unter `environment:'node'` testbar bleibt; gleiche Trennung wie
 * `parseFeldGroesse`).
 */
import type { ScopeTabItem } from '@/components/ui/ScopeTabs';

export type StartReiterId = 'alle' | 'zuletzt' | 'suchsprache' | 'fragen' | 'stoebern';

/** Gerätelokal gemerkt: wer täglich in der Suchsprache landet, soll dort landen. */
export const START_REITER_KEY = 'teamflow_suche_start_reiter';

export const START_REITER_LABEL: Record<StartReiterId, string> = {
  alle: 'Alle',
  zuletzt: 'Zuletzt',
  suchsprache: 'Suchsprache',
  fragen: 'Fragen',
  stoebern: 'Stöbern',
};

/**
 * Wie viele Zeilen jeder Reiter zeigt.
 *
 * `stoebern` zählt die Felder zum Durchblättern, nicht ihre Werte — die Werte
 * stehen in Tausenden da und wären als Reiter-Zahl eine Trefferzusage, die
 * niemand einlöst.
 */
export interface StartZaehler {
  zuletzt: number;
  suchsprache: number;
  fragen: number;
  stoebern: number;
}

/**
 * Die Reiter in der Reihenfolge der Absicht: Wiedereinstieg zuerst, Stöbern
 * zuletzt. „Fragen" fehlt, wo der Build die natürlichsprachige Suche nicht
 * mitbringt — ein Reiter, der eine abwesende Fähigkeit bewirbt, ist schlimmer
 * als kein Reiter.
 */
export function startReiterIds(mitFragen: boolean): StartReiterId[] {
  return mitFragen
    ? ['alle', 'zuletzt', 'suchsprache', 'fragen', 'stoebern']
    : ['alle', 'zuletzt', 'suchsprache', 'stoebern'];
}

export function baueStartReiter(z: StartZaehler, mitFragen: boolean): ScopeTabItem[] {
  const zahl: Record<StartReiterId, number> = {
    // „Alle" zeigt von jeder Sorte die ersten Zeilen — seine Zahl ist deshalb
    // die Summe dessen, was es zu sehen gibt, nicht die der gezeigten Zeilen.
    alle: z.zuletzt + z.suchsprache + (mitFragen ? z.fragen : 0) + z.stoebern,
    zuletzt: z.zuletzt,
    suchsprache: z.suchsprache,
    fragen: z.fragen,
    stoebern: z.stoebern,
  };
  return startReiterIds(mitFragen).map(id => ({
    key: id,
    label: START_REITER_LABEL[id],
    count: zahl[id],
  }));
}

/**
 * Der gemerkte Reiter aus dem Rohwert — tolerant, weil dort alles stehen kann.
 *
 * Fällt auf `alle` zurück, wenn nichts oder Unbekanntes gespeichert ist, und
 * auch dann, wenn der gemerkte Reiter in diesem Build gar nicht existiert:
 * wer „fragen" gemerkt hat und die Variante wechselt, landete sonst auf einem
 * Reiter, den die Leiste nicht anbietet.
 */
export function leseStartReiter(raw: string | null, mitFragen: boolean): StartReiterId {
  if (raw === null) return 'alle';
  const erlaubt = startReiterIds(mitFragen);
  return (erlaubt as string[]).includes(raw) ? (raw as StartReiterId) : 'alle';
}
