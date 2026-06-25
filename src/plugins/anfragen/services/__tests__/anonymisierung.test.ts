/**
 * Phase 4 — Anonymisierungs-Parsing + Skill-Invarianten.
 */
import { describe, expect, it } from 'vitest';
import { parseAnonymisierung, istAnonymisiererAktiv, runAnonymisierung } from '../anonymisierung';
import {
  ANFRAGE_ANONYMISIEREN_SKILL,
  ANFRAGE_ANONYMISIEREN_SKILL_ID,
} from '@/core/services/skills/registry/anfrage-anonymisieren.seed';
import { SEED_REGISTRY } from '@/core/services/skills';
import { skillEnthaeltDokumentInhalte } from '@/core/services/ai/transport-policy';
import type { AIBridge } from '@/core/services/ai/bridge';

describe('parseAnonymisierung', () => {
  it('parst sauberes JSON-Objekt', () => {
    const raw = '{"anonymisiert":"Hallo [PERSON_1]","mapping":[{"platzhalter":"[PERSON_1]","original":"Dr. Schmidt","typ":"person"}]}';
    const r = parseAnonymisierung(raw);
    expect(r.anonymisiertMd).toBe('Hallo [PERSON_1]');
    expect(r.mapping).toEqual([{ platzhalter: '[PERSON_1]', original: 'Dr. Schmidt', typ: 'person' }]);
  });

  it('toleriert Markdown-Codefence um das JSON', () => {
    const raw = '```json\n{"anonymisiert":"X [FIRMA_1]","mapping":[{"platzhalter":"[FIRMA_1]","original":"ACME GmbH","typ":"firma"}]}\n```';
    const r = parseAnonymisierung(raw);
    expect(r.anonymisiertMd).toBe('X [FIRMA_1]');
    expect(r.mapping[0]?.typ).toBe('firma');
  });

  it('extrahiert das Objekt auch mit umgebendem Prosa-Text', () => {
    const raw = 'Gerne! Hier das Ergebnis:\n{"anonymisiert":"Text","mapping":[]}\nViel Erfolg.';
    expect(parseAnonymisierung(raw).anonymisiertMd).toBe('Text');
  });

  it('mappt unbekannten typ auf "sonstiges" und filtert leere Einträge', () => {
    const raw = '{"anonymisiert":"t","mapping":[{"platzhalter":"[X_1]","original":"Foo","typ":"quatsch"},{"platzhalter":"","original":"leer","typ":"person"}]}';
    const r = parseAnonymisierung(raw);
    expect(r.mapping).toEqual([{ platzhalter: '[X_1]', original: 'Foo', typ: 'sonstiges' }]);
  });

  it('fehlendes mapping → leeres Array', () => {
    expect(parseAnonymisierung('{"anonymisiert":"nur text"}').mapping).toEqual([]);
  });

  it('wirft bei Nicht-JSON / fehlendem anonymisiert-Feld', () => {
    expect(() => parseAnonymisierung('Tut mir leid, kann ich nicht.')).toThrow(/JSON-Format/);
    expect(() => parseAnonymisierung('{"mapping":[]}')).toThrow(/JSON-Format/);
  });

  it('parst trotz vorangestelltem Reasoning mit Stör-Klammern (Anker auf "anonymisiert")', () => {
    // Untagged Reasoning mit einem balancierten, aber kaputten JSON-Fragment davor.
    const raw = 'Ich prüfe das Beispiel {typ:person} und gebe zurück:\n'
      + '{"anonymisiert":"Hallo [PERSON_1]","mapping":[{"platzhalter":"[PERSON_1]","original":"Dr. Schmidt","typ":"person"}]}';
    const r = parseAnonymisierung(raw);
    expect(r.anonymisiertMd).toBe('Hallo [PERSON_1]');
    expect(r.mapping[0]?.original).toBe('Dr. Schmidt');
  });
});

describe('runAnonymisierung — interner Thinking-Block', () => {
  // Reproduziert den Produktions-Bug: die interne KI liefert ihr Reasoning inline
  // als <think>…</think> (mit einem Format-Beispiel darin); ohne thinkingBudget
  // wuerde runSkill extractThinking ueberspringen und der Parser das BEISPIEL aus
  // dem Reasoning greifen statt die echte Antwort.
  function fakeBridge(antwort: string): AIBridge {
    const transport = { name: 'Streamlit', ping: async () => true, submitMessage: async () => antwort };
    return { getTransportForSkillRun: () => transport } as unknown as AIBridge;
  }

  it('entfernt <think>…</think> (inkl. Format-Beispiel) vor dem Parsen', async () => {
    const polluted = '<think>Ich identifiziere die PII. Format-Beispiel: '
      + '{"anonymisiert":"BEISPIEL","mapping":[]}. Jetzt die echte Antwort.</think>\n'
      + '{"anonymisiert":"Hallo [PERSON_1]","mapping":[{"platzhalter":"[PERSON_1]","original":"Dr. Schmidt","typ":"person"}]}';
    const r = await runAnonymisierung(fakeBridge(polluted), ANFRAGE_ANONYMISIEREN_SKILL, 'Sehr geehrter Herr Dr. Schmidt');
    expect(r.anonymisiertMd).toBe('Hallo [PERSON_1]');
    expect(r.mapping).toHaveLength(1);
  });
});

