/**
 * Das Zeichen neben einem To-do, das aus der Rechnung VOR der letzten
 * Datenaktualisierung stammt (`AufgabenAnzeige.vorlaeufig`).
 *
 * Ein Symbol statt einer Graustufe: `--tf-text-tertiary` liegt mit 2,62:1 unter
 * AA, und der Aufgabentext ist der Haupttext der Zeile. Was es bedeutet, sagen
 * der Tooltip der Zeile (`AufgabenAnzeige.titel`) und das `aria-label` hier.
 */
import { RefreshCw } from 'lucide-react';

export function VorlaeufigMarke({ className = '' }: { className?: string }): React.ReactElement {
  return (
    <RefreshCw
      role="img"
      aria-label="Stand vor der letzten Datenaktualisierung, wird neu berechnet"
      className={`inline-block h-3 w-3 shrink-0 align-[-1px] text-[var(--tf-text-secondary)] ${className}`}
    />
  );
}
