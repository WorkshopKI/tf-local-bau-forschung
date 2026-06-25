/**
 * Phase 4 — Anonymisierungs-Parsing + Skill-Invarianten.
 */
import { describe, expect, it } from 'vitest';
import { parseAnonymisierung, istAnonymisiererAktiv } from '../anonymisierung';
import {
  ANFRAGE_ANONYMISIEREN_SKILL,
  ANFRAGE_ANONYMISIEREN_SKILL_ID,
} from '@/core/services/skills/registry/anfrage-anonymisieren.seed';
import { SEED_REGISTRY } from '@/core/services/skills';
import { skillEnthaeltDokumentInhalte } from '@/core/services/ai/transport-policy';

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
