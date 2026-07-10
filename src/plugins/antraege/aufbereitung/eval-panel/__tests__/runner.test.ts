import { describe, it, expect } from 'vitest';
import { runAufbereitungEval, type EvalFixtureQuelle } from '../runner';
import type { Goldset } from '@/core/services/skill-eval/aspekte-metrik';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import { AUFBEREITUNG_ASPEKTE_SKILL } from '@/core/services/skills/registry/aufbereitung-aspekte.seed';
import { AUFBEREITUNG_STECKBRIEF_SKILL } from '@/core/services/skills/registry/aufbereitung-steckbrief.seed';

// Zwei minimale, unterscheidbare VBs (parseVbGliederung → Sektionen k-1 + k-7).
const VB1 = '# 1 Ausgangssituation\n\nInhalt A eins.\n\n# 7 Realisierbarkeit\n\nInhalt F eins.\n';
const VB2 = '# 1 Ausgangssituation\n\nAnderer Inhalt zwei.\n\n# 7 Realisierbarkeit\n\nAnderer Inhalt zwei.\n';

const FIXTURES: EvalFixtureQuelle[] = [
  { vbFile: 'FIX1', vbMarkdown: VB1 },
  { vbFile: 'FIX2', vbMarkdown: VB2 },
];
const GOLDSET: Goldset = {
  fixtures: [
    { vbFile: 'FIX1', erwartung: { 'k-1': ['A'], 'k-7': ['F'] } },
    { vbFile: 'FIX2', erwartung: { 'k-1': ['A'], 'k-7': ['F'] } },
  ],
};

const STECKBRIEF_OK = '```json\n{ "einSatz": { "text": "Ein Satz.", "sektionIds": ["k-1"] } }\n```';

/**
 * Stub-Transport: routet nach Prompt-Inhalt (Aspekte-Prompt trägt „Prüfaspekte",
 * Steckbrief-Prompt „Steckbrief"; Fixture 2 trägt „Anderer Inhalt"). `submitConversation`
 * genügt — `runBaustein` bevorzugt es.
 */
function stub(opts: { aspekteAntwort?: string; failAspekteFuerFix2?: boolean } = {}): AITransport {
  const aspekteAntwort = opts.aspekteAntwort ?? 'A: k-1\nF: k-7';
  return {
    name: 'Stub',
    displayName: 'Stub-Transport',
    submitConversation: async (messages: Array<{ role: string; content: string }>) => {
      const prompt = messages[messages.length - 1]!.content;
      const istAspekte = prompt.includes('Prüfaspekte');
      const fuerFix2 = prompt.includes('Anderer Inhalt');
      if (istAspekte && opts.failAspekteFuerFix2 && fuerFix2) throw new Error('Bridge kaputt');
      return istAspekte ? aspekteAntwort : STECKBRIEF_OK;
    },
  } as unknown as AITransport;
}

const deps = (transport: AITransport) => ({
  aspekteSkill: AUFBEREITUNG_ASPEKTE_SKILL,
  steckbriefSkill: AUFBEREITUNG_STECKBRIEF_SKILL,
  transport,
  fixtures: FIXTURES,
  goldset: GOLDSET,
});

