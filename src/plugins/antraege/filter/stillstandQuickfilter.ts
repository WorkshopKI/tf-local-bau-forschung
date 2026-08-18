/**
 * Die **Stillstands-Pille**: seit wann hat sich an einem Vorgang nichts mehr
 * getan?
 *
 * Eigener Store-Slot statt `useFilterState.active`, wie PreCheck und Projektart —
 * die Achse ist abgeleitet (sie rechnet über die Kürzel-Datumsspalten aller
 * Vorkommen, nicht über ein Feld der Listen-Projektion) und erzeugt deshalb
 * keinen Filter-Chip.
 *
 * **Die Stufen sind Monate in Tagen.** Gefragt wird in Monaten („länger als 2
 * Monate"), gerechnet wird in Tagen — die Umrechnung steht hier einmal, damit
 * Pille und Frageplan dieselbe Zahl meinen.
 *
 * **Ohne Index keine Zähler.** Die Zahlen entstehen erst, wenn der
 * Aktivitäts-Index steht; bis dahin trägt die Pille keine. Eine Zahl zu zeigen,
 * die auf einem fehlenden Index beruht, wäre die Zusage einer Menge, die der
 * Klick nicht liefert (Facetten-Zahl = Zusage).
 */
import type { AntragListItem } from '@/core/services/csv/types';
import { beurteileStillstand, type AktivitaetsIndex } from '../frage/letzteAktivitaet';
import type { CollapsibleSegItem } from './CollapsibleSeg';

/** Sichtbarer Wert der Pille. `null` = keine Schwelle. */
export type StillstandStufe = number | null;

/**
 * Die wählbaren Stufen in Tagen — 1, 2, 3 und 6 Monate.
 *
 * Grob gestuft mit Absicht: die Frage ist „hängt hier etwas?", nicht „exakt wie
 * lange". Wer eine andere Schwelle braucht, nennt sie in einer Frage — der
 * Antragsplan setzt jede Tageszahl, nicht nur diese vier.
 */
export const STILLSTAND_STUFEN: readonly number[] = [30, 60, 90, 180];

export const STILLSTAND_ALLE_LABEL = 'Alle';

/** Beschriftung einer Stufe. Getrennt vom Wert, damit der Store Tage hält. */
export function stillstandLabel(stufe: StillstandStufe): string {
  if (stufe === null) return STILLSTAND_ALLE_LABEL;
  const monate = Math.round(stufe / 30);
  return monate >= 1 && Math.abs(stufe - monate * 30) < 1
    ? `> ${monate} Mon.`
    : `> ${stufe} T.`;
}

/** Der Wert zu einer Beschriftung — die Umkehrung, für `onChange` der Pille. */
export function stillstandStufeVon(label: string): StillstandStufe {
  if (label === STILLSTAND_ALLE_LABEL) return null;
  return STILLSTAND_STUFEN.find(s => stillstandLabel(s) === label) ?? null;
}

/**
 * Items für die `CollapsibleSeg`.
 *
 * `index === null` heißt: noch nicht gerechnet — dann ohne Zähler. Die Stufe
 * „Alle" trägt nie einen, weil sie nichts einschränkt.
 */
export function getStillstandItems(
  countBase: readonly AntragListItem[],
  index: AktivitaetsIndex | null,
  stichtag: string,
): CollapsibleSegItem[] {
  const zaehler = new Map<number, number>();
  if (index !== null) {
    for (const stufe of STILLSTAND_STUFEN) zaehler.set(stufe, 0);
    for (const a of countBase) {
      const eintrag = index.get(a.aktenzeichen);
      for (const stufe of STILLSTAND_STUFEN) {
        if (beurteileStillstand(eintrag, stufe, stichtag) === 'steht') {
          zaehler.set(stufe, (zaehler.get(stufe) ?? 0) + 1);
        }
      }
    }
  }
  return [
    { label: STILLSTAND_ALLE_LABEL, count: countBase.length },
    ...STILLSTAND_STUFEN.map(stufe => ({
      label: stillstandLabel(stufe),
      ...(index !== null ? { count: zaehler.get(stufe) ?? 0 } : {}),
      title: `Seit mehr als ${stufe} Tagen wurde kein Kürzel neu gesetzt.`
        + ' Anträge ohne datierbares Kürzel sind nicht prüfbar und fehlen hier.',
    })),
  ];
}
