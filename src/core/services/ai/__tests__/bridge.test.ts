import { describe, it, expect, vi, beforeAll } from 'vitest';

// OpenRouter ist in der Test-Config deaktiviert → `switchProvider({type:'openrouter'})`
// würde am Build-Gate scheitern. Für die Policy-Gating-Tests (aktive Klasse =
// `extern`) den Flag freischalten; restliche Exports bleiben original.
vi.mock('@/config/feature-flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/feature-flags')>();
  return { ...actual, isOpenRouterEnabled: () => true };
});

// StreamlitBridgeTransport registriert im Konstruktor einen `window`-Message-Listener;
// im Node-Test-Env fehlt `window`. Minimaler Stub vor der ersten Instanziierung.
beforeAll(() => {
  vi.stubGlobal('window', { addEventListener: () => {}, open: () => null });
});

import { AIBridge } from '../bridge';

const INHALTS_SKILL = { promptTemplate: 'Fasse zusammen:\n{{vbMarkdown}}' };
const INHALTSFREI_SKILL = { promptTemplate: 'Generiere eine Begrüßung.', enthaeltDokumentInhalte: false };
const EXTERN_CONFIG = {
  type: 'openrouter' as const,
  endpoint: 'https://openrouter.ai/api/v1',
  model: 'x',
  apiKey: 'k',
};

describe('AIBridge.getTransportForDatenLauf (Laeufe ohne Skill-Record, v4.12)', () => {
  // Die Auslastungs-Klassifizierung schickt Verbund-/TV-Titel und Antragsteller
  // ans Modell, hat aber keinen SkillRecord als Policy-Subjekt. Bis v4.12 zog sie
  // den Transport roh und konnte den Bestand an einen externen Provider geben.
  it('intern → liefert Transport', () => {
    const bridge = new AIBridge();
    expect(bridge.getActiveKlasse()).toBe('intern');
    expect(() => bridge.getTransportForDatenLauf('Die Auslastungs-Klassifizierung')).not.toThrow();
  });

  it('extern → wirft, und die Meldung benennt den Lauf', () => {
    const bridge = new AIBridge();
    bridge.switchProvider(EXTERN_CONFIG);
    expect(bridge.getActiveKlasse()).toBe('extern');
    expect(() => bridge.getTransportForDatenLauf('Die Auslastungs-Klassifizierung'))
      .toThrow(/DSGVO-Transport-Policy: Die Auslastungs-Klassifizierung/);
  });
});

describe('AIBridge.getTransportForSkillRun (DSGVO-Transport-Policy)', () => {
  it('intern (streamlit, Default) + Inhalts-Skill → liefert Transport (kein Throw)', () => {
    const bridge = new AIBridge();
    expect(bridge.getActiveKlasse()).toBe('intern');
    expect(() => bridge.getTransportForSkillRun(INHALTS_SKILL)).not.toThrow();
  });

  it('intern + inhaltsfreier Skill → ok', () => {
    const bridge = new AIBridge();
    expect(() => bridge.getTransportForSkillRun(INHALTSFREI_SKILL)).not.toThrow();
  });

  it('extern + Inhalts-Skill → wirft DSGVO-Fehler', () => {
    const bridge = new AIBridge();
    bridge.switchProvider(EXTERN_CONFIG);
    expect(bridge.getActiveKlasse()).toBe('extern');
    expect(() => bridge.getTransportForSkillRun(INHALTS_SKILL)).toThrow(/DSGVO-Transport-Policy/);
  });

  it('extern + inhaltsfreier Skill → ok', () => {
    const bridge = new AIBridge();
    bridge.switchProvider(EXTERN_CONFIG);
    expect(bridge.getActiveKlasse()).toBe('extern');
    expect(() => bridge.getTransportForSkillRun(INHALTSFREI_SKILL)).not.toThrow();
  });

  it('Ableitung schlägt Flag: extern + Inhalts-Slot trotz Flag=false → wirft', () => {
    const bridge = new AIBridge();
    bridge.switchProvider(EXTERN_CONFIG);
    expect(() => bridge.getTransportForSkillRun({
      promptTemplate: 'Bewerte:\n{{zielText}}',
      enthaeltDokumentInhalte: false,
    })).toThrow(/DSGVO-Transport-Policy/);
  });
});
