/**
 * Unit-Tests fuer die persistente kuerzel↔anonId-Map.
 *
 * Drei Eigenschaften die garantiert sein muessen:
 *  1. Bootstrap-Sortierung: `bootstrapKuerzelMap` aus einer Antraege-Menge
 *     vergibt anonIds alphabetisch (MA01 = alphabetisch erstes Kuerzel etc.).
 *  2. Append-only-Verhalten bei neuen Kuerzeln — auch wenn sie alphabetisch
 *     in der Mitte einsortieren, behalten bestehende ihre anonId. Das ist
 *     der Kern-Bug-Fix.
 *  3. Idempotenz: gleiche Eingabe → kein neuer Map-Pointer.
 */
import { describe, it, expect } from 'vitest';
import {
  bootstrapKuerzelMap,
  syncKuerzelMapWithAntraege,
  buildAnonymMapFromKuerzelMap,
  normalizeKuerzelMap,
  emptyKuerzelMap,
  type KuerzelMapFile,
} from '../services/kuerzel-map';
import type { Antrag } from '@/core/services/csv/types';

function makeAntrag(az: string, tib?: string): Antrag {
  return {
    aktenzeichen: az,
    programm_id: 'p1',
    tib_kuerz: tib,
    _field_sources: {},
    _updated_at: new Date().toISOString(),
  } as Antrag;
}

describe('bootstrapKuerzelMap', () => {
  it('alphabetische Sortierung gibt ALB=MA01, MUE=MA02, SCH=MA03', () => {
    const file = bootstrapKuerzelMap([
      makeAntrag('A1', 'MUE'),
      makeAntrag('A2', 'SCH'),
      makeAntrag('A3', 'ALB'),
    ]);
    expect(file.entries.map(e => `${e.anonId}=${e.kuerzel}`)).toEqual([
      'MA01=ALB',
      'MA02=MUE',
      'MA03=SCH',
    ]);
  });

  it('ignoriert leere / nicht-string tib_kuerz', () => {
    const file = bootstrapKuerzelMap([
      makeAntrag('A1', 'MUE'),
      makeAntrag('A2'),
      makeAntrag('A3', ''),
      makeAntrag('A4', '   '),
    ]);
    expect(file.entries.length).toBe(1);
    expect(file.entries[0]!.kuerzel).toBe('MUE');
  });

  it('normalisiert Kuerzel (trim + uppercase, Duplikate)', () => {
    const file = bootstrapKuerzelMap([
      makeAntrag('A1', 'mue'),
      makeAntrag('A2', ' MUE '),
      makeAntrag('A3', 'Mue'),
    ]);
    expect(file.entries.length).toBe(1);
    expect(file.entries[0]!.kuerzel).toBe('MUE');
  });

  it('leere Antraege → leere entries', () => {
    expect(bootstrapKuerzelMap([]).entries.length).toBe(0);
  });
});

