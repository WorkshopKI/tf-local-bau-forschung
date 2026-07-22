import { describe, it, expect } from 'vitest';
import {
  effektiveSkillKategorie,
  skillKategorieLabel,
  skillKategorieRang,
  SKILL_KATEGORIE_LABEL,
  SKILL_KATEGORIE_ORDER,
} from '../skill-kategorien';
import { SEED_REGISTRY } from '../seed';

describe('effektiveSkillKategorie (Ableitungs-Reihenfolge)', () => {
  it('explizite Kategorie schlägt id- UND name-Ableitung', () => {
    expect(effektiveSkillKategorie({ id: 'gutachten-markt', name: 'Gutachten X', kategorie: 'anfrage' }))
      .toBe('anfrage');
  });

  it('id-Präfix schlägt name-Ableitung', () => {
    expect(effektiveSkillKategorie({ id: 'aufbereitung-zahlen', name: 'Gutachten-Zahlen' }))
      .toBe('aufbereitung');
  });

  it('name-Präfix greift, wenn die id nichts hergibt (kuratierte UUID-Skills)', () => {
    expect(effektiveSkillKategorie({ id: 'b3f1-4a2c', name: 'Gutachten - Bullet Points pro Partner' }))
      .toBe('gutachten');
    expect(effektiveSkillKategorie({ id: 'b3f1-4a2c', name: 'Anfrage taggen' })).toBe('anfrage');
  });

  it('unbekannt → sonstige', () => {
    expect(effektiveSkillKategorie({ id: 'irgendwas', name: 'Irgendwas' })).toBe('sonstige');
  });

  it('leere/whitespace-Kategorie zählt nicht als explizit gesetzt', () => {
    expect(effektiveSkillKategorie({ id: 'gutachten-markt', name: 'Markt', kategorie: '  ' }))
      .toBe('gutachten');
  });

  it.each([
    ['gutachten-kurzfassung', 'gutachten'],
    ['ga-lektor', 'gutachten'],
    ['nf-auswahl-fuellung', 'nachforderung'],
    ['aufbereitung-glossar', 'aufbereitung'],
    ['anfrage-anonymisieren', 'anfrage'],
    ['qs-basis', 'qs'],
    ['relevanz-map', 'qs'],
  ])('id %s → %s', (id, erwartet) => {
    expect(effektiveSkillKategorie({ id, name: '' })).toBe(erwartet);
  });
});

describe('Labels + Rang', () => {
  it('jede Kategorie der Reihenfolge hat ein Label', () => {
    for (const k of SKILL_KATEGORIE_ORDER) expect(SKILL_KATEGORIE_LABEL[k]).toBeTruthy();
  });

  it('Label folgt der effektiven Kategorie', () => {
    expect(skillKategorieLabel({ id: 'nf-x', name: '' })).toBe('Nachforderungen');
  });

  it('Rang folgt SKILL_KATEGORIE_ORDER; Unbekanntes stabil ans Ende', () => {
    expect(skillKategorieRang({ id: 'gutachten-a', name: '' })).toBe(0);
    expect(skillKategorieRang({ id: 'x', name: '', kategorie: 'eigenes' }))
      .toBe(SKILL_KATEGORIE_ORDER.length);
  });
});

describe('Seed-Abdeckung', () => {
  it('kein Seed-Skill landet in „Sonstige" (die Ableitung deckt den Bestand ab)', () => {
    const rest = SEED_REGISTRY.skills.filter(s => effektiveSkillKategorie(s) === 'sonstige');
    expect(rest.map(s => s.id)).toEqual([]);
  });
});
