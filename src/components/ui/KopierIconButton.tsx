/**
 * Icon-only Kopier-Knopf — die kanonische Heimat des Dreiklangs
 * „Copy → Check → AlertTriangle", der vorher in TvTitelCopyButton und dem
 * Chat-CopyButton doppelt lag.
 *
 * Zustand kommt vollstaendig aus `useKopierAktion` (Pitfall #15, also ueber
 * `kopiereText` statt der rohen Browser-API). Zwei Eigenschaften sind bewusst
 * eingebaut statt am Aufrufer:
 *
 *  - `stopPropagation`: der Knopf sitzt typischerweise INNERHALB einer klickbaren
 *    Zeile (Tabellenzelle, Listen-Item) — ohne das wuerde Kopieren zusaetzlich
 *    das Detail oeffnen. Praezedenz: `RowAction.tsx`.
 *  - Fehler schlaegt Erfolg: ein gescheitertes Kopieren zeigt das Warndreieck,
 *    nie das Haekchen — sonst fuegt der Nutzer die ALTE Zwischenablage ein
 *    (die Falle aus v2.301.3).
 *
 * Fuer Hover-Reveal bringt der Aufrufer den Wrapper mit (`opacity-0
 * group-hover/...:opacity-100 focus-within:opacity-100`) — geteilt wird der
 * Knopf, nicht seine Platzierung.
 */
import { AlertTriangle, Check, Copy } from 'lucide-react';
import { useKopierAktion } from '@/core/hooks/useKopierAktion';

interface Props {
  /** Der zu kopierende Text. Funktion, wenn er erst beim Klick feststeht. */
  text: string | (() => string);
  /** `title` im Normalfall (im Fehlerfall ersetzt ihn der Grund). */
  title: string;
  /** Vorlese-Text, wenn er praeziser sein soll als `title` (Default: `title`). */
  ariaLabel?: string;
}

export function KopierIconButton({ text, title, ariaLabel }: Props): React.ReactElement {
  const copy = useKopierAktion(text, title);

  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); copy.run(); }}
      title={copy.titel}
      aria-label={ariaLabel ?? title}
      className="shrink-0 p-1 rounded-[var(--tf-radius)] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-bg-secondary)] cursor-pointer transition-colors"
    >
      {copy.fehler
        ? <AlertTriangle size={14} className="text-[var(--tf-danger-text)]" />
        : copy.kopiert ? <Check size={14} className="text-[var(--tf-primary)]" /> : <Copy size={14} />}
    </button>
  );
}