describe('syncKuerzelMapWithAntraege', () => {
  function withKuerzel(...kuerzel: string[]): KuerzelMapFile {
    const now = new Date().toISOString();
    return {
      version: 1,
      updatedAt: now,
      entries: kuerzel.map((k, i) => ({
        kuerzel: k,
        anonId: `MA${String(i + 1).padStart(2, '0')}`,
        createdAt: now,
      })),
    };
  }

  it('idempotent: gleiche Antraege → derselbe Map-Pointer, added leer', () => {
    const current = withKuerzel('ALB', 'MUE', 'SCH');
    const { map, added } = syncKuerzelMapWithAntraege(current, [
      makeAntrag('A1', 'MUE'),
      makeAntrag('A2', 'SCH'),
      makeAntrag('A3', 'ALB'),
    ]);
    expect(map).toBe(current);
    expect(added).toEqual([]);
  });

  it('haengt neue Kuerzel hinten an, behaelt bestehende anonIds', () => {
    const current = withKuerzel('ALB', 'MUE', 'SCH');
    const { map, added } = syncKuerzelMapWithAntraege(current, [
      makeAntrag('A1', 'MUE'),
      makeAntrag('A2', 'ZZZ'),  // neu
      makeAntrag('A3', 'ALB'),
    ]);
    expect(added).toEqual(['ZZZ']);
    expect(map.entries.map(e => `${e.anonId}=${e.kuerzel}`)).toEqual([
      'MA01=ALB',
      'MA02=MUE',
      'MA03=SCH',
      'MA04=ZZZ',
    ]);
  });

  it('Mitten-Insert: neuer Kuerzel der alphabetisch zwischen bestehenden waere → bekommt trotzdem die hoechste anonId', () => {
    // Kern-Korrektur-Punkt: ohne diese Garantie haetten "GHI" zwischen "FFF" und "HHH"
    // alle nachfolgenden anonIds verschoben. Mit der persistenten Map nicht mehr.
    const current = withKuerzel('FFF', 'HHH', 'KKK');
    const { map, added } = syncKuerzelMapWithAntraege(current, [
      makeAntrag('A1', 'FFF'),
      makeAntrag('A2', 'GHI'),  // alphabetisch zwischen FFF und HHH
      makeAntrag('A3', 'HHH'),
      makeAntrag('A4', 'KKK'),
    ]);
    expect(added).toEqual(['GHI']);
    expect(map.entries.map(e => `${e.anonId}=${e.kuerzel}`)).toEqual([
      'MA01=FFF',
      'MA02=HHH',
      'MA03=KKK',
      'MA04=GHI',  // ← haengt hinten an, nicht in der Mitte
    ]);
  });

  it('mehrere neue Kuerzel auf einmal werden alphabetisch sortiert appendet', () => {
    const current = withKuerzel('AAA');
    const { map, added } = syncKuerzelMapWithAntraege(current, [
      makeAntrag('A1', 'AAA'),
      makeAntrag('A2', 'ZZZ'),
      makeAntrag('A3', 'BBB'),
      makeAntrag('A4', 'YYY'),
    ]);
    expect(added).toEqual(['BBB', 'YYY', 'ZZZ']);
    expect(map.entries.map(e => e.anonId)).toEqual(['MA01', 'MA02', 'MA03', 'MA04']);
    expect(map.entries.map(e => e.kuerzel)).toEqual(['AAA', 'BBB', 'YYY', 'ZZZ']);
  });

  it('leere Map + Antraege → kein Bootstrap (syncKuerzelMap allein bootstrapped NICHT — das macht der Hook)', () => {
    const empty = emptyKuerzelMap();
    const { map, added } = syncKuerzelMapWithAntraege(empty, [
      makeAntrag('A1', 'MUE'),
    ]);
    expect(added).toEqual(['MUE']);
    expect(map.entries.map(e => `${e.anonId}=${e.kuerzel}`)).toEqual(['MA01=MUE']);
  });
});

describe('normalizeKuerzelMap', () => {
  it('null/undefined raw → leeres Default', () => {
    expect(normalizeKuerzelMap(null).entries).toEqual([]);
    expect(normalizeKuerzelMap(undefined).entries).toEqual([]);
    expect(normalizeKuerzelMap({}).entries).toEqual([]);
  });

  it('re-canonicalized inkonsistente anonIds auf Position-basiert', () => {
    // Datei wurde z.B. manuell editiert und entries[1].anonId ist falsch
    const raw: Partial<KuerzelMapFile> = {
      version: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      entries: [
        { kuerzel: 'ALB', anonId: 'MA99', createdAt: '2026-01-01T00:00:00.000Z' },
        { kuerzel: 'MUE', anonId: 'MA42', createdAt: '2026-01-01T00:00:00.000Z' },
      ],
    };
    const out = normalizeKuerzelMap(raw);
    expect(out.entries[0]!.anonId).toBe('MA01');
    expect(out.entries[1]!.anonId).toBe('MA02');
    expect(out.entries[0]!.kuerzel).toBe('ALB');
    expect(out.entries[1]!.kuerzel).toBe('MUE');
  });

  it('filtert invalide entries (fehlende Felder)', () => {
    const raw = {
      entries: [
        { kuerzel: 'MUE', anonId: 'MA01', createdAt: '2026-01-01T00:00:00.000Z' },
        { kuerzel: 'X' }, // unvollstaendig
        null,
        'not-an-entry',
      ],
    } as unknown as Partial<KuerzelMapFile>;
    const out = normalizeKuerzelMap(raw);
    expect(out.entries.length).toBe(1);
    expect(out.entries[0]!.kuerzel).toBe('MUE');
  });
});

describe('buildAnonymMapFromKuerzelMap', () => {
  it('roundtrip: bootstrap + build ergibt anonIds passend zu den Kuerzeln', () => {
    const antraege = [
      makeAntrag('A1', 'MUE'),
      makeAntrag('A2', 'SCH'),
      makeAntrag('A3', 'ALB'),
    ];
    const file = bootstrapKuerzelMap(antraege);
    const map = buildAnonymMapFromKuerzelMap(file);

    expect(map.toAnon.get('ALB')).toBe('MA01');
    expect(map.toAnon.get('MUE')).toBe('MA02');
    expect(map.toAnon.get('SCH')).toBe('MA03');
    expect(map.toReal.get('MA01')).toBe('ALB');
    expect(map.toReal.get('MA02')).toBe('MUE');
    expect(map.toReal.get('MA03')).toBe('SCH');
  });

  it('leere Map → leere AnonymMap', () => {
    const m = buildAnonymMapFromKuerzelMap(emptyKuerzelMap());
    expect(m.toAnon.size).toBe(0);
    expect(m.toReal.size).toBe(0);
  });
});
