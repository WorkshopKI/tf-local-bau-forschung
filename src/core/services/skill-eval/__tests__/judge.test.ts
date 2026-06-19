import { describe, it, expect } from 'vitest';
import { buildJudgePrompt, parseJudgeResult, runJudge, JUDGE_SYSTEM_PROMPT } from '../judge';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { QualitaetsRegel } from '@/core/services/skills';

const TS = '2026-01-01T00:00:00.000Z';
const regeln: QualitaetsRegel[] = [
  {
    id: 'r1', name: 'Max 800 Zeichen', typ: 'zeichen_max', params: { max: 800 },
    schweregrad: 'fehler', aktiv: true, erstellt_am: TS, geaendert_am: TS,
  },
];

describe('buildJudgePrompt', () => {
  it('enthält VB, zu bewertenden Text, Regelhinweis und die Subscore-Felder', () => {
    const prompt = buildJudgePrompt(
      'Die Vorhabensbeschreibung XYZ.',
      'Der finale Abschnittstext ABC.',
      regeln,
      'Erzeuge die Kurzfassung.',
    );
    expect(prompt).toContain('Die Vorhabensbeschreibung XYZ.');
    expect(prompt).toContain('Der finale Abschnittstext ABC.');
    expect(prompt).toContain('Erzeuge die Kurzfassung.');
    // Regelhinweis aus buildPromptVorgaben:
    expect(prompt).toContain('800');
    // Alle vier Subscore-Dimensionen werden angefordert:
    expect(prompt).toContain('fachliche_korrektheit');
    expect(prompt).toContain('vollstaendigkeit');
    expect(prompt).toContain('sprachqualitaet');
    expect(prompt).toContain('regeltreue');
    expect(prompt).toContain('prompt_verbesserung');
  });

  it('System-Prompt fordert reines JSON', () => {
    expect(JUDGE_SYSTEM_PROMPT).toMatch(/JSON/);
  });
});

describe('parseJudgeResult', () => {
  it('sauberes JSON → alle Subscores + Texte', () => {
    const r = parseJudgeResult(JSON.stringify({
      fachliche_korrektheit: 4,
      vollstaendigkeit: 5,
      sprachqualitaet: 3,
      regeltreue: 2,
      begruendung: 'solide',
      prompt_verbesserung: 'mehr Marktbezug',
    }));
    expect(r.fehler).toBeUndefined();
    expect(r.fachliche_korrektheit).toBe(4);
    expect(r.vollstaendigkeit).toBe(5);
    expect(r.sprachqualitaet).toBe(3);
    expect(r.regeltreue).toBe(2);
    expect(r.begruendung).toBe('solide');
    expect(r.prompt_verbesserung).toBe('mehr Marktbezug');
  });

  it('```json-Fences werden gestrippt', () => {
    const raw = '```json\n{ "fachliche_korrektheit": 5, "vollstaendigkeit": 5, "sprachqualitaet": 5, "regeltreue": 5 }\n```';
    const r = parseJudgeResult(raw);
    expect(r.fehler).toBeUndefined();
    expect(r.fachliche_korrektheit).toBe(5);
    expect(r.begruendung).toBeNull();
  });

  it('JSON in Prosa eingebettet → äußerstes {…} wird extrahiert', () => {
    const raw = 'Hier mein Urteil:\n{ "fachliche_korrektheit": 3 }\nDanke.';
    const r = parseJudgeResult(raw);
    expect(r.fehler).toBeUndefined();
    expect(r.fachliche_korrektheit).toBe(3);
    expect(r.vollstaendigkeit).toBeNull();
  });

  it('fehlende Subscores → null (kein Throw)', () => {
    const r = parseJudgeResult('{ "begruendung": "nur Text" }');
    expect(r.fehler).toBeUndefined();
    expect(r.fachliche_korrektheit).toBeNull();
    expect(r.begruendung).toBe('nur Text');
  });

  it('Subscores werden auf 1–5 geklemmt', () => {
    const r = parseJudgeResult('{ "fachliche_korrektheit": 9, "vollstaendigkeit": 0 }');
    expect(r.fachliche_korrektheit).toBe(5);
    expect(r.vollstaendigkeit).toBe(1);
  });

  it('Müll-Ausgabe → fehler:true, kein Throw', () => {
    const r = parseJudgeResult('das ist überhaupt kein JSON');
    expect(r.fehler).toBe(true);
    expect(r.fachliche_korrektheit).toBeNull();
  });

  it('leerer String → fehler:true', () => {
    expect(parseJudgeResult('').fehler).toBe(true);
  });
});

describe('runJudge', () => {
  it('reicht die Transport-Antwort durch den tolerant-Parser', async () => {
    const transport: AITransport = {
      name: 'judge-stub',
      ping: async () => true,
      submitMessage: async () => '{ "fachliche_korrektheit": 4, "vollstaendigkeit": 4, "sprachqualitaet": 4, "regeltreue": 4 }',
    };
    const r = await runJudge(transport, {
      vb: 'vb', finalerText: 'text', regeln, skillBeschreibung: 'desc',
    });
    expect(r.fehler).toBeUndefined();
    expect(r.regeltreue).toBe(4);
  });

  it('Transport-Fehler → fehler:true (kein Throw)', async () => {
    const transport: AITransport = {
      name: 'judge-stub',
      ping: async () => true,
      submitMessage: async () => { throw new Error('judge endpoint down'); },
    };
    const r = await runJudge(transport, { vb: 'vb', finalerText: 'text', regeln, skillBeschreibung: 'desc' });
    expect(r.fehler).toBe(true);
    expect(r.begruendung).toContain('judge endpoint down');
  });
});
