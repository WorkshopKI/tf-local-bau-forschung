import { describe, it, expect } from 'vitest';
import { runOneSection } from '../eval-run';
import { resolveRegistry, getWorkflowSections } from '../registry-load';
import type { Fixture } from '../types';
import type { AITransport, ConversationMessage } from '@/core/services/ai/transports/streamlit';
import type { SkillRegistryFile, SkillRecord, QualitaetsRegel } from '@/core/services/skills';

const TS = '2026-01-01T00:00:00.000Z';

function makeFixture(): Fixture {
  return {
    vbFile: 'demo-ep.md',
    antragstyp: 'EP',
    context: {
      key: '16EP123456',
      akronym: 'TESTAKRO',
      titel: 'Test-Vorhaben',
      antragsteller: 'Test GmbH',
      foerderkennzeichen: '16EP123456',
      knownIds: ['16EP123456'],
      teilvorhaben: [],
    },
    vbMarkdown: '# Vorhaben\n\nWir entwickeln etwas Neues.',
  };
}

/** Minimal-Registry mit dem Abschnitt-A-Skill + einer zeichen_max-Regel. */
function makeRegistry(opts?: { withSkill?: boolean; max?: number }): SkillRegistryFile {
  const skill: SkillRecord = {
    id: 'gutachten-kurzfassung',
    name: 'Kurzfassung',
    beschreibung: 'Test',
    version: 1,
    promptTemplate: 'Stammdaten:\n{{stammdaten}}\n\nVB:\n{{vbMarkdown}}',
    modifiers: { neu: '', kuerzer: '', laenger: '' },
    regelIds: ['r-max'],
    slots: ['stammdaten', 'vbMarkdown'],
    geaendert_am: TS,
  };
  const regel: QualitaetsRegel = {
    id: 'r-max',
    name: 'Zeichen-Limit',
    typ: 'zeichen_max',
    params: { max: opts?.max ?? 10 },
    schweregrad: 'fehler',
    aktiv: true,
    erstellt_am: TS,
    geaendert_am: TS,
  };
  return { version: 1, updated_at: TS, skills: (opts?.withSkill ?? true) ? [skill] : [], regeln: [regel] };
}

/** Stub-Transport mit fester Antwort, der die gesendeten Messages mitschneidet. */
function captureStub(reply: string): { transport: AITransport; calls: ConversationMessage[][] } {
  const calls: ConversationMessage[][] = [];
  const transport: AITransport = {
    name: 'stub',
    ping: async () => true,
    submitMessage: async () => reply,
    submitConversation: async (messages) => {
      calls.push(messages);
      return reply;
    },
  };
  return { transport, calls };
}

function throwingStub(msg: string): AITransport {
  return {
    name: 'stub-fehler',
    ping: async () => true,
    submitMessage: async () => { throw new Error(msg); },
    submitConversation: async () => { throw new Error(msg); },
  };
}

