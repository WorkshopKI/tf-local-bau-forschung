/**
 * Wortlaut und Zahlenform der Journal-Anzeigen — geteilt zwischen dem Verlauf am
 * Teilvorhaben (`JournalVerlauf`) und der Historie am Verbund (`VerbundHistorie`).
 *
 * Zwei Ansichten desselben Journals, die dieselbe Änderung verschieden benennen
 * („zurückgenommen" hier, „geleert" dort), lesen sich wie zwei verschiedene
 * Sachverhalte. Deshalb liegt die Formulierung hier und nicht je Ansicht.
 */
import type { JournalEintrag } from '@/core/status';

export const ART_TEXT: Record<JournalEintrag['art'], string> = {
  gesetzt: 'gesetzt',
  geaendert: 'geändert',
  geleert: 'zurückgenommen',
  'antrag-neu': 'erstmals im Export',
  'antrag-fehlt': 'nicht mehr im Export',
};

/** `20260803` → `03.08.2026`; Text bleibt Text. */
export function wertText(w: JournalEintrag['von']): string {
  if (w === undefined) return '—';
  if (typeof w === 'number') {
    const s = String(w);
    return s.length === 8 ? `${s.slice(6, 8)}.${s.slice(4, 6)}.${s.slice(0, 4)}` : s;
  }
  return w;
}

/** ISO-Tag → `DD.MM.YYYY`; unlesbares bleibt, wie es kam. */
export function tagDe(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/**
 * Wann — als Tag oder, bei unscharfer Spanne, als Zeitraum.
 *
 * Unscharf heißt: zwischen zwei Exporten lagen mehrere Tage, der genaue Tag der
 * Änderung ist nicht belegt. Das als Datum auszuweisen wäre eine Behauptung.
 */
export function wannText(e: JournalEintrag): string {
  return e.unscharf && e.vonDatum && e.bisDatum
    ? `zwischen ${tagDe(e.vonDatum)} und ${tagDe(e.bisDatum)}`
    : `am ${tagDe(e.datum)}`;
}

/**
 * Was das Journal über diesen Vorgang **überhaupt** sagen kann — drei Zustände,
 * jeder benannt, keiner still.
 *
 * Der Nullpunkt gehört an jede Journal-Anzeige (vorgangssystem.md §12.2): ohne
 * ihn liest sich eine Chronik ohne Rücknahmen als „es gab keine". Und „für
 * diesen Vorgang wird nicht mitgeschrieben" ist eine andere Auskunft als „es hat
 * sich nichts geändert" (§12.4) — die beiden zu verschmelzen wäre der teuerste
 * Irrtum, den diese Zeile ermöglichen kann.
 *
 * @param journalAb Nullpunkt; `null` = auf diesem Share läuft kein Journal.
 * @param gefuehrt Steht der Vorgang im Betrachtungsbereich, für den mitgeschrieben wird?
 */
export function nullpunktText(journalAb: string | null, gefuehrt: boolean): string {
  if (journalAb === null) {
    return 'Auf diesem Daten-Share wird kein Änderungs-Journal geführt — zurückgenommene '
      + 'Termine lassen sich nicht belegen.';
  }
  if (!gefuehrt) {
    return 'Für diesen Vorgang wird kein Änderungs-Journal geführt — er stand beim letzten '
      + 'Nachtlauf nicht im Betrachtungsbereich.';
  }
  return `Änderungen sind ab ${tagDe(journalAb)} belegt — frühere Setzungen sind im Export `
    + 'überschrieben und nicht rekonstruierbar.';
}

/** Ein Eintrag als eine Zeile: „geändert am 07.08.2026 · 05.08.2026 → 12.08.2026". */
export function eintragText(e: JournalEintrag): string {
  const kopf = `${ART_TEXT[e.art]} ${wannText(e)}`;
  if (e.art === 'geaendert') return `${kopf} · ${wertText(e.von)} → ${wertText(e.nach)}`;
  if (e.art === 'gesetzt') return `${kopf} · ${wertText(e.nach)}`;
  if (e.art === 'geleert') return `${kopf} · vorher ${wertText(e.von)}`;
  return kopf;
}
