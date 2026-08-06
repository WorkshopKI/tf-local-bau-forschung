/**
 * Größen-Modi der `SortableTable` — pure Ableitung von Modus, Tabellen-Stil und
 * Wrapper-Klassen. Kein DOM, damit die drei Modi testbar sind; warum die `<col>`
 * überhaupt in Prozent gerendert werden, steht in `tableSizing.ts`.
 *
 * | Modus | Wann | Tabelle |
 * |---|---|---|
 * | **einpassen** (Default) | kein `fitContentWidth`, keine gepinnte Breite | Wunschbreite, schrumpft per `flex-shrink` auf den Container, Boden `floorWidth` — darunter Scroll |
 * | **gepinnt** | `totalWidth` gesetzt (Griff gezogen) | exakt diese Pixelbreite, Spalten skalieren proportional |
 * | **scroll** | `fitContentWidth` | Wunschbreite in Pixeln, horizontaler Scroll statt Stauchen |
 *
 * Der Wrapper muss zum Modus passen: im Einpass-Modus füllt die Flex-Zeile den
 * Container (`w-full`), in den Scroll-Modi ist sie `w-max` und darf überlaufen.
 * Umgekehrt gilt: in einer `w-max`-Zeile darf die Tabellenbreite NIE prozentual
 * sein — das löst zirkulär auf (gemessen: Zeile wächst auf ~1.000.000px).
 */
import type { CSSProperties } from 'react';
import type { TableSizing } from './tableSizing';

export type TabellenModus = 'gepinnt' | 'scroll' | 'einpassen';

export function leiteModus(totalWidthActive: boolean, fitContentWidth: boolean): TabellenModus {
  if (totalWidthActive) return 'gepinnt';
  return fitContentWidth ? 'scroll' : 'einpassen';
}

/** `true`, sobald die Tabelle über den Container hinauswachsen darf. */
export function istScrollModus(modus: TabellenModus): boolean {
  return modus !== 'einpassen';
}

export interface TabellenStilOptionen {
  modus: TabellenModus;
  sizing: TableSizing;
  /** Nur im Modus `gepinnt` ausgewertet. */
  totalWidth: number | null;
}

export function leiteTabellenStil(o: TabellenStilOptionen): CSSProperties {
  const basis = { tableLayout: 'fixed', borderCollapse: 'collapse' } as const;
  if (o.modus === 'gepinnt') {
    return { ...basis, width: `${o.totalWidth}px`, flex: '0 0 auto' };
  }
  if (o.modus === 'scroll') {
    // `100%` meint hier den Scroll-Container, der bereits um die Griffbreite
    // schmaler ist (der Griff steht daneben, nicht darin) — deshalb keine
    // `calc()`-Korrektur mehr und damit auch kein Phantom-Scroll.
    return {
      ...basis,
      width: `${o.sizing.desiredWidth}px`,
      minWidth: '100%',
      flex: '0 0 auto',
    };
  }
  return {
    ...basis,
    width: `${o.sizing.desiredWidth}px`,
    minWidth: `${o.sizing.floorWidth}px`,
    flex: '0 1 auto',
  };
}

/** Klassen der Flex-Zeile, die Tabelle + Griff trägt. */
export function wrapperKlassen(modus: TabellenModus): string {
  return istScrollModus(modus)
    ? 'flex items-stretch w-max min-w-full'
    : 'flex items-stretch w-full min-w-0';
}
