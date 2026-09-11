/**
 * Tagesbrief — die Änderungen des Nachtlaufs je **Vorgang**, mit Namen. Rein.
 *
 * Das Journal keyt auf das Aktenzeichen (Teilvorhaben). Der Brief spricht aber
 * in Vorgängen wie „Meine Anträge" darunter: drei Teilvorhaben von BauKo-Pilot
 * sind EIN Name, nicht drei. Gemessen 11.09.2026 (Kürzel THü): der Brief sagte
 * „4 Vorgänge haben sich über Nacht geändert", gemeint waren zwei Verbünde.
 *
 * Der neue amtliche Status ist die eine Änderung, die im Fließtext ohne
 * Klartext lesbar ist. `D_`-Kürzel bleiben der Karte „Änderungen der letzten
 * Nacht" überlassen, die jedes mit seinem Tooltip erklärt.
 *
 * **Keine Personen-Achse** (Pitfall #48): gruppiert wird nach Vorgang, nie nach
 * dem, der etwas gesetzt hat — das Journal führt es gar nicht.
 */
import type { JournalEintrag } from '@/core/status';
import { wertText } from '@/plugins/antraege/status/journalTexte';

export interface NachtlaufName {
  /** Sprungziel: Verbund-Id, ersatzweise Aktenzeichen. */
  scopeId: string;
  /** Akronym, sonst das Aktenzeichen. */
  name: string;
  /** Journal-Einträge über alle Teilvorhaben dieses Vorgangs. */
  anzahl: number;
  /** Der neue amtliche Status in Worten; `null`, wenn er sich nicht (einheitlich) geändert hat. */
  statusNeu: string | null;
}

/** Was der Bauer über einen Antrag wissen muss — aus dem Antrags-Store. */
export interface AntragKopf {
  verbund_id?: string | null;
  akronym?: string | null;
}

/** Die Status-Spalten des Journals (`STATUS_SPALTEN`), hier nach Ebene benannt. */
const STATUS_VB = 'STATUS_VB';
const STATUS_TV = 'STATUS_TV';

interface Sammler {
  scopeId: string;
  name: string;
  anzahl: number;
  vb: { datum: string; wert: string } | null;
  tv: Set<string>;
}

/**
 * Journal-Einträge → ein Name je Vorgang, Statuswechsel zuerst, dann nach Zahl
 * der Einträge.
 *
 * `antrag-neu` zählt nicht: ein erstmals exportierter Antrag ist Zugang, keine
 * Änderung — dafür steht das Thema „Neu dazugekommen".
 */
export function nachtlaufNamen(
  eintraege: readonly JournalEintrag[],
  kopf: (aktenzeichen: string) => AntragKopf | undefined,
): NachtlaufName[] {
  const je = new Map<string, Sammler>();
  for (const e of eintraege) {
    if (e.art === 'antrag-neu') continue;
    const k = kopf(e.antragId);
    const scopeId = k?.verbund_id || e.antragId;
    let s = je.get(scopeId);
    if (!s) {
      s = { scopeId, name: k?.akronym?.trim() || e.antragId, anzahl: 0, vb: null, tv: new Set() };
      je.set(scopeId, s);
    }
    s.anzahl += 1;
    if ((e.art !== 'gesetzt' && e.art !== 'geaendert') || e.nach === undefined) continue;
    const wert = wertText(e.nach);
    if (e.feld === STATUS_VB) {
      if (s.vb === null || e.datum >= s.vb.datum) s.vb = { datum: e.datum, wert };
    } else if (e.feld === STATUS_TV) {
      s.tv.add(wert);
    }
  }
  return [...je.values()]
    .map((s): NachtlaufName => ({
      scopeId: s.scopeId,
      name: s.name,
      anzahl: s.anzahl,
      // Der Verbund-Status spricht für den Vorgang. Ohne ihn nur ein TV-Status,
      // den alle geänderten Teilvorhaben teilen — zwei verschiedene wären eine
      // Aussage über den Vorgang, die keiner der beiden Werte trägt.
      statusNeu: s.vb?.wert ?? (s.tv.size === 1 ? [...s.tv][0]! : null),
    }))
    .sort((a, b) => Number(b.statusNeu !== null) - Number(a.statusNeu !== null)
      || b.anzahl - a.anzahl
      || a.name.localeCompare(b.name, 'de'));
}
