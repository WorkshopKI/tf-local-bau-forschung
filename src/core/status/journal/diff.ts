/**
 * Der **Diff zwischen zwei Exportständen**. Rein und deterministisch.
 *
 * Fünf Eintragsarten, jede mit einer eigenen Aussage — insbesondere `geleert`:
 * dass jemand im Foyer eine Setzung zurückgenommen hat, ist heute vollständig
 * unsichtbar, weil der Export nur den Endzustand zeigt.
 *
 * **`antrag-neu` erzeugt EINEN Eintrag**, nicht einen je Feld: ein frisch
 * importierter Antrag mit vierzig gesetzten Kürzeln wäre sonst vierzig Zeilen
 * „gesetzt", die alle dasselbe sagen.
 */
import type { EintragsArt, JournalEintrag, JournalWert, JournalWerte, Stempel } from './typen';

const MS_TAG = 86_400_000;

export interface DiffMeta {
  stempel: Stempel;
  /** Datum des vorherigen Exports — bestimmt, ob die Spanne unscharf ist. */
  vorherDatum: string;
  /**
   * Anträge, die in diesem Lauf neu in den Betrachtungsbereich gekommen sind.
   *
   * Sie bekommen **keine** Einträge: ihr Fehlen im alten Stand heißt nicht „es
   * gab sie nicht", sondern „wir haben nicht hingesehen". Ohne diese Menge
   * entstünden bei jeder Bereichs-Erweiterung tausende Phantom-`antrag-neu`.
   */
  neuImBereich?: ReadonlySet<string>;
  /** Anträge, die aus dem Bereich gefallen sind — kein `antrag-fehlt`. */
  ausDemBereich?: ReadonlySet<string>;
}

/**
 * Liegt zwischen den beiden Exporten mehr als ein Tag?
 *
 * Dann ist nicht bestimmbar, an welchem Tag die Änderung geschah — der Eintrag
 * weist einen **Zeitraum** aus, statt ein Datum zu behaupten. Ein Wochenende
 * reicht dafür schon.
 */
export function istUnscharf(vorher: string, jetzt: string): boolean {
  const a = Date.parse(vorher);
  const b = Date.parse(jetzt);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return b - a > MS_TAG;
}

function baue(
  art: EintragsArt, antragId: string, meta: DiffMeta, unscharf: boolean,
  feld?: string, von?: JournalWert, nach?: JournalWert,
): JournalEintrag {
  return {
    stempel: meta.stempel.id,
    antragId,
    art,
    ...(feld !== undefined ? { feld } : {}),
    ...(von !== undefined ? { von } : {}),
    ...(nach !== undefined ? { nach } : {}),
    datum: meta.stempel.datum,
    ...(unscharf
      ? { unscharf: true as const, vonDatum: meta.vorherDatum, bisDatum: meta.stempel.datum }
      : {}),
  };
}

/**
 * Was sich zwischen `alt` und `neu` geändert hat. Rein.
 *
 * Sortiert nach Antrag und Feld — der Diff wird angehängt und später
 * dedupliziert, und eine stabile Reihenfolge macht zwei Läufe vergleichbar.
 */
export function berechneDiff(alt: JournalWerte, neu: JournalWerte, meta: DiffMeta): JournalEintrag[] {
  const unscharf = istUnscharf(meta.vorherDatum, meta.stempel.datum);
  const neuImBereich = meta.neuImBereich ?? new Set<string>();
  const ausDemBereich = meta.ausDemBereich ?? new Set<string>();
  const eintraege: JournalEintrag[] = [];

  for (const antragId of Object.keys(neu).sort()) {
    // Frisch im Bereich: wir haben vorher nicht hingesehen, das ist keine
    // Änderung. Der Lauf hat für ihn eine Baseline geschrieben.
    if (neuImBereich.has(antragId)) continue;
    const vorher = alt[antragId];
    if (vorher === undefined) {
      eintraege.push(baue('antrag-neu', antragId, meta, unscharf));
      continue;
    }
    const jetzt = neu[antragId]!;
    for (const feld of [...new Set([...Object.keys(vorher), ...Object.keys(jetzt)])].sort()) {
      const a = vorher[feld];
      const b = jetzt[feld];
      if (a === b) continue;
      if (a === undefined) eintraege.push(baue('gesetzt', antragId, meta, unscharf, feld, undefined, b));
      else if (b === undefined) eintraege.push(baue('geleert', antragId, meta, unscharf, feld, a));
      else eintraege.push(baue('geaendert', antragId, meta, unscharf, feld, a, b));
    }
  }

  for (const antragId of Object.keys(alt).sort()) {
    if (antragId in neu || ausDemBereich.has(antragId)) continue;
    // Festhalten, nichts löschen: ein Antrag, der aus dem Export verschwindet,
    // kann ein Exportfehler sein. Stilles Verschwinden wäre die schlechteste
    // aller Antworten.
    eintraege.push(baue('antrag-fehlt', antragId, meta, unscharf));
  }

  return eintraege;
}

/**
 * Doppelte entfernen — Schlüssel `(stempel, antragId, feld, art)`.
 *
 * Gebraucht beim **Lesen**, nicht beim Schreiben: der Lauf hängt erst das JSONL
 * an und schreibt dann den Stand. Bricht er dazwischen ab, erzeugt der nächste
 * Lauf denselben Diff erneut — das ist die richtige Reihenfolge (lieber ein
 * doppelter Eintrag als ein verlorener), und das Lesen räumt auf.
 */
export function dedupliziere(eintraege: readonly JournalEintrag[]): JournalEintrag[] {
  const gesehen = new Set<string>();
  const out: JournalEintrag[] = [];
  for (const e of eintraege) {
    const key = `${e.stempel}|${e.antragId}|${e.feld ?? ''}|${e.art}`;
    if (gesehen.has(key)) continue;
    gesehen.add(key);
    out.push(e);
  }
  return out;
}
