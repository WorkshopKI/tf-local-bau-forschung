import { describe, it, expect } from 'vitest';
import { capVbMarkdown, vbUeberschreitetCap, VB_CHAR_CAP, runSkill, renderSkillPrompt } from '../run-skill';
import { TEMPERATUR_STANDARD, TEMPERATUR_ZWEITFASSUNG } from '@/core/services/ai/sampling';
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

describe('runSkill Chat-Reset (frischer Kontext vor dem Lauf, Pitfall #36)', () => {
  function skill(): SkillRecord {
    return {
      id: 's', name: 's', beschreibung: '', version: 1,
      promptTemplate: 'VB:\n{{vbMarkdown}}',
      modifiers: { neu: '', kuerzer: '', laenger: '' },
      regelIds: [], slots: ['vbMarkdown'], geaendert_am: '2026-01-01T00:00:00.000Z',
    };
  }

  it('resettet den Chat VOR dem Submit und meldet den Reset-Status', async () => {
    const calls: string[] = [];
    const transport = {
      name: 'Streamlit',
      ping: async () => true,
      resetChat: async () => { calls.push('reset'); return 'nicht-gefunden' as const; },
      submitMessage: async () => { calls.push('submit'); return 'Text.'; },
    } as unknown as AITransport;
    const res = await runSkill(transport, skill(), [], { stammdaten: '', vbMarkdown: 'x' });
    expect(calls).toEqual(['reset', 'submit']); // Reset zuerst, dann der Lauf
    expect(res.chatResetStatus).toBe('nicht-gefunden');
  });

  it('Transport ohne resetChat (DirectLLM) → nicht-unterstuetzt, keine Warnung, Lauf ok', async () => {
    const transport = {
      name: 'stub', ping: async () => true, submitMessage: async () => 'Text.',
    } as unknown as AITransport;
    const res = await runSkill(transport, skill(), [], { stammdaten: '', vbMarkdown: 'x' });
    expect(res.chatResetStatus).toBe('nicht-unterstuetzt');
    expect(res.parsed.finalerText).toBe('Text.');
  });
});

describe('runSkill Abschluss-Marker (erwarteAbschluss → submitMessage)', () => {
  function skill(): SkillRecord {
    return {
      id: 's', name: 's', beschreibung: '', version: 1,
      promptTemplate: 'VB:\n{{vbMarkdown}}',
      modifiers: { neu: '', kuerzer: '', laenger: '' },
      regelIds: [], slots: ['vbMarkdown'], geaendert_am: '2026-01-01T00:00:00.000Z',
    };
  }

  /** Streamlit-artiger Transport (nur submitMessage → else-Zweig); fängt die Options. */
  function capturingTransport(): { transport: AITransport; opts: () => unknown } {
    let captured: unknown = 'unset';
    const transport = {
      name: 'Streamlit',
      ping: async () => true,
      submitMessage: async (_m: string, _s?: string, options?: unknown) => { captured = options; return 'Text.'; },
    } as unknown as AITransport;
    return { transport, opts: () => captured };
  }

  it('reicht erwarteAbschluss in die submitMessage-Optionen durch', async () => {
    const { transport, opts } = capturingTransport();
    await runSkill(transport, skill(), [], { stammdaten: '', vbMarkdown: 'x', erwarteAbschluss: 'Finaler Text' });
    expect((opts() as { erwarteAbschluss?: string }).erwarteAbschluss).toBe('Finaler Text');
  });

  it('reicht IMMER einen onReasoning-Rückruf mit (auch ohne weitere Optionen)', async () => {
    // Bis v6.4 stand hier `expect(opts()).toBeUndefined()`: ohne Marker und ohne
    // Signal ging gar kein Options-Objekt raus. Das ist jetzt bewusst anders —
    // `submitMessage` löst auf einen String auf, der Denkprozess passt nur durch
    // diesen Rückruf, und die interne KI liefert ihn unabhängig von unserem
    // Thinking-Schalter. Ohne die feste Übergabe fiel er still auf den Boden.
    const { transport, opts } = capturingTransport();
    await runSkill(transport, skill(), [], { stammdaten: '', vbMarkdown: 'x' });
    expect(typeof (opts() as { onReasoning?: unknown }).onReasoning).toBe('function');
  });

  it('trägt den Denkprozess des Rückrufs ins Ergebnis', async () => {
    // Die eigentliche Zusage: was der Transport meldet, steht hinterher als
    // `thinking` im Ergebnis — die Quelle für `StepRun.denkprozess`.
    const transport = {
      name: 'Streamlit',
      ping: async () => true,
      submitMessage: async (_m: string, _s?: string, options?: unknown) => {
        (options as { onReasoning?: (t: string) => void }).onReasoning?.('So bin ich vorgegangen.');
        return 'Text.';
      },
    } as unknown as AITransport;
    const res = await runSkill(transport, skill(), [], { stammdaten: '', vbMarkdown: 'x' });
    expect(res.thinking).toBe('So bin ich vorgegangen.');
  });
});

/**
 * Bis v2.372 sendete die App gar keine Temperatur — es galt still die
 * Server-Voreinstellung (llama.cpp: 1.0 bei zufälligem Seed), während die
 * Node-Eval auf 0 maß. Der Runner setzt sie jetzt IMMER.
 */
describe('runSkill Temperatur', () => {
  function skill(): SkillRecord {
    return {
      id: 's', name: 's', beschreibung: '', version: 1,
      promptTemplate: 'VB:\n{{vbMarkdown}}',
      modifiers: { neu: '', kuerzer: '', laenger: '' },
      regelIds: [], slots: ['vbMarkdown'], geaendert_am: '2026-01-01T00:00:00.000Z',
    };
  }

  /** API-Transport (submitConversation-Zweig); fängt die Options des Inhalts-Calls. */
  function apiTransport(): { transport: AITransport; opts: () => { temperatur?: number } } {
    let captured: { temperatur?: number } = {};
    const transport: AITransport = {
      name: 'stub',
      ping: async () => true,
      submitMessage: async () => 'Text.',
      submitConversation: async (_m, options) => { captured = options ?? {}; return 'Text.'; },
    };
    return { transport, opts: () => captured };
  }

  it('sendet ohne Angabe den Standard', async () => {
    const { transport, opts } = apiTransport();
    await runSkill(transport, skill(), [], { stammdaten: '', vbMarkdown: 'x' });
    expect(opts().temperatur).toBe(TEMPERATUR_STANDARD);
  });

  it('übernimmt eine erzwungene Temperatur (Zweitfassung)', async () => {
    const { transport, opts } = apiTransport();
    await runSkill(transport, skill(), [], { stammdaten: '', vbMarkdown: 'x', temperatur: TEMPERATUR_ZWEITFASSUNG });
    expect(opts().temperatur).toBe(TEMPERATUR_ZWEITFASSUNG);
  });

  it('meldet sie auch in der Prompt-Vorschau — sonst wäre sie wieder unsichtbar', () => {
    expect(renderSkillPrompt(skill(), [], { stammdaten: '', vbMarkdown: 'x' }).temperatur)
      .toBe(TEMPERATUR_STANDARD);
    expect(renderSkillPrompt(skill(), [], { stammdaten: '', vbMarkdown: 'x', temperatur: 0.9 }).temperatur)
      .toBe(0.9);
  });
});
