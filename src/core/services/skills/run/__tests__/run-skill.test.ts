import { describe, it, expect } from 'vitest';
import { capVbMarkdown, vbUeberschreitetCap, VB_CHAR_CAP, runSkill } from '../run-skill';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { SkillRecord } from '@/core/services/skills';

describe('capVbMarkdown', () => {
  it('lässt VB unter dem Cap unverändert (gekuerzt:false)', () => {
    const md = 'Kurzer Text.';
    expect(capVbMarkdown(md, 1000)).toEqual({ text: md, gekuerzt: false });
  });

  it('kürzt über dem Cap und markiert gekuerzt:true mit …-Suffix', () => {
    const md = 'x'.repeat(500);
    const res = capVbMarkdown(md, 100);
    expect(res.gekuerzt).toBe(true);
    expect(res.text.endsWith('…')).toBe(true);
    expect(res.text.length).toBeLessThan(md.length);
  });

  it('schneidet am letzten Absatzumbruch vor dem Cap', () => {
    // Absatzgrenze bei 80 (> cap*0.5), Cap 100 → Schnitt bei 80, Rest verworfen.
    const md = 'A'.repeat(78) + '\n\n' + 'B'.repeat(200);
    const res = capVbMarkdown(md, 100);
    expect(res.gekuerzt).toBe(true);
    expect(res.text).toBe('A'.repeat(78) + '\n\n…');
  });

  it('nutzt VB_CHAR_CAP als Default-Cap', () => {
    expect(capVbMarkdown('kurz').gekuerzt).toBe(false);
    expect(capVbMarkdown('y'.repeat(VB_CHAR_CAP + 1)).gekuerzt).toBe(true);
  });
});

describe('vbUeberschreitetCap', () => {
  it('vergleicht die Markdown-Länge gegen den Cap', () => {
    expect(vbUeberschreitetCap('abc', 3)).toBe(false); // ==, nicht >
    expect(vbUeberschreitetCap('abcd', 3)).toBe(true);
  });
});

describe('runSkill Lektor-Zweitpass', () => {
  const input = { stammdaten: '', vbMarkdown: 'x' };

  function makeSkill(): SkillRecord {
    return {
      id: 's', name: 's', beschreibung: '', version: 1,
      promptTemplate: 'VB:\n{{vbMarkdown}}',
      modifiers: { neu: '', kuerzer: '', laenger: '' },
      regelIds: [], slots: ['vbMarkdown'], geaendert_am: '2026-01-01T00:00:00.000Z',
      lektorPromptTemplate: 'Lektoriere:\n{{entwurf}}',
    };
  }

  /** Stub-Transport, der je Aufruf den nächsten Reply liefert und die Aufrufe zählt. */
  function countingTransport(replies: string[]): { transport: AITransport; calls: () => number } {
    let i = 0;
    const transport: AITransport = {
      name: 'stub',
      ping: async () => true,
      submitMessage: async () => replies[i++] ?? '',
      submitConversation: async () => replies[i++] ?? '',
    };
    return { transport, calls: () => i };
  }

  it('überspringt den Lektor bei leerem Entwurf (Empty-Completion → kein 2. Call)', async () => {
    const { transport, calls } = countingTransport(['', 'LEKTOR']);
    const res = await runSkill(transport, makeSkill(), [], input);
    expect(calls()).toBe(1); // nur Inhalts-Call
    expect(res.parsed.finalerText).toBe('');
    expect(res.entwurfVorLektor).toBeUndefined();
  });

  it('führt den Lektor bei nicht-leerem Entwurf aus (finalerText = Lektor-Ergebnis)', async () => {
    const { transport, calls } = countingTransport(['Echt.', 'Lektoriert.']);
    const res = await runSkill(transport, makeSkill(), [], input);
    expect(calls()).toBe(2); // Inhalts- + Lektor-Call
    expect(res.parsed.finalerText).toBe('Lektoriert.');
    expect(res.entwurfVorLektor).toBe('Echt.');
  });
});

describe('runSkill Streaming-Gate (Thinking erzwingt KEIN Streaming)', () => {
  function plainSkill(): SkillRecord {
    return {
      id: 's', name: 's', beschreibung: '', version: 1,
      promptTemplate: 'VB:\n{{vbMarkdown}}',
      modifiers: { neu: '', kuerzer: '', laenger: '' },
      regelIds: [], slots: ['vbMarkdown'], geaendert_am: '2026-01-01T00:00:00.000Z',
    };
  }

  /** Transport, der BEIDE Pfade beherrscht und protokolliert, welcher lief. */
  function dualTransport(): { transport: AITransport; calls: { conv: number; stream: number } } {
    const calls = { conv: 0, stream: 0 };
    const transport: AITransport = {
      name: 'dual',
      ping: async () => true,
      submitMessage: async () => 'MSG',
      submitConversation: async () => { calls.conv++; return 'KONVERSATION'; },
      streamConversation: async (_messages, callbacks) => {
        calls.stream++;
        callbacks.onDelta('STREAM');
        return { content: 'STREAM', aborted: false };
      },
    };
    return { transport, calls };
  }

  // Kern-Regression: thinkingBudget !== 'none' OHNE Delta-Consumer darf NICHT mehr
  // streamen (sonst hängt der DirectLLM/llama.cpp-Stream-Loop ohne Timeout). Es
  // muss der robuste non-streaming-Pfad (submitConversation → res.json()) laufen.
  it('thinkingBudget ohne Delta-Consumer → non-streaming (submitConversation)', async () => {
    const { transport, calls } = dualTransport();
    const res = await runSkill(transport, plainSkill(), [], {
      stammdaten: '', vbMarkdown: 'x', thinkingBudget: 'medium',
    });
    expect(calls.conv).toBe(1);
    expect(calls.stream).toBe(0);
    expect(res.parsed.finalerText).toBe('KONVERSATION');
  });

  it('mit onContentDelta → streaming (streamConversation, Live-Vorschau)', async () => {
    const { transport, calls } = dualTransport();
    const deltas: string[] = [];
    const res = await runSkill(transport, plainSkill(), [], {
      stammdaten: '', vbMarkdown: 'x', thinkingBudget: 'medium',
      onContentDelta: (t) => deltas.push(t),
    });
    expect(calls.stream).toBe(1);
    expect(calls.conv).toBe(0);
    expect(deltas).toEqual(['STREAM']);
    expect(res.parsed.finalerText).toBe('STREAM');
  });
});
