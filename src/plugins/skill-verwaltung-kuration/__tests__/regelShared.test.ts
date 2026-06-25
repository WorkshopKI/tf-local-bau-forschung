import { describe, it, expect } from 'vitest';
import { typLabel, kategorieLabel, pruefartLabel, sevLabel, aktivLabel } from '../regelShared';
import type { QualitaetsRegel } from '@/core/services/skills';

function regel(over: Partial<QualitaetsRegel> & { id: string; typ: string }): QualitaetsRegel {
  return {
    name: over.id,
    params: {},
    schweregrad: 'fehler',
    aktiv: true,
    erstellt_am: 't',
    geaendert_am: 't',
    ...over,
  };
}

describe('typLabel — pruefart-Fallback statt „unbekannter Typ"', () => {
  it('bekannter typ → typ-Label', () => {
    expect(typLabel(regel({ id: 'a', typ: 'satzanzahl' }))).toBe('Satzanzahl');
  });
  it('unbekannter typ + pruefart → pruefart-Label', () => {
    expect(typLabel(regel({ id: 'b', typ: 'ga_qs_quellenabgleich', pruefart: 'fachlich' }))).toBe('Fachlich');
    expect(typLabel(regel({ id: 'c', typ: 'ga_qs_vollstaendigkeit', pruefart: 'administrativ' }))).toBe('Administrativ');
  });
  it('unbekannter typ ohne pruefart → „unbekannter Typ"', () => {
    expect(typLabel(regel({ id: 'd', typ: 'zukunft' }))).toBe('unbekannter Typ');
  });
});

describe('kategorieLabel', () => {
  it('typ → Kategorie-Label', () => {
    expect(kategorieLabel(regel({ id: 'a', typ: 'satzanzahl' }))).toBe('Umfang');
  });
  it('fachlich → Inhalt & Quellen', () => {
    expect(kategorieLabel(regel({ id: 'b', typ: 'x', pruefart: 'fachlich' }))).toBe('Inhalt & Quellen');
  });
  it('explizite kategorie schlägt Ableitung', () => {
    expect(kategorieLabel(regel({ id: 'c', typ: 'satzanzahl', kategorie: 'inhalt' }))).toBe('Inhalt & Quellen');
  });
});

describe('pruefartLabel — Default „textlich" für Regeln ohne pruefart', () => {
  it('keine pruefart → Textlich', () => {
    expect(pruefartLabel(regel({ id: 'a', typ: 'satzanzahl' }))).toBe('Textlich');
  });
  it('fachlich/administrativ → eigenes Label', () => {
    expect(pruefartLabel(regel({ id: 'b', typ: 'x', pruefart: 'fachlich' }))).toBe('Fachlich');
    expect(pruefartLabel(regel({ id: 'c', typ: 'x', pruefart: 'administrativ' }))).toBe('Administrativ');
  });
});

describe('sevLabel / aktivLabel', () => {
  it('schweregrad', () => {
    expect(sevLabel(regel({ id: 'a', typ: 'x', schweregrad: 'fehler' }))).toBe('Fehler');
    expect(sevLabel(regel({ id: 'b', typ: 'x', schweregrad: 'hinweis' }))).toBe('Hinweis');
  });
  it('aktiv', () => {
    expect(aktivLabel(regel({ id: 'a', typ: 'x', aktiv: true }))).toBe('Aktiv');
    expect(aktivLabel(regel({ id: 'b', typ: 'x', aktiv: false }))).toBe('Inaktiv');
  });
});