describe('runAnonymisierung — Retry bei früh-finalisierter Teil-Antwort', () => {
  // Reproduziert den „Starte…"-Bug: das Bookmarklet finalisiert unter Last zu früh
  // mit einem kurzen Partial; ein frischer Versuch liefert das echte JSON.
  function fakeBridgeSeq(antworten: string[]): AIBridge {
    let i = 0;
    const transport = {
      name: 'Streamlit',
      ping: async () => true,
      submitMessage: async () => antworten[Math.min(i++, antworten.length - 1)]!,
    };
    return { getTransportForSkillRun: () => transport } as unknown as AIBridge;
  }

  const ECHT = '{"anonymisiert":"Hallo [PERSON_1]","mapping":[{"platzhalter":"[PERSON_1]","original":"Dr. Schmidt","typ":"person"}]}';

  it('1. Versuch „Starte…", 2. Versuch echtes JSON → löst mit dem geparsten Ergebnis auf', async () => {
    const bridge = fakeBridgeSeq(['Starte…', ECHT]);
    const r = await runAnonymisierung(bridge, ANFRAGE_ANONYMISIEREN_SKILL, 'Text', { pauseMs: 0 });
    expect(r.anonymisiertMd).toBe('Hallo [PERSON_1]');
  });

  it('alle Versuche „Starte…" → wirft mit Snippet im Fehler', async () => {
    const bridge = fakeBridgeSeq(['Starte…', 'Starte…', 'Starte…']);
    await expect(
      runAnonymisierung(bridge, ANFRAGE_ANONYMISIEREN_SKILL, 'Text', { versuche: 3, pauseMs: 0 }),
    ).rejects.toThrow(/Starte/);
  });

  it('setzt den Chat VOR dem LLM-Lauf zurück (frischer Kontext)', async () => {
    const calls: string[] = [];
    const transport = {
      name: 'Streamlit',
      ping: async () => true,
      resetChat: async () => { calls.push('reset'); return true; },
      submitMessage: async () => { calls.push('submit'); return ECHT; },
    };
    const bridge = { getTransportForSkillRun: () => transport } as unknown as AIBridge;
    await runAnonymisierung(bridge, ANFRAGE_ANONYMISIEREN_SKILL, 'Text', { pauseMs: 0 });
    expect(calls).toEqual(['reset', 'submit']);
  });

  it('ohne resetChat-Unterstützung läuft die Anonymisierung trotzdem (best-effort)', async () => {
    const bridge = fakeBridgeSeq([ECHT]); // Transport ohne resetChat
    const r = await runAnonymisierung(bridge, ANFRAGE_ANONYMISIEREN_SKILL, 'Text', { pauseMs: 0 });
    expect(r.anonymisiertMd).toBe('Hallo [PERSON_1]');
  });
});

describe('Anonymisierungs-Skill — Invarianten', () => {
  it('startet ZWINGEND aktiv: false (ungeprüft, geteilte registry.json)', () => {
    expect(ANFRAGE_ANONYMISIEREN_SKILL.aktiv).toBe(false);
  });

  it('ist in SEED_REGISTRY mit aktiv:false enthalten', () => {
    const seeded = SEED_REGISTRY.skills.find(s => s.id === ANFRAGE_ANONYMISIEREN_SKILL_ID);
    expect(seeded).toBeDefined();
    expect(seeded?.aktiv).toBe(false);
  });

  it('trägt Dokumentinhalte → interner Transport erzwungen (Ableitung über {{zielText}})', () => {
    expect(ANFRAGE_ANONYMISIEREN_SKILL.promptTemplate).toContain('{{zielText}}');
    expect(skillEnthaeltDokumentInhalte(ANFRAGE_ANONYMISIEREN_SKILL)).toBe(true);
  });

  it('istAnonymisiererAktiv: false bei aktiv:false, true bei fehlendem Feld', () => {
    expect(istAnonymisiererAktiv(ANFRAGE_ANONYMISIEREN_SKILL)).toBe(false);
    expect(istAnonymisiererAktiv({ ...ANFRAGE_ANONYMISIEREN_SKILL, aktiv: undefined })).toBe(true);
  });
});
