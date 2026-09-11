/**
 * Wann der Assistent einen Vorgang als abgeschlossen behandelt — die Weiche, ab
 * der Frist-Satz, Frist-Zahl und Stillstands-Wächter schweigen.
 *
 * Ein Verbund ist erst abgeschlossen, wenn sein Status UND jedes Teilvorhaben es
 * sind. Ein Teilvorhaben im Widerspruch zur Ablehnung ist offene Arbeit und hält
 * ihn offen (CALYPSO: Verbund „abgelehnt/zurückgezogen", das TV im Widerspruch;
 * Liste und Detailseite zeigen dort weiter die Frist). Wer nur den Verbund-Status
 * fragte, erklärte den Vorgang für erledigt.
 *
 * Der Status selbst bleibt, wie importiert (Pitfall #44) — hier entsteht keiner.
 */
import { isTerminalStatus } from '@/core/utils/status-canonical';

export function vorgangAbgeschlossen(
  status: string | null | undefined,
  teilvorhabenStatus: ReadonlyArray<string | null | undefined>,
): boolean {
  return isTerminalStatus(status) && teilvorhabenStatus.every(s => isTerminalStatus(s));
}
