import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface ThinkingBlockProps {
  thinking: string;
  /** true solange noch kein Antwort-Content da ist — Block bleibt auto-offen,
   *  kollabiert mit dem ersten Content-Delta. Manuelles Toggle übersteuert. */
  autoOpen: boolean;
}

/** Einklappbarer „Denkprozess"-Block über der Antwort (Reasoning-Modelle). */
export function ThinkingBlock({ thinking, autoOpen }: ThinkingBlockProps): React.ReactElement {
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? autoOpen;

  return (
    <div className="mb-2">
      <button
        onClick={() => setManual(!open)}
        className="inline-flex items-center gap-1 text-[11.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)] cursor-pointer"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Denkprozess
      </button>
      {open && (
        <div
          className="mt-1 pl-3 text-[12.5px] leading-relaxed text-[var(--tf-text-secondary)] whitespace-pre-wrap"
          style={{ borderLeft: '2px solid var(--tf-border)' }}
        >
          {thinking}
        </div>
      )}
    </div>
  );
}
