/**
 * Gedrosselter Live-Puffer für die Streaming-Vorschau (Antwort + Denkprozess).
 * Token-Deltas landen in Refs und werden nur ~alle 66 ms in den React-State
 * geflusht — sonst löst ein schnelles LLM Hunderte Re-Renders/s aus. Genutzt von
 * `useKurzfassung` + `useGutachtenWorkflow` (eine Quelle, kein Duplikat).
 */
import { useRef, useState } from 'react';

/**
 * Welcher Abschnitt der Lauf-Kette läuft gerade? Die Gutachten-Generierung hängt
 * den sprachlichen Feinschliff automatisch an (`workflow-generierung.ts`) — beide
 * Beine teilen sich EINE Busy-Phase, also muss der Status-Text strukturiert
 * gesetzt werden statt aus `content`/`thinking` geraten zu werden.
 */
export type LaufPhase = 'formulieren' | 'feinschliff';

export interface StreamingBuffer {
  /** Sichtbarer Antwort-Text (inkrementell, gedrosselt). */
  content: string;
  /** Sichtbarer Reasoning-/Thinking-Text (inkrementell, gedrosselt). */
  thinking: string;
  /** Aktuelle Phase der Lauf-Kette (Default `'formulieren'`). */
  phase: LaufPhase;
  onContentDelta: (text: string) => void;
  onThinkingDelta: (text: string) => void;
  setPhase: (phase: LaufPhase) => void;
  /** Vor einem neuen Lauf leeren (verhindert Aufblitzen des Vorlaufs). */
  reset: () => void;
}

const FLUSH_MS = 66;

export function useStreamingBuffer(): StreamingBuffer {
  const [content, setContent] = useState('');
  const [thinking, setThinking] = useState('');
  // Nicht gedrosselt: ein Phasenwechsel ist ein Einzelereignis, kein Token-Strom.
  const [phase, setPhase] = useState<LaufPhase>('formulieren');
  const contentRef = useRef('');
  const thinkingRef = useRef('');
  const scheduled = useRef(false);

  const schedule = (): void => {
    if (scheduled.current) return;
    scheduled.current = true;
    setTimeout(() => {
      scheduled.current = false;
      setContent(contentRef.current);
      setThinking(thinkingRef.current);
    }, FLUSH_MS);
  };

  return {
    content,
    thinking,
    phase,
    onContentDelta: (text) => { contentRef.current += text; schedule(); },
    onThinkingDelta: (text) => { thinkingRef.current += text; schedule(); },
    setPhase,
    reset: () => {
      contentRef.current = '';
      thinkingRef.current = '';
      setContent('');
      setThinking('');
      // Ein `reset` leitet immer einen neuen Lauf ein — der beginnt beim Formulieren.
      setPhase('formulieren');
    },
  };
}
