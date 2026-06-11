import { useState } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';

interface ThinkingBlockProps {
  thinking: string;
  /** Auto-offen solange noch keine Antwort da ist; manuelles Toggle übersteuert. */
  autoOpen: boolean;
  /** Reasoning streamt noch → Spinner statt Chevron. */
  streaming: boolean;
}

/** Einklappbarer „Denkprozess" über der Antwort (Reasoning-Modelle). */
export function ThinkingBlock({ thinking, autoOpen, streaming }: ThinkingBlockProps): React.ReactElement {
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? autoOpen;

  return (
    <div className="reasoning">
      <button className="reasoning-toggle" aria-expanded={open} onClick={() => setManual(!open)}>
        {streaming ? <Loader2 size={13} className="spin" /> : <ChevronRight size={14} className="chev" />}
        Denkprozess
      </button>
      {open && <div className="reasoning-body">{thinking}</div>}
    </div>
  );
}
