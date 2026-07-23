/**
 * Kopier-Icon für Teilvorhaben-Titel — die werden oft in andere Dokumente
 * übernommen. Zwei Einsatzorte: im Sektionskopf „Verbundpartner und
 * Teilvorhaben" für ALLE Titel (eine Zeile je TV) und in der TV-Zeile für den
 * EINEN Titel dieses Teilvorhabens (dort auch der visuell abgeschnittene Teil).
 * Kopier-Zustand über `useKopierAktion` (Pitfall #15 + sichtbarer Fehlschlag).
 * Rendert nichts, wenn kein Titel vorliegt.
 */
import { AlertTriangle, Check, Copy } from 'lucide-react';
import { useKopierAktion } from '@/core/hooks/useKopierAktion';

interface Props {
  /** Titel-Zeilen (leere bereits ausgefiltert, Reihenfolge = TV-Liste). */
  titel: string[];
  title?: string;
}

export function TvTitelCopyButton({
  titel,
  title = 'Alle Teilvorhaben-Titel kopieren',
}: Props): React.ReactElement | null {
  const copy = useKopierAktion(() => titel.join('\n'), title);

  if (titel.length === 0) return null;

  // stopPropagation: in der TV-Zeile sitzt der Button INNERHALB der klickbaren
  // Zeile — ohne das würde Kopieren zusätzlich auf-/zuklappen (Präzedenz:
  // components/ui/RowAction.tsx). Im Sektionskopf ist es folgenlos.
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); copy.run(); }}
      title={copy.titel}
      aria-label={title}
      className="shrink-0 p-1 rounded-[var(--tf-radius)] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-bg-secondary)] cursor-pointer transition-colors"
    >
      {/* Fehler schlägt Erfolg: ein leises `title` allein hätte ein gescheitertes
          Kopieren wie ein erfolgreiches aussehen lassen (der Nutzer fügt dann die
          ALTE Zwischenablage ein — genau die Falle aus v2.301.3). */}
      {copy.fehler
        ? <AlertTriangle size={14} className="text-[var(--tf-danger-text)]" />
        : copy.kopiert ? <Check size={14} className="text-[var(--tf-primary)]" /> : <Copy size={14} />}
    </button>
  );
}
