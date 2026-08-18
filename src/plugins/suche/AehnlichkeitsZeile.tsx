/**
 * Was die Ähnlichkeitsstufe getan hat — die Zeile unter der Optionszeile.
 *
 * Zwei Sorten Meldung, dieselbe Zeile: die Stufe konnte gar nicht wirken
 * (`corpus-empty`/`model-failed`) — oder sie lief und legt Rechenschaft ab
 * ([aehnlichkeitsSatz.ts](./aehnlichkeitsSatz.ts), inkl. der drei Fälle und der
 * Reichweite des Korpus).
 */
import type { SemanticStatus, SemantikBefund } from '@/core/hooks/useUnifiedSearch';
import { aehnlichkeitsSatz } from './aehnlichkeitsSatz';

const OHNE_WIRKUNG: Record<'corpus-empty' | 'model-failed', string> = {
  'corpus-empty': 'Ähnlichkeitssuche ohne Wirkung: Auf diesem Rechner liegen keine Embedding-Vektoren (Korpus). Er wird beim Start automatisch vom Datenspeicher geladen, sofern dort vorhanden — sonst im Auslastungs-Modul „Vom Datenspeicher laden".',
  'model-failed': 'Ähnlichkeitssuche ohne Wirkung: Das Embedding-Modell konnte nicht geladen werden (Details in der Browser-Konsole, F12). Es werden nur Wortlaut-Treffer angezeigt.',
};

export function AehnlichkeitsZeile({ an, status, befund, bestand }: {
  /** Der Schalter selbst — ohne ihn gibt es nichts zu berichten. */
  an: boolean;
  status: SemanticStatus;
  befund: SemantikBefund | null;
  /** Bestandszahl des Suchindex, für die Reichweite. */
  bestand: number;
}): React.ReactElement | null {
  if (!an) return null;
  const text = status === 'corpus-empty' || status === 'model-failed'
    ? OHNE_WIRKUNG[status]
    : (status === 'ok' && befund !== null ? aehnlichkeitsSatz(befund, bestand) : null);
  if (text === null) return null;

  return (
    <div className="mt-2 flex w-full max-w-4xl items-start gap-1.5 text-[11.5px] text-[var(--tf-text-tertiary)]">
      <span aria-hidden="true">ⓘ</span>
      <span>{text}</span>
    </div>
  );
}
