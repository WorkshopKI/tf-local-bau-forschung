import { describe, expect, it } from 'vitest';
import { createThinkTagSplitter, extractThinking } from '../thinking-parser';

function makeSplitter(): {
  pushContent: (s: string) => void;
  flush: () => void;
  content: () => string;
  thinking: () => string;
} {
  const contentParts: string[] = [];
  const thinkingParts: string[] = [];
  const splitter = createThinkTagSplitter(
    s => contentParts.push(s),
    s => thinkingParts.push(s),
  );
  return {
    pushContent: splitter.pushContent,
    flush: splitter.flush,
    content: () => contentParts.join(''),
    thinking: () => thinkingParts.join(''),
  };
}

describe('createThinkTagSplitter', () => {
  it('reicht Text ohne Tags unverändert als Content durch', () => {
    const s = makeSplitter();
    s.pushContent('Hallo ');
    s.pushContent('Welt');
    s.flush();
    expect(s.content()).toBe('Hallo Welt');
    expect(s.thinking()).toBe('');
  });

  it('trennt <think>-Block von Content', () => {
    const s = makeSplitter();
    s.pushContent('<think>überlege…</think>Antwort');
    s.flush();
    expect(s.thinking()).toBe('überlege…');
    expect(s.content()).toBe('Antwort');
  });

  it('verkraftet Tags, die über mehrere Deltas verteilt sind', () => {
    const s = makeSplitter();
    s.pushContent('<thi');
    s.pushContent('nk>in');
    s.pushContent('nen</th');
    s.pushContent('ink>außen');
    s.flush();
    expect(s.thinking()).toBe('innen');
    expect(s.content()).toBe('außen');
  });

  it('hält < am Delta-Ende zurück und gibt es frei, wenn kein Tag folgt', () => {
    const s = makeSplitter();
    s.pushContent('a <');
    s.pushContent('b> c');
    s.flush();
    expect(s.content()).toBe('a <b> c');
    expect(s.thinking()).toBe('');
  });

  it('Abbruch mitten im Think-Block: Rest bleibt Thinking (flush)', () => {
    const s = makeSplitter();
    s.pushContent('<think>halb fertig');
    s.flush();
    expect(s.thinking()).toBe('halb fertig');
    expect(s.content()).toBe('');
  });

  it('Text vor dem Think-Block bleibt Content', () => {
    const s = makeSplitter();
    s.pushContent('Hi <think>x</think>Ende');
    s.flush();
    expect(s.content()).toBe('Hi Ende');
    expect(s.thinking()).toBe('x');
  });

  it('mehrere Think-Blöcke werden alle erkannt', () => {
    const s = makeSplitter();
    s.pushContent('<think>eins</think>A<think>zwei</think>B');
    s.flush();
    expect(s.thinking()).toBe('einszwei');
    expect(s.content()).toBe('AB');
  });

  it('flush gibt zurückgehaltenen Tag-Präfix als Content frei', () => {
    const s = makeSplitter();
    s.pushContent('Ende <thi');
    s.flush();
    expect(s.content()).toBe('Ende <thi');
  });
});

describe('extractThinking', () => {
  it('ohne Tags: content unverändert, thinking undefined', () => {
    expect(extractThinking('nur Antwort')).toEqual({ content: 'nur Antwort' });
  });

  it('trennt führenden <think>-Block ab', () => {
    expect(extractThinking('<think>Plan</think>\nAntwort')).toEqual({
      content: 'Antwort',
      thinking: 'Plan',
    });
  });

  it('unterminierter <think>-Block: alles dahinter ist Thinking', () => {
    expect(extractThinking('<think>nie fertig')).toEqual({
      content: '',
      thinking: 'nie fertig',
    });
  });

  it('trimmt Whitespace an den Schnittkanten', () => {
    const r = extractThinking('<think> a </think>  b ');
    expect(r.thinking).toBe('a');
    expect(r.content).toBe('b');
  });
});
