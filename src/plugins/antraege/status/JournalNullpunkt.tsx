/**
 * Die leise Zeile unter der Chronik: **ab wann** sie belegt ist.
 *
 * Sie steht dort, weil die Chronik seit v4.58 zwei Quellen hat — die
 * Datumsspalten des heutigen Exports und das Import-Diff-Journal für das, was
 * ein früherer Export trug. Die zweite Quelle beginnt an einem Tag, und ohne
 * diese Angabe liest sich eine Chronik ohne durchgestrichene Zeilen als „hier
 * wurde nie etwas zurückgenommen" (vorgangssystem.md §12.2).
 *
 * Der Wortlaut liegt in `journalTexte.ts` — dieselbe Formulierung wie in der
 * Historie-Sektion. Zwei Ansichten desselben Journals, die denselben Sachverhalt
 * verschieden benennen, lesen sich wie zwei Sachverhalte.
 */
import type { AntragsChronikMitId } from '@/core/status';
import { nullpunktText } from './journalTexte';

export function JournalNullpunkt({ journalAb, chroniken, laden = false }: {
  journalAb: string | null;
  /** `null` = auf diesem Share läuft (noch) kein Journal. */
  chroniken: readonly AntragsChronikMitId[] | null;
  /**
   * Solange gelesen wird, steht hier **nichts**. `chroniken` ist dann noch
   * `null`, und das als „kein Journal" auszuweisen wäre eine Behauptung, die der
   * nächste Tick widerruft (Bug-Klasse 1, siehe `useJournalChroniken`).
   */
  laden?: boolean;
}): React.ReactElement | null {
  if (laden) return null;
  // Leere Liste zählt als „nicht geführt": es gibt keinen Antrag, für den
  // mitgeschrieben würde. `some` statt `every`, weil ein Verbund schon dann
  // belegt ist, wenn eines seiner Teilvorhaben im Bereich liegt.
  const gefuehrt = chroniken?.some(c => c.gefuehrt) ?? false;
  return (
    <p className="text-[11px] text-[var(--tf-text-tertiary)]">
      {nullpunktText(chroniken === null ? null : journalAb, gefuehrt)}
    </p>
  );
}
