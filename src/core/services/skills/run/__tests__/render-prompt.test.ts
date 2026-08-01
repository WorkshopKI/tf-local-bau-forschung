/**
 * Die Prompt-Ansicht ist nur so viel wert wie ihre Deckungsgleichheit mit dem
 * echten Lauf. Diese Suite hält beide gegeneinander: `renderSkillPrompt` (was die
 * Ansicht zeigt) gegen das, was der Transport tatsächlich zu sehen bekommt.
 *
 * Sie ersetzt kein Auge auf dem Prompt-Text — sie verhindert nur die eine
 * Fehlerart, die man am Bildschirm NICHT sieht: eine Vorschau, die etwas anderes
 * behauptet als der Lauf tut.
 */
import { describe, it, expect } from 'vitest';
import { renderSkillPrompt, runSkill } from '../run-skill';
import type { AITransport, ConversationMessage } from '@/core/services/ai/transports/streamlit';
import type { SkillRecord } from '@/core/services/skills';

function skill(over: Partial<SkillRecord> = {}): SkillRecord {
  return {
    id: 's', name: 's', beschreibung: '', version: 1,
    promptTemplate: 'Stamm:\n{{stammdaten}}\n\nVB:\n{{vbMarkdown}}',
    systemPrompt: 'SYSTEM',
    modifiers: { neu: 'NEU', kuerzer: 'K', laenger: 'L' },
    regelIds: [], slots: ['stammdaten', 'vbMarkdown'],
    geaendert_am: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

/** Transport, der die empfangenen Messages festhält. */
function spyTransport(reply: string): { transport: AITransport; letzte: () => ConversationMessage[] } {
  let letzte: ConversationMessage[] = [];
  return {
    transport: {
      name: 'stub',
      ping: async () => true,
      submitMessage: async () => reply,
      submitConversation: async (messages) => { letzte = messages; return reply; },
    },
    letzte: () => letzte,
  };
}

const input = { stammdaten: 'STAMM', vbMarkdown: 'VB-TEXT' };

describe('renderSkillPrompt', () => {
  it('liefert GENAU das, was runSkill an den Transport gibt', async () => {
    const s = skill();
    const { transport, letzte } = spyTransport('### Finaler Text\nOK');
    await runSkill(transport, s, [], input);

    const gerendert = renderSkillPrompt(s, [], input);
    const msgs = letzte();
    expect(msgs.find(m => m.role === 'system')?.content).toBe(gerendert.system);
    expect(msgs.find(m => m.role === 'user')?.content).toBe(gerendert.user);
  });

  it('gibt dasselbe auch als `gesendet` am Ergebnis zurück (Quelle der Ansicht)', async () => {
    const s = skill();
    const { transport } = spyTransport('### Finaler Text\nOK');
    const res = await runSkill(transport, s, [], input);
    const gerendert = renderSkillPrompt(s, [], input);
    expect(res.gesendet).toEqual({
      system: gerendert.system,
      user: gerendert.user,
      vb: gerendert.vb,
      vbGekuerzt: gerendert.vbGekuerzt,
    });
  });

  it('meldet die Kürzung der VB und gibt den gekürzten Text als `vb` zurück', () => {
    const lang = 'A'.repeat(500);
    const gerendert = renderSkillPrompt(skill(), [], { stammdaten: '', vbMarkdown: lang, vbCharCap: 100 });
    expect(gerendert.vbGekuerzt).toBe(true);
    expect(gerendert.vb.length).toBeLessThan(lang.length);
    // Der zurückgegebene VB-Text steht so auch im Prompt — sonst könnte die Ansicht
    // ihn nicht abtrennen und einklappen.
    expect(gerendert.user).toContain(gerendert.vb);
  });

  it('schlägt beim Thinking-Budget den Reasoning-Headroom auf das Ausgabe-Budget', () => {
    const s = skill({ maxTokens: 2048 });
    expect(renderSkillPrompt(s, [], input).maxTokens).toBe(2048);
    expect(renderSkillPrompt(s, [], { ...input, thinkingBudget: 'medium' }).maxTokens).toBeGreaterThan(2048);
  });
});