describe('runOneSection', () => {
  it('befüllt EvalRunResult und führt die Checks über den Stub-Text aus', async () => {
    const { transport, calls } = captureStub(
      '### Finaler Text\nDies ist ein langer finaler Text über zehn Zeichen.',
    );
    const res = await runOneSection(transport, makeFixture(), 'A', makeRegistry({ max: 10 }), 'gpt-oss-120b');

    expect(res.fehler).toBeUndefined();
    expect(res.modellId).toBe('gpt-oss-120b');
    expect(res.abschnitt).toBe('A');
    expect(res.skillId).toBe('gutachten-kurzfassung');
    expect(res.vbFile).toBe('demo-ep.md');
    expect(res.parsed?.finalerText).toBe('Dies ist ein langer finaler Text über zehn Zeichen.');

    // Checks liefen über den finalen Text (51 Zeichen > Limit 10 → fehler).
    const maxCheck = res.checks.find(c => c.regelId === 'r-max');
    expect(maxCheck?.level).toBe('fehler');

    // Integrations-/Node-Lauffähigkeits-Beweis: buildStammdaten lief und der
    // Stammdaten-Block landete im Prompt, den der Transport bekam.
    expect(calls).toHaveLength(1);
    expect(calls[0]![0]!.content).toContain('Akronym: TESTAKRO');
    expect(res.dauerMs).toBeGreaterThanOrEqual(0);
  });

  it('zeichen_max ist „ok", wenn der finale Text innerhalb des Limits bleibt', async () => {
    const { transport } = captureStub('### Finaler Text\nKurz.');
    const res = await runOneSection(transport, makeFixture(), 'A', makeRegistry({ max: 100 }), 'm');
    expect(res.checks.find(c => c.regelId === 'r-max')?.level).toBe('ok');
  });

  it('Default-Kontext ist „voll" (Tag im Ergebnis)', async () => {
    const { transport } = captureStub('### Finaler Text\nKurz.');
    const res = await runOneSection(transport, makeFixture(), 'A', makeRegistry({ max: 100 }), 'm');
    expect(res.kontext).toBe('voll');
  });

  it('kontext=relevant: opts.vbMarkdown ersetzt den VB im Prompt + taggt die Zeile', async () => {
    const { transport, calls } = captureStub('### Finaler Text\nKurz.');
    const res = await runOneSection(transport, makeFixture(), 'A', makeRegistry({ max: 100 }), 'm', {
      kontext: 'relevant',
      vbMarkdown: 'NUR-DER-RELEVANTE-AUSZUG',
    });
    expect(res.kontext).toBe('relevant');
    const prompt = calls[0]![0]!.content;
    expect(prompt).toContain('NUR-DER-RELEVANTE-AUSZUG');
    expect(prompt).not.toContain('Wir entwickeln etwas Neues.'); // voller VB nicht im Prompt
  });

  it('Transport-Fehler landet in `fehler` (kein Throw nach oben)', async () => {
    const res = await runOneSection(throwingStub('llama-server weg'), makeFixture(), 'A', makeRegistry(), 'm');
    expect(res.fehler).toContain('llama-server weg');
    expect(res.parsed).toBeNull();
    expect(res.checks).toEqual([]);
    expect(res.raw).toBe('');
  });

  it('fehlender Skill in der Registry → `fehler`, kein Throw', async () => {
    const { transport } = captureStub('egal');
    const res = await runOneSection(transport, makeFixture(), 'A', makeRegistry({ withSkill: false }), 'm');
    expect(res.fehler).toContain("Skill 'gutachten-kurzfassung'");
    expect(res.parsed).toBeNull();
  });

  it('Import-Graph (runSkill + buildStammdaten) lädt unter dem Node-Runner', () => {
    // Dass dieser Test überhaupt importiert/läuft, beweist: der Produktions-
    // Import-Graph (eval-run → runSkill/buildStammdaten → runtime-config mit den
    // __TEAMFLOW_*__-define-Vars) lädt unter vitest/vite-node ohne Browser-Globals.
    expect(typeof runOneSection).toBe('function');
  });
});

/**
 * Der beschränkte Auto-Retry der App, in der Harness nachgebildet. Ohne ihn maß die
 * Harness den ERSTEN Wurf — den in der App niemand zu sehen bekommt, weil ein `fehler`
 * dort still einen zweiten Lauf mit `kuerzer`/`laenger` anhängt. Solange eine Vorgabe
 * ein `hinweis` ist, passiert nichts (das ist der Fall an B und C).
 */