describe('runAufbereitungEval', () => {
  it('happy path: Aspekte P=R=F1=1, Steckbrief-Smoke ok', async () => {
    const erg = await runAufbereitungEval(deps(stub()));
    expect(erg.abgebrochen).toBe(false);
    expect(erg.fixtures).toHaveLength(2);
    for (const f of erg.fixtures) {
      expect(f.gefunden).toBe(true);
      expect(f.aspekte?.status).toBe('ok');
      expect(f.aspekte?.metrik?.f1).toBe(1);
      expect(f.steckbrief?.status).toBe('ok');
      expect(f.steckbrief?.gefuellteFelder).toBe(1);
    }
    expect(erg.zusammenfassung.mikroF1).toBe(1);
    expect(erg.zusammenfassung.fixtures).toBe(2);
  });

  it('Parse-Degradation: leere Aspekte-Antwort → degradiert, nicht in der Metrik', async () => {
    const erg = await runAufbereitungEval(deps(stub({ aspekteAntwort: '' })));
    expect(erg.fixtures[0]?.aspekte?.status).toBe('degradiert');
    expect(erg.fixtures[0]?.aspekte?.rohtext).toBe('');
    expect(erg.zusammenfassung.fixtures).toBe(0); // kein ok-Lauf floss ins Aggregat
  });

  it('Transport-Fehler mitten im Lauf bricht den Gesamtlauf NICHT ab', async () => {
    const erg = await runAufbereitungEval(deps(stub({ failAspekteFuerFix2: true })));
    expect(erg.abgebrochen).toBe(false);
    expect(erg.fixtures).toHaveLength(2);
    expect(erg.fixtures[0]?.aspekte?.status).toBe('ok');
    expect(erg.fixtures[1]?.aspekte?.status).toBe('fehler');
    expect(erg.fixtures[1]?.aspekte?.fehler).toContain('Bridge kaputt');
    expect(erg.zusammenfassung.fixtures).toBe(1); // nur FIX1 gemessen
  });

  it('limit begrenzt die Fixture-Anzahl', async () => {
    const erg = await runAufbereitungEval(deps(stub()), { limit: 1 });
    expect(erg.fixtures).toHaveLength(1);
    expect(erg.abgebrochen).toBe(false);
  });

  it('includeSteckbrief=false überspringt den Smoke-Test', async () => {
    const erg = await runAufbereitungEval(deps(stub()), { includeSteckbrief: false });
    expect(erg.fixtures[0]?.steckbrief).toBeUndefined();
    expect(erg.fixtures[0]?.aspekte?.status).toBe('ok');
  });

  it('Abbruch zwischen Läufen wirkt (nur FIX1 verarbeitet)', async () => {
    const ctrl = new AbortController();
    const erg = await runAufbereitungEval(deps(stub()), {
      signal: ctrl.signal,
      onFixtureDone: (_e, i) => { if (i === 0) ctrl.abort(); },
    });
    expect(erg.abgebrochen).toBe(true);
    expect(erg.fixtures).toHaveLength(1);
    expect(erg.fixtures[0]?.vbFile).toBe('FIX1');
  });

  it('resettet den Chat vor jedem Baustein-Submit und markiert den Reset-Status', async () => {
    const calls: string[] = [];
    const transport = {
      name: 'Stub',
      resetChat: async () => { calls.push('reset'); return 'nicht-gefunden' as const; },
      submitConversation: async (messages: Array<{ role: string; content: string }>) => {
        calls.push('submit');
        return messages[messages.length - 1]!.content.includes('Prüfaspekte') ? 'A: k-1\nF: k-7' : STECKBRIEF_OK;
      },
    } as unknown as AITransport;
    const erg = await runAufbereitungEval(deps(transport), { limit: 1 });
    // 1 Fixture = Aspekte + Steckbrief = 2 Bausteine → je Baustein Reset VOR Submit.
    expect(calls).toEqual(['reset', 'submit', 'reset', 'submit']);
    expect(erg.fixtures[0]?.aspekte?.chatResetStatus).toBe('nicht-gefunden');
    expect(erg.fixtures[0]?.steckbrief?.chatResetStatus).toBe('nicht-gefunden');
  });

  it('fehlendes Fixture → übersprungen (gefunden:false), kein Abbruch', async () => {
    const goldsetMitLuecke: Goldset = {
      fixtures: [{ vbFile: 'GIBTS_NICHT', erwartung: { 'k-1': ['A'] } }, ...GOLDSET.fixtures],
    };
    const erg = await runAufbereitungEval({ ...deps(stub()), goldset: goldsetMitLuecke });
    expect(erg.fixtures[0]?.gefunden).toBe(false);
    expect(erg.abgebrochen).toBe(false);
    expect(erg.fixtures).toHaveLength(3);
  });
});
