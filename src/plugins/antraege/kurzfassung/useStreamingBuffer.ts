/**
 * Gedrosselter Live-Puffer für die Streaming-Vorschau (Antwort + Denkprozess).
 * Token-Deltas landen in Refs und werden nur ~alle 66 ms in den React-State
 * geflusht — sonst löst ein schnelles LLM Hunderte Re-Renders/s aus. Genutzt von
 * `useKurzfassung` + `useGutachtenWorkflow` (eine Quelle, kein Duplikat).
 */
import { useRef, useState } from 'react';

export interface StreamingBuffer {
  /** Sichtbarer Antwort-Text (inkrementell, gedrosselt). */
  content: string;
  /** Sichtbarer Reasoning-/Thinking-Text (inkrementell, gedrosselt). */
  thinking: string;
  onContentDelta: (text: string) => void;
  onThinkingDelta: (text: string) => void;
  /** Vor einem neuen Lauf leeren (verhindert Aufblitzen des Vorlaufs). */
  reset: () => void;
}

const FLUSH_MS = 66;

export function useStreamingBuffer(): StreamingBuffer {
  const [content, setContent] = useState('');
  const [thinking, setThinking] = useState('');
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
    onContentDelta: (text) => { contentRef.current += text; schedule(); },
    onThinkingDelta: (text) => { thinkingRef.current += text; schedule(); },
    reset: () => {
      contentRef.current = '';
      thinkingRef.current = '';
      setContent('');
      setThinking('');
    },
  };
}
