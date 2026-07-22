/**
 * Facetten-Zähler der Auslastungs-Toolbars.
 *
 * Kern-Invariante (User-Feedback): **was die Pille anzeigt, ist die Zeilenzahl
 * nach dem Klick auf sie.** Vorher zählten die Pillen über den gesamten Pool —
 * mit Kategorie 30 + Antragstyp 16 zeigte die Liste 9.
 */
import { describe, it, expect } from 'vitest';
import { applyFacets, bucketFacet, countFacet, rowsExcept, type Facet } from '../views/facetCounts';

interface Row {
  id: string;
  /** Mehrwertig — wie Primär + Aspekte einer Verbund-Klassifizierung. */
  kategorien: string[];
  /** Einwertig, kann fehlen (Irrläufer haben keinen Antragstyp-Bucket). */
  typ: string | null;
  /** Überlappend — wie „offen" + „Übernahme-Wunsch". */
  status: string[];
}

const ROWS: Row[] = [
  { id: 'v1', kategorien: ['DT', 'IT'], typ: 'FuE', status: ['offen'] },
  { id: 'v2', kategorien: ['DT'], typ: 'FuE', status: ['offen', 'selbst'] },
  { id: 'v3', kategorien: ['DT'], typ: 'DS', status: ['offen'] },
  { id: 'v4', kategorien: ['IT', 'EU', 'NM'], typ: 'FuE', status: ['zugewiesen'] },
  { id: 'v5', kategorien: ['EU'], typ: null, status: ['offen', 'selbst'] },
];

const kategorienOf = (r: Row): string[] => r.kategorien;
const typOf = (r: Row): string[] => (r.typ ? [r.typ] : []);
const statusOf = (r: Row): string[] => r.status;

function facets(kategorie: string, typ: string, status: string): Facet<Row>[] {
  return [
    bucketFacet('kategorie', kategorie, kategorienOf),
    bucketFacet('antragstyp', typ, typOf),
    bucketFacet('status', status, statusOf),
  ];
}

describe('rowsExcept', () => {
  it('ohne aktive Facette bleiben alle Zeilen', () => {
    expect(rowsExcept(ROWS, facets('', '', ''), null).map(r => r.id))
      .toEqual(['v1', 'v2', 'v3', 'v4', 'v5']);
  });

  it('nimmt genau die benannte Facette aus', () => {
    const f = facets('DT', 'FuE', '');
    // Ohne die Kategorie-Facette bleiben alle FuE-Zeilen.
    expect(rowsExcept(ROWS, f, 'kategorie').map(r => r.id)).toEqual(['v1', 'v2', 'v4']);
    // Ohne die Antragstyp-Facette bleiben alle DT-Zeilen.
    expect(rowsExcept(ROWS, f, 'antragstyp').map(r => r.id)).toEqual(['v1', 'v2', 'v3']);
    // Mit beiden: der Schnitt.
    expect(applyFacets(ROWS, f).map(r => r.id)).toEqual(['v1', 'v2']);
  });
});

describe('countFacet — Invariante Pille == Zeilenzahl nach Klick', () => {
  const KATEGORIEN = ['DT', 'IT', 'EU', 'NM'];
  const TYPEN = ['FuE', 'DS', 'DL'];
  const STATUS = ['offen', 'selbst', 'zugewiesen'];

  // Alle Filter-Kombinationen durchspielen (inkl. „kein Filter").
  const KOMBIS: Array<[string, string, string]> = [];
  for (const k of ['', ...KATEGORIEN]) {
    for (const t of ['', ...TYPEN]) {
      for (const s of ['', ...STATUS]) KOMBIS.push([k, t, s]);
    }
  }

  it.each(KOMBIS)('Kategorie=%s Typ=%s Status=%s', (k, t, s) => {
    const aktuell = facets(k, t, s);
    const proFacette: Array<[string, (r: Row) => string[], string[]]> = [
      ['kategorie', kategorienOf, KATEGORIEN],
      ['antragstyp', typOf, TYPEN],
      ['status', statusOf, STATUS],
    ];
    for (const [key, bucketsOf, werte] of proFacette) {
      const counts = countFacet(ROWS, aktuell, key, bucketsOf);
      // „Alle" dieser Facette = Zeilen nach Rücksetzen genau dieser Pille.
      const alleGeklickt = aktuell.map(f => (f.key === key ? { key, active: null } : f));
      expect(counts.total).toBe(applyFacets(ROWS, alleGeklickt).length);
      // Jeder Wert = Zeilen nach Klick auf genau diesen Wert.
      for (const wert of werte) {
        const geklickt = aktuell.map(f => (f.key === key ? bucketFacet<Row>(key, wert, bucketsOf) : f));
        expect(counts.byBucket[wert] ?? 0).toBe(applyFacets(ROWS, geklickt).length);
      }
    }
  });
});

describe('countFacet — mehrwertige Buckets', () => {
  it('eine Zeile zählt in jeder ihrer Kategorien, aber nur einmal in total', () => {
    const counts = countFacet(ROWS, facets('', '', ''), 'kategorie', kategorienOf);
    expect(counts.total).toBe(5);
    expect(counts.byBucket).toEqual({ DT: 3, IT: 2, EU: 2, NM: 1 });
    // Summe der Buckets darf total übersteigen — Primär + Aspekte.
    const summe = Object.values(counts.byBucket).reduce((a, b) => a + b, 0);
    expect(summe).toBeGreaterThan(counts.total);
  });

  it('doppelt gelieferte Buckets zählen nur einmal', () => {
    const doppelt: Row[] = [{ id: 'x', kategorien: ['DT', 'DT'], typ: 'FuE', status: [] }];
    const counts = countFacet(doppelt, [], 'kategorie', kategorienOf);
    expect(counts.byBucket.DT).toBe(1);
  });

  it('Zeilen ohne Bucket zählen in total, aber in keinem Wert', () => {
    const counts = countFacet(ROWS, facets('', '', ''), 'antragstyp', typOf);
    expect(counts.total).toBe(5);          // v5 hat keinen Antragstyp
    expect(counts.byBucket).toEqual({ FuE: 3, DS: 1 });
  });
});
