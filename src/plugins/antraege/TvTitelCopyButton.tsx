/**
 * Kopier-Icon für Teilvorhaben-Titel — die werden oft in andere Dokumente
 * übernommen. Zwei Einsatzorte: im Sektionskopf „Verbundpartner und
 * Teilvorhaben" für ALLE Titel (eine Zeile je TV) und in der TV-Zeile für den
 * EINEN Titel dieses Teilvorhabens (dort auch der visuell abgeschnittene Teil).
 * `navigator.clipboard` läuft unter `file://` (Secure Context, vgl. Pitfall
 * #6/#7); Async-Aktion über `useAsyncAction` (Pitfall #15). Rendert nichts,
 * wenn kein Titel vorliegt.
 */
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';

interface Props {
  /** Titel-Zeilen (leere bereits ausgefiltert, Reihenfolge = TV-Liste). */
  titel: string[];
  title?: string;
}

export function TvTitelCopyButton({
  titel,
  title = 'Alle Teilvorhaben-Titel kopieren',
}: Props): React.ReactElement | null {
  const [copied, setCopied] = useState(false);
  const copy = useAsyncAction(async () => {
    await navigator.clipboard.writeText(titel.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  });

  if (titel.length === 0) return null;

  // stopPropagation: in der TV-Zeile sitzt der Button INNERHALB der klickbaren
  // Zeile — ohne das würde Kopieren zusätzlich auf-/zuklappen (Präzedenz:
  // components/ui/RowAction.tsx). Im Sektionskopf ist es folgenlos.
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); copy.run(); }}
      title={copy.error ? `Kopieren fehlgeschlagen: ${copy.error}` : title}
      aria-label={title}
      className="shrink-0 p-1 rounded-[var(--tf-radius)] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-bg-secondary)] cursor-pointer transition-colors"
    >
      {copied ? <Check size={14} className="text-[var(--tf-primary)]" /> : <Copy size={14} />}
    </button>
  );
}