describe('runOneSection — Auto-Retry wie in der App', () => {
  /** Transport, der der Reihe nach andere Antworten liefert. */
  function folgeStub(antworten: string[]): { transport: AITransport; calls: ConversationMessage[][] } {
    const calls: ConversationMessage[][] = [];
    let i = 0;
    const naechste = (): string => antworten[Math.min(i++, antworten.length - 1)]!;
    return {
      calls,
      transport: {
        name: 'stub-folge',
        ping: async () => true,
        submitMessage: async () => naechste(),
        submitConversation: async (messages) => { calls.push(messages); return naechste(); },
      },
    };
  }

  const ZU_LANG = '### Finaler Text\nDieser Text ist deutlich länger als das Limit von zehn Zeichen.';
  const KURZ = '### Finaler Text\nKurz.';

  it('ohne maxRetries bleibt es bei EINEM Aufruf (Bestandsverhalten)', async () => {
    const { transport, calls } = folgeStub([ZU_LANG, KURZ]);
    const res = await runOneSection(transport, makeFixture(), 'A', makeRegistry({ max: 10 }), 'm');
    expect(calls).toHaveLength(1);
    expect(res.versuche).toBe(1);
    expect(res.retryModifier).toBeUndefined();
    expect(res.checks.find(c => c.regelId === 'r-max')?.level).toBe('fehler');
  });

  it('mit maxRetries=1 korrigiert ein „zu lang" nach und liefert das ERGEBNIS der Korrektur', async () => {
    const { transport, calls } = folgeStub([ZU_LANG, KURZ]);
    const res = await runOneSection(transport, makeFixture(), 'A', makeRegistry({ max: 10 }), 'm', { maxRetries: 1 });
    expect(calls).toHaveLength(2);
    expect(res.versuche).toBe(2);
    expect(res.retryModifier).toEqual(['kuerzer']);
    expect(res.parsed?.finalerText).toBe('Kurz.');
    expect(res.checks.find(c => c.regelId === 'r-max')?.level).toBe('ok');
  });

  it('der Korrektur-Lauf bekommt den bisherigen Text mit — sonst schriebe er neu statt fort', async () => {
    const { transport, calls } = folgeStub([ZU_LANG, KURZ]);
    await runOneSection(transport, makeFixture(), 'A', makeRegistry({ max: 10 }), 'm', { maxRetries: 1 });
    const zweiter = calls[1]![0]!.content;
    expect(zweiter).toContain('Bisheriger finaler Text');
    expect(zweiter).toContain('Dieser Text ist deutlich länger');
  });

  it('hält die Wortzahl des ersten Versuchs fest — sonst wäre unsichtbar, was die Korrektur bewirkt hat', async () => {
    const { transport } = folgeStub([ZU_LANG, KURZ]);
    const res = await runOneSection(transport, makeFixture(), 'A', makeRegistry({ max: 10 }), 'm', { maxRetries: 1 });
    expect(res.erstVersuchWoerter).toBe(11);
  });

  it('ein sauberer erster Wurf löst KEINEN zweiten Aufruf aus', async () => {
    const { transport, calls } = folgeStub([KURZ, ZU_LANG]);
    const res = await runOneSection(transport, makeFixture(), 'A', makeRegistry({ max: 100 }), 'm', { maxRetries: 1 });
    expect(calls).toHaveLength(1);
    expect(res.versuche).toBe(1);
  });

  it('bleibt der Fehler bestehen, hört es bei der Decke auf (kein Endlos-Nachfassen)', async () => {
    const { transport, calls } = folgeStub([ZU_LANG]);
    const res = await runOneSection(transport, makeFixture(), 'A', makeRegistry({ max: 10 }), 'm', { maxRetries: 1 });
    expect(calls).toHaveLength(2);
    expect(res.versuche).toBe(2);
    expect(res.checks.find(c => c.regelId === 'r-max')?.level).toBe('fehler');
  });
});

describe('registry-load', () => {
  it('resolveRegistry: null → SEED_REGISTRY (mit den Gutachten-Skills)', () => {
    const reg = resolveRegistry(null);
    expect(reg.skills.some(s => s.id === 'gutachten-kurzfassung')).toBe(true);
  });

  it('resolveRegistry: ungültiger Inhalt → Fallback auf SEED_REGISTRY', () => {
    const reg = resolveRegistry({ version: 99, nonsense: true });
    expect(reg.skills.length).toBeGreaterThan(0);
  });

  it('getWorkflowSections: liefert A–G mit skillId', () => {
    const sections = getWorkflowSections();
    expect(sections.map(s => s.abschnitt)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(sections[0]).toMatchObject({ abschnitt: 'A', skillId: 'gutachten-kurzfassung' });
  });
});
