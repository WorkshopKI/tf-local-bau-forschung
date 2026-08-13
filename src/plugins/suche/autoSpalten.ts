/**
 * Welche Belege das Ergebnis von sich aus zeigen muss.
 *
 * Ausgangspunkt ist eine Beobachtung am echten Bestand: eine Suche nach
 * „Dresden" im Bereich „nur Ort & Bundesland" liefert 485 Treffer, und in der
 * Liste ist das Suchwort bei 4 von 30 sichtbaren Zeilen markiert — bei denen,
 * wo die Stadt zufällig im Firmennamen steht. Bei allen anderen liegt die
 * Fundstelle im Ort, und der Ort steht nirgends in der Zeile. Ein Etikett
 * „Ort" sagt DASS, nicht WAS.
 *
 * Die Liste ist kurz, und das ist der Punkt: von den neun Trefferstellen
 * ([trefferstelle.ts](src/core/services/search/trefferstelle.ts)) haben sieben
 * längst einen Platz im Ergebnis —
 *
 *  - `titel`, `kurzbeschreibung` → Spalte „Titel / Inhalt" (fest eingeblendet),
 *  - `akronym`, `organisation`  → im Snippet derselben Spalte
 *                                 (`makeAntragSnippet` = AST · Akronym · Geber),
 *  - `aktenzeichen`             → Spalte „FKZ",
 *  - `dokument`                 → Dateiname bzw. gefaltete Textstelle,
 *  - `aehnlichkeit`             → Spalten „Suche" und „Score".
 *
 * Übrig bleiben `standort` und `deskriptoren`. NUR sie stehen unten in `BELEG` —
 * wer hier eine achte Zeile ergänzt, muss vorher zeigen, dass der Beleg wirklich
 * nirgends sonst auftaucht, sonst wächst die Tabelle für nichts.
 *
 * Dieselbe Tabelle bedient beide Ansichten: die Tabelle blendet die Spalte ein,
 * die Liste schreibt den Wert in die Metazeile. Zwei Listen für dieselbe Frage
 * wären die Drift, gegen die die Layout-Regel steht.
 *
 * Rein — kein React, kein Store.
 */
import type { Suchbereich } from '@/core/services/search/suchbereich';
import type { Trefferfeld } from '@/core/services/search/trefferstelle';
import type { UnifiedSearchResult } from '@/core/types/search-result';

interface BelegDefinition {
  /** Die Trefferstelle, die ohne Zutun unsichtbar bliebe. */
  feld: Trefferfeld;
  /** Schlüssel der Spalte, die sie zeigt (siehe `columns.tsx`). */
  spalte: string;
  /** Der Belegtext am Treffer. Fehlt er, gibt es nichts zu zeigen. */
  wert: (r: UnifiedSearchResult) => string | undefined;
}

const BELEG: readonly BelegDefinition[] = [
  { feld: 'standort', spalte: 'standort', wert: r => r.standort },
  { feld: 'deskriptoren', spalte: 'deskriptoren', wert: r => r.deskriptoren },
];

/** Ein Beleg mit seinem Wert — was die Trefferzeile zusätzlich schreibt. */
export interface BelegWert {
  feld: Trefferfeld;
  wert: string;
}

/**
 * Belege dieses Treffers, die er selbst ausschreiben muss.
 *
 * Nur, was tatsächlich Fundstelle war: den Ort bei jedem Treffer anzuhängen
 * wäre bei einer Titelsuche Rauschen.
 */
export function belegWerte(treffer: UnifiedSearchResult): BelegWert[] {
  const felder = treffer.trefferfelder;
  if (!felder || felder.length === 0) return [];
  const out: BelegWert[] = [];
  for (const b of BELEG) {
    if (!felder.includes(b.feld)) continue;
    const wert = b.wert(treffer);
    if (wert && wert.length > 0) out.push({ feld: b.feld, wert });
  }
  return out;
}

/**
 * Spalten, die die Suchseite in der Tabelle selbst einblendet.
 *
 * Zwei Auslöser, beide vom Nutzer entschieden:
 *
 *  1. **Die Einstellung.** Wer „nur Ort & Bundesland" wählt, bekommt die Spalte
 *     immer — auch wenn eine Anfrage gerade nichts findet. Die Einstellung ist
 *     eine Ansage, kein Zufall.
 *  2. **Die Fundstelle.** Im Standardbereich („Titel, Beschreibung, Dokumente")
 *     entscheidet der Bestand: sobald EIN Treffer den Beleg trägt, erscheint die
 *     Spalte. Das ist der Normalfall — kaum jemand stellt das Dropdown um.
 *
 * Die Spalten sind damit an die Anfrage gebunden, nicht an die persönliche
 * Spaltenwahl: sie verschwinden wieder, wenn ihr Grund verschwindet, und sie
 * schreiben nichts in die gespeicherte Auswahl.
 */
export function autoSpalten(
  bereich: Suchbereich,
  treffer: readonly UnifiedSearchResult[],
): string[] {
  const out: string[] = [];
  for (const b of BELEG) {
    const durchEinstellung = bereich === 'standort' && b.feld === 'standort';
    if (durchEinstellung || treffer.some(r => hatBeleg(r, b))) out.push(b.spalte);
  }
  return out;
}

function hatBeleg(r: UnifiedSearchResult, b: BelegDefinition): boolean {
  if (!r.trefferfelder?.includes(b.feld)) return false;
  const wert = b.wert(r);
  return wert !== undefined && wert.length > 0;
}
