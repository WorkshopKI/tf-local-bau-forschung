/**
 * Größen-Modi der `SortableTable` — pure Ableitung von Modus, Tabellen-Stil,
 * Wrapper-Klassen und Kastenbreite. Kein DOM, damit die Modi testbar sind; warum
 * die `<col>` überhaupt in Prozent gerendert werden, steht in `tableSizing.ts`.
 *
 * | Modus | Wann | Tabelle |
 * |---|---|---|
 * | **einpassen** (Default) | kein `fitContentWidth` | füllt den Container per `flex: 1 1 auto` — wächst UND schrumpft, Boden `floorWidth`, darunter Scroll |
 * | **scroll** | `fitContentWidth` | Wunschbreite in Pixeln, horizontaler Scroll statt Stauchen |
 *
 * **Die gepinnte Breite ist die des KASTENS, nicht die der Tabelle**
 * (`leiteKastenStil`). Sie steht deshalb neben den Modi und nicht als dritter:
 * die Tabelle bleibt in ihrem Modus und füllt den schmaleren Kasten aus. Vorher
 * pinnte der Griff die Tabelle, während der Kasten containerbreit stehen blieb —
 * zwischen letzter Spalte und Rahmen klaffte die gezogene Breite als leere
 * Fläche.
 *
 * Der Wrapper muss zum Modus passen: im Einpass-Modus füllt die Flex-Zeile den
 * Container (`w-full`), im Scroll-Modus ist sie `w-max` und darf überlaufen.
 * Umgekehrt gilt: in einer `w-max`-Zeile darf die Tabellenbreite NIE prozentual
 * sein — das löst zirkulär auf (gemessen: Zeile wächst auf ~1.000.000px).
 */
import type { CSSProperties } from 'react';
import type { TableSizing } from './tableSizing';

export type TabellenModus = 'scroll' | 'einpassen';

/** Waagerechtes Zell-Polster (`px-3`) in Pixeln. Zwei Konsumenten rechnen damit:
 *  der klebende Band-Inhalt in `TableBody` (`left: 0` misst ab dem Scrollport-Rand
 *  und zöge die Beschriftung um genau dieses Polster nach links aus der Flucht)
 *  und {@link ERSTE_SPALTE_INSET_PX}. */
export const ZELL_POLSTER_PX = 12;

/**
 * Waagerechter Abstand von der AUSSENKANTE des Kastens bis zum Inhalt der ersten
 * Spalte — für Beschriftungen ausserhalb der Tabelle, die in deren Flucht stehen
 * sollen (die Trefferzahl unter der Fördertabelle steht in der Flucht der
 * Auswahl-Häkchen).
 *
 * Der Rahmen des Kastens ist `0.5px` breit, Chrome rendert ihn aber als ganzes
 * Pixel (nachgemessen) — deshalb 1 und nicht 0,5. Eine halbe Pixelabweichung
 * wäre hier sichtbar: sie verschiebt die Grundlinie nicht, aber die Flucht.
 */
export const ERSTE_SPALTE_INSET_PX = 1 + ZELL_POLSTER_PX;

export function leiteModus(fitContentWidth: boolean): TabellenModus {
  return fitContentWidth ? 'scroll' : 'einpassen';
}

/** `true`, sobald die Tabelle über den Container hinauswachsen darf. */
export function istScrollModus(modus: TabellenModus): boolean {
  return modus === 'scroll';
}

/**
 * Breite des äußeren Kastens (Rahmen + Scroller + Griff).
 *
 * `null` = keine gepinnte Breite, der Kasten füllt seinen Platz. Sonst genau die
 * gezogene Pixelbreite — gedeckelt auf `100%`, weil ein Pin breiter als der
 * verfügbare Platz sonst die Seite aufspannte. Der Deckel ist ohne Nebenwirkung
 * für die Geste: der Griff misst seine Startbreite am GERENDERTEN Kasten, zieht
 * also aus dem Zustand weiter, den man sieht.
 */
export function leiteKastenStil(totalWidth: number | null): CSSProperties {
  if (totalWidth === null) return {};
  return { width: `${totalWidth}px`, maxWidth: '100%' };
}

export interface TabellenStilOptionen {
  modus: TabellenModus;
  sizing: TableSizing;
}

export function leiteTabellenStil(o: TabellenStilOptionen): CSSProperties {
  const basis = { tableLayout: 'fixed', borderCollapse: 'collapse' } as const;
  if (o.modus === 'scroll') {
    // `renderWidth`, nicht `desiredWidth`: die `<col>`-Prozente beziehen sich
    // auf genau diese Zahl (bei verteiltem Überschuss die Containerbreite). Wer
    // hier die Spaltensumme setzte, gäbe jeder Spalte ihren Prozentsatz von
    // einer anderen Grundlage, als aus der er gerechnet wurde.
    //
    // `100%` meint hier den Scroll-Container, der bereits um die Griffbreite
    // schmaler ist (der Griff steht daneben, nicht darin) — deshalb keine
    // `calc()`-Korrektur mehr und damit auch kein Phantom-Scroll.
    return {
      ...basis,
      width: `${o.sizing.renderWidth}px`,
      minWidth: '100%',
      flex: '0 0 auto',
    };
  }
  // `1 1 auto` statt `0 1 auto`: Einpassen heißt in BEIDE Richtungen einpassen.
  // Mit reinem `flex-shrink` blieb die Tabelle bei ihrer Wunschbreite stehen,
  // sobald die Spaltensumme kleiner war als der Container — rechts blieb eine
  // Lücke, obwohl die Spalten sie hätten gebrauchen können. `flex-grow` verteilt
  // den freien Platz; weil die `<col>` Prozent sind, skalieren alle Spalten mit
  // demselben Faktor mit (die gemessenen Breiten bleiben also das Gewicht).
  //
  // `width` ist damit nur noch die Flex-Basis, aus der heraus gewachsen bzw.
  // gestaucht wird — `minWidth` bleibt der harte Boden, unter dem der
  // waagerechte Scrollbalken greift.
  return {
    ...basis,
    width: `${o.sizing.desiredWidth}px`,
    minWidth: `${o.sizing.floorWidth}px`,
    flex: '1 1 auto',
  };
}

/** Klassen der Flex-Zeile, die die Tabelle trägt. */
export function wrapperKlassen(modus: TabellenModus): string {
  return istScrollModus(modus)
    ? 'flex items-stretch w-max min-w-full'
    : 'flex items-stretch w-full min-w-0';
}
