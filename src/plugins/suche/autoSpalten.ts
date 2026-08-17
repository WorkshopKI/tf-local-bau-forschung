/**
 * Welche Belege das Ergebnis von sich aus zeigen muss.
 *
 * Ausgangspunkt ist eine Beobachtung am echten Bestand: eine Suche nach
 * „Dresden" im Ortsbereich liefert 485 Treffer, und in der
 * Liste ist das Suchwort bei 4 von 30 sichtbaren Zeilen markiert — bei denen,
 * wo die Stadt zufällig im Firmennamen steht. Bei allen anderen liegt die
 * Fundstelle im Ort, und der Ort steht nirgends in der Zeile. Ein Etikett
 * „Ort" sagt DASS, nicht WAS.
 *
 * Die Liste zählt auf, was KEINEN Platz hat: von den dreizehn Trefferstellen
 * ([trefferstelle.ts](src/core/services/search/trefferstelle.ts)) haben sechs
 * längst einen im Ergebnis —
 *
 *  - `titel`, `kurzbeschreibung` → Spalte „Titel / Inhalt" (fest eingeblendet),
 *  - `akronym`, `organisation`  → im Snippet derselben Spalte
 *                                 (`makeAntragSnippet` = AST · Akronym · Geber),
 *  - `aktenzeichen`             → Spalte „FKZ",
 *  - `dokument`                 → Dateiname bzw. gefaltete Textstelle,
 *  - `aehnlichkeit`             → Spalten „Suche" und „Score".
 *
 * Übrig bleiben `standort`, `deskriptoren`, `domain`, seit v4.50 `netzwerk`,
 * `wahlkreis` und `notiz`, seit v4.53 das `verbundkennzeichen` und seit v4.81
 * das `bundesland` (bis dahin im Standort miterfasst, siehe
 * [search-corpus.ts](src/plugins/antraege/services/search-corpus.ts)). NUR sie
 * stehen unten in `BELEG`; wer hier eine weitere Zeile ergänzt, muss vorher
 * zeigen, dass der Beleg wirklich nirgends sonst auftaucht, sonst wächst die
 * Tabelle für nichts.
 *
 * Für die drei aus v4.50 ist es gezeigt: der Netzwerkname steht in keiner Spalte
 * (die Trefferliste zeigt AST · Akronym · Geber), der Wahlkreis erklärt einen
 * Treffer, dessen Ortsfeld das Suchwort gar nicht enthält (5 274 von 14 218
 * Anträgen nennen dort einen anderen Ort), und die Arbeitsnotiz steht überhaupt
 * nur auf der Detailseite des Antrags. Und für das Verbundkennzeichen: die
 * Tabelle führt eine Spalte „FKZ" (das Teilvorhaben), aber keine für seinen
 * Verbund — wer `ZKN073232` tippt, bekommt neun Zeilen, in denen die getippte
 * Nummer nirgends steht.
 *
 * Für `domain` ist das gezeigt: die Web-Adresse wird aus der Kontakt-Mail
 * abgeleitet und steht in keiner Spalte und in keinem Snippet. Sie existiert
 * genau für die Einrichtungen, die ihr Kürzel NICHT im Namen führen — wer
 * „GMBU" sucht, sieht in der Zeile sonst nur „Gesellschaft zur Förderung von
 * Medizin-, Bio- und Umwelt-Technologien e.V." und damit keinen Grund für den
 * Treffer. Das ist derselbe Fall wie bei „Dresden" oben, nur eine Stufe
 * schärfer: hier steht das Suchwort in KEINEM sichtbaren Feld.
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
  { feld: 'bundesland', spalte: 'bundesland', wert: r => r.bundesland },
  { feld: 'deskriptoren', spalte: 'deskriptoren', wert: r => r.deskriptoren },
  { feld: 'domain', spalte: 'domain', wert: r => r.domain },
  { feld: 'netzwerk', spalte: 'netzwerk', wert: r => r.netzwerk },
  { feld: 'wahlkreis', spalte: 'wahlkreis', wert: r => r.wahlkreis },
  { feld: 'notiz', spalte: 'notiz', wert: r => r.notiz },
  { feld: 'verbundkennzeichen', spalte: 'verbundkennzeichen', wert: r => r.verbundkennzeichen },
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
 *  1. **Die Einstellung.** Wer „nur Ort, Bundesland & Wahlkreis" wählt, bekommt
 *     die Ortsspalte immer — auch wenn eine Anfrage gerade nichts findet. Die
 *     Einstellung ist eine Ansage, kein Zufall. Der Wahlkreis kommt NICHT
 *     automatisch dazu: er ist in diesem Bereich die seltenere Fundstelle, und
 *     zwei Dauerspalten für eine Wahl wären eine zu viel.
 *  2. **Die Fundstelle.** Im Standardbereich („alle Felder") entscheidet der
 *     Bestand: sobald EIN Treffer den Beleg trägt, erscheint die Spalte. Das ist
 *     der Normalfall — kaum jemand stellt das Dropdown um.
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
