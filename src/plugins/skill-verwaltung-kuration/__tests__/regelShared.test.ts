import { describe, it, expect } from 'vitest';
import { typLabel, kategorieLabel, pruefartLabel, sevLabel, aktivLabel, wechsleRegelTyp, DEFAULT_PARAMS } from '../regelShared';
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

describe('wechsleRegelTyp — Typwechsel setzt Parameter destruktiv zurück', () => {
  it('params == DEFAULT_PARAMS[neu] (Kopie); id + name bleiben erhalten', () => {
    const r = regel({ id: 'x', typ: 'verbotenes_muster', name: 'Mein Name', params: { muster: ['x'], istRegex: true } });
    const next = wechsleRegelTyp(r, 'satzanzahl');
    expect(next.typ).toBe('satzanzahl');
    expect(next.params).toEqual(DEFAULT_PARAMS.satzanzahl);
    expect(next.params).not.toBe(DEFAULT_PARAMS.satzanzahl); // frische Kopie, keine geteilte Referenz
    expect(next.name).toBe('Mein Name');
    expect(next.id).toBe('x');
  });
  it('unbekannter Ziel-Typ → leere params', () => {
    expect(wechsleRegelTyp(regel({ id: 'y', typ: 'satzanzahl' }), 'zukunft').params).toEqual({});
  });
});

describe('Typ-Chip nutzt typLabel', () => {
  it('verbotenes_muster → „Verbotenes Muster"', () => {
    expect(typLabel(regel({ id: 'z', typ: 'verbotenes_muster' }))).toBe('Verbotenes Muster');
  });
});
