/**
 * Live-Vorschau während der Generierung („mitlesen, während das LLM arbeitet"):
 * zeigt den inkrementell streamenden Denkprozess + die rohe Antwort, mit
 * Auto-Scroll ans Ende und „Stopp". Ersetzt den reinen Spinner in den Busy-
 * Zuständen. Die rohe Antwort enthält die Skill-Abschnittsmarker (### …) — das
 * ist Absicht (echter Fortschritt); die saubere, geparste Ansicht erscheint nach
 * Abschluss in der Review-Karte.
 */
import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import type { LaufPhase } from './useStreamingBuffer';

interface Props {
  /** Streamender Reasoning-Text (leer, wenn Thinking aus / kein Reasoning). */
  thinking: string;
  /** Streamende rohe Antwort. */
  content: string;
  /**
   * Phase der Lauf-Kette. Die Gutachten-Generierung hängt den Feinschliff
   * automatisch an — ohne diese Angabe sähe der Nutzer bei beiden Beinen
   * denselben Text. Fehlt sie (bzw. `'formulieren'`), gilt die bisherige
   * Ableitung aus `content`/`thinking` unverändert.
   */
  phase?: LaufPhase;
  onStop: () => void;
}

/** Hält einen scrollbaren Container am unteren Rand, während neuer Text einläuft. */
function useAutoScroll(dep: string): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [dep]);
  return ref;
}

const BOX = 'whitespace-pre-wrap overflow-auto rounded-[8px] border-[0.5px] border-[var(--tf-border)] p-3';

export function StreamingVorschau({ thinking, content, phase, onStop }: Props): React.ReactElement {
  const thinkingRef = useAutoScroll(thinking);
  const contentRef = useAutoScroll(content);
  const statusText = phase === 'feinschliff'
    ? 'Sprachlicher Feinschliff…'
    : phase === 'pruefung'
      ? 'Fachliche Prüfung…'
      : content ? 'Generiere Antwort…' : thinking ? 'Denkt nach…' : 'Generiere…';

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center gap-3 text-[13px] text-[var(--tf-text-secondary)]">
        <Loader2 size={14} className="animate-spin" />
        {statusText}
        <button type="button" className="text-[12px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)]" onClick={onStop}>
          Stopp
        </button>
      </div>

      {thinking && (
        <CollapsibleSection label="Denkprozess (läuft…)" defaultOpen={!content}>
          <div ref={thinkingRef} className={`${BOX} max-h-[200px] text-[12.5px] leading-[1.6] text-[var(--tf-text-secondary)]`}>
            {thinking}
          </div>
        </CollapsibleSection>
      )}

      {content && (
        <div ref={contentRef} className={`${BOX} mt-2 max-h-[360px] text-[13px] leading-[1.7] text-[var(--tf-text)]`}>
          {content}
        </div>
      )}
    </div>
  );
}
