import { describe, it, expect } from 'vitest';
import {
  tokenize,
  buildMaDocument,
  runBm25Matching,
} from '../services/bm25-matcher';
import type { AnonymerMitarbeiter } from '../types';

function makeMa(anonId: string, kategorien: string[], tech: string[] = []): AnonymerMitarbeiter {
  return {
    anonId,
    jahresKapazitaet: 1600,
    abgemeldet: [],
    manuelleTechnologien: tech,
    ueberKategorien: kategorien,
    virtuelleProjekte: [],
    onboardingAbgeschlossen: true,
    aktiv: true,
  };
}

describe('tokenize', () => {
  it('lowercaset und splittet an non-alphanumerischen Zeichen', () => {
    expect(tokenize('Künstliche Intelligenz, Big-Data')).toEqual(
      ['künstliche', 'intelligenz', 'big', 'data'],
    );
  });
  it('Stoppwoerter werden entfernt', () => {
    expect(tokenize('die und der')).toEqual([]);
  });
  it('Tokens kleiner als 2 Zeichen werden entfernt', () => {
    expect(tokenize('a bb ccc')).toEqual(['bb', 'ccc']);
  });
  it('leerer String -> leer', () => {
    expect(tokenize('')).toEqual([]);
  });
});

describe('buildMaDocument', () => {
  it('dedupliziert + lowercased Technologien', () => {
    const ma = makeMa('MA01', ['IKT'], ['KI', 'ki', 'Sensorik']);
    const doc = buildMaDocument(ma, ['Big Data', 'KI']);
    expect(doc.technologien.sort()).toEqual(['big data', 'ki', 'sensorik'].sort());
    expect(doc.tokens).toContain('ki');
    expect(doc.tokens).toContain('sensorik');
    expect(doc.ueberKategorien).toEqual(['IKT']);
  });
});

describe('runBm25Matching', () => {
  it('matched einen Antrag mit "KI" gegen MA mit KI-Profil > MA ohne KI', () => {
    const m1 = makeMa('MA01', ['IKT'], ['KI', 'machine learning']);
    const m2 = makeMa('MA02', ['IND'], ['Lasertechnik']);
    const res = runBm25Matching({
      queryText: 'KI fuer Bilderkennung',
      eligibleAnonIds: new Set(['MA01', 'MA02']),
      mitarbeiter: { MA01: m1, MA02: m2 },
      historischeDeskriptorenByAnon: new Map([
        ['MA01', ['big data']],
        ['MA02', ['sensorik']],
      ]),
    });
    // MA01 (mit KI im Profil) muss hoeher punkten als MA02
    expect(res.length).toBeGreaterThan(0);
    expect(res[0]?.anonId).toBe('MA01');
  });

  it('filtert MAs nicht in eligibleAnonIds', () => {
    const m1 = makeMa('MA01', ['IKT'], ['KI']);
    const m2 = makeMa('MA02', ['IND'], ['KI']);   // gleicher Tech-Stack
    const res = runBm25Matching({
      queryText: 'KI',
      eligibleAnonIds: new Set(['MA01']),
      mitarbeiter: { MA01: m1, MA02: m2 },
      historischeDeskriptorenByAnon: new Map(),
    });
    expect(res.length).toBeLessThanOrEqual(1);
    expect(res.every(r => r.anonId === 'MA01')).toBe(true);
  });

  it('kein Eligible -> leere Liste', () => {
    const res = runBm25Matching({
      queryText: 'KI',
      eligibleAnonIds: new Set(),
      mitarbeiter: {},
      historischeDeskriptorenByAnon: new Map(),
    });
    expect(res).toEqual([]);
  });

  it('leerer Query -> leere Liste', () => {
    const m1 = makeMa('MA01', ['IKT'], ['KI']);
    const res = runBm25Matching({
      queryText: '',
      eligibleAnonIds: new Set(['MA01']),
      mitarbeiter: { MA01: m1 },
      historischeDeskriptorenByAnon: new Map(),
    });
    expect(res).toEqual([]);
  });

  it('keine matchenden Tokens im Korpus -> leere Liste (max=0)', () => {
    const m1 = makeMa('MA01', ['IKT'], ['Sensorik']);
    const res = runBm25Matching({
      queryText: 'voellig unbekannter Begriff Zufallswort',
      eligibleAnonIds: new Set(['MA01']),
      mitarbeiter: { MA01: m1 },
      historischeDeskriptorenByAnon: new Map(),
    });
    expect(res).toEqual([]);
  });

  it('Confidence-Bands: Top-1 normalisiert -> 1.0 -> high', () => {
    const m1 = makeMa('MA01', ['IKT'], ['KI', 'Machine Learning']);
    const m2 = makeMa('MA02', ['IKT'], ['Robotik']);
    const res = runBm25Matching({
      queryText: 'Machine Learning',
      eligibleAnonIds: new Set(['MA01', 'MA02']),
      mitarbeiter: { MA01: m1, MA02: m2 },
      historischeDeskriptorenByAnon: new Map(),
    });
    expect(res[0]?.score).toBeCloseTo(1.0, 5);
    expect(res[0]?.confidence).toBe('high');
  });

  it('matchendeTechnologien werden zurueckgegeben', () => {
    const m1 = makeMa('MA01', ['IKT'], ['KI', 'Sensorik']);
    const res = runBm25Matching({
      queryText: 'KI Anwendung',
      eligibleAnonIds: new Set(['MA01']),
      mitarbeiter: { MA01: m1 },
      historischeDeskriptorenByAnon: new Map(),
    });
    expect(res[0]?.matchendeTechnologien).toContain('ki');
  });
});
