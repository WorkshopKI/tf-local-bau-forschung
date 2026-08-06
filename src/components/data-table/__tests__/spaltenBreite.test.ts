/**
 * Sicherungen für die inhaltsabhängige Spaltenbreite.
 *
 * Die echte Textmessung braucht Canvas und damit einen Browser — hier wird sie
 * injiziert. Genau deshalb ist die Entscheidungslogik (Textquelle, Kandidaten-
 * wahl, Kopf als Boden, Zuschläge, Klemmung) node-testbar; geprüft wird sie,
 * nicht die Metrik.
 */
import { describe, it, expect } from 'vitest';
import {
  messTextVon,
  waehleMesskandidaten,
  kopfBreite,
  berechneAutoBreiten,
  type MesseBreite,
} from '../messung/spaltenBreite';
import type { SortableColumn } from '../types';

interface Row { text: string; zahl: number }

/** Attrappe: 10px je Zeichen, Kopf-Profil doppelt so breit. So ist jede
 *  erwartete Zahl von Hand nachrechenbar. */
const messe: MesseBreite = (t, schrift) => t.length * (schrift === 'kopf' ? 20 : 10);

function col(patch: Partial<SortableColumn<Row>> & { key: string }): SortableColumn<Row> {
  return {
    label: patch.key,
    defaultVisible: true,
    sortable: false,
    accessor: r => r.text,
    render: () => null,
    ...patch,
  };
}

function row(text: string, zahl = 0): Row {
  return { text, zahl };
}

describe('messTextVon — Kette messText > exportValue > accessor', () => {
  it('nimmt den accessor, wenn nichts anderes da ist', () => {
    expect(messTextVon(col({ key: 'a' }), row('abc'))).toBe('abc');
  });

  it('exportValue schlägt den accessor — der kann ein Sortier-Sentinel sein', () => {
    const c = col({
      key: 'a',
      accessor: () => Number.MAX_SAFE_INTEGER,
      exportValue: () => 'in 45 T',
    });
    expect(messTextVon(c, row(''))).toBe('in 45 T');
  });

  it('messText schlägt beide — für Zellen, die anders aussehen als ihr Export', () => {
    const c = col({
      key: 'a',
      accessor: r => r.zahl,
      exportValue: r => r.zahl,
      messText: r => `${r.zahl.toLocaleString('de-DE')} €`,
    });
    expect(messTextVon(c, row('', 1234567))).toBe('1.234.567 €');
  });

  it('macht aus einem numerischen accessor einen String statt NaN-Breite', () => {
    expect(messTextVon(col({ key: 'a', accessor: r => r.zahl }), row('', 42))).toBe('42');
  });
});

describe('waehleMesskandidaten — Stufe 1 (billig)', () => {
  const spalten = [col({ key: 'a' })];

  it('behält die längsten Texte, absteigend sortiert', () => {
    const k = waehleMesskandidaten([row('kurz'), row('mittellang'), row('x')], spalten);
    expect(k.a).toEqual(['mittellang', 'kurz', 'x']);
  });

  it('kappt auf die Kandidatenzahl', () => {
    const zeilen = ['aaaa', 'bbbbb', 'cc', 'dddddd', 'e'].map(t => row(t));
    expect(waehleMesskandidaten(zeilen, spalten, { kandidaten: 2 }).a).toEqual(['dddddd', 'bbbbb']);
  });

  it('sieht nur das Scan-Fenster an — der lange Text dahinter zählt nicht', () => {
    const zeilen = [row('kurz'), row('ebenfalls kurz'), row('DER MIT ABSTAND LAENGSTE TEXT')];
    const k = waehleMesskandidaten(zeilen, spalten, { scanFenster: 2 });
    expect(k.a).toEqual(['ebenfalls kurz', 'kurz']);
  });

  it('überspringt leere Zellen statt sie als Kandidat zu führen', () => {
    expect(waehleMesskandidaten([row(''), row('da')], spalten).a).toEqual(['da']);
  });

  it('lässt Spalten mit autoWidth:false ganz aus', () => {
    const k = waehleMesskandidaten([row('abc')], [col({ key: 'a' }), col({ key: 'b', autoWidth: false })]);
    expect(Object.keys(k)).toEqual(['a']);
  });

  it('bei Gleichstand verdrängt ein späterer Text keinen früheren', () => {
    const k = waehleMesskandidaten([row('AAAA'), row('BBBB'), row('CCCC')], spalten, { kandidaten: 2 });
    expect(k.a).toEqual(['AAAA', 'BBBB']);
  });

  it('bleibt bei leeren Zeilen harmlos', () => {
    expect(waehleMesskandidaten([], spalten).a).toEqual([]);
  });
});

describe('kopfBreite — der Boden jeder Spalte', () => {
  it('misst die GROSSSCHREIBUNG, weil der Kopf uppercase rendert', () => {
    // 'abc' → 'ABC', 3 Zeichen × 20 + 24 Polster
    expect(kopfBreite(col({ key: 'a', label: 'abc' }), messe, { zellPolster: 24 })).toBe(84);
  });

  it('macht Platz für den Sortier-Pfeil, aber nur bei sortierbaren Spalten', () => {
    const o = { zellPolster: 0, kopfSortIcon: 17 };
    expect(kopfBreite(col({ key: 'a', label: 'ab', sortable: true }), messe, o)).toBe(57);
    expect(kopfBreite(col({ key: 'a', label: 'ab', sortable: false }), messe, o)).toBe(40);
  });

  it('macht Platz für den Filter-Chevron nur, wenn der Verbraucher Filter durchreicht', () => {
    const c = col({ key: 'a', label: 'ab', filterable: true });
    const o = { zellPolster: 0, kopfFilterIcon: 21 };
    expect(kopfBreite(c, messe, { ...o, filterAktiv: true })).toBe(61);
    expect(kopfBreite(c, messe, { ...o, filterAktiv: false })).toBe(40);
  });
});

describe('berechneAutoBreiten — Stufe 2 (Aggregation + Klemmung)', () => {
  const basis = { zellPolster: 0, minBreite: 0, maxBreite: 10000, kopfSortIcon: 0, kopfFilterIcon: 0 };

  it('nimmt den breitesten Kandidaten, nicht den längsten String', () => {
    // Attrappe misst rein nach Länge — deshalb hier eine, die 'W' teuer macht.
    const messeW: MesseBreite = t => [...t].reduce((s, z) => s + (z === 'W' ? 40 : 5), 0);
    const b = berechneAutoBreiten([col({ key: 'a', label: '' })], { a: ['iiiiiiii', 'WWW'] }, messeW, basis);
    expect(b.a).toBe(120); // 3×40 schlägt 8×5
  });

  it('addiert den Dekorations-Zuschlag auf den Text, nicht auf den Kopf', () => {
    const b = berechneAutoBreiten([col({ key: 'a', label: '', messZuschlag: 42 })], { a: ['abc'] }, messe, basis);
    expect(b.a).toBe(72); // 3×10 + 42
  });

  it('lässt den Kopf gewinnen, wenn er breiter ist als jeder Inhalt', () => {
    const b = berechneAutoBreiten([col({ key: 'a', label: 'Bewilligungsdatum' })], { a: ['x'] }, messe, basis);
    expect(b.a).toBe(17 * 20);
  });

  it('gibt einer leeren Spalte KEIN Polster für einen Text, den es nicht gibt', () => {
    const c = col({ key: 'a', label: 'ab', messZuschlag: 999 });
    const b = berechneAutoBreiten([c], { a: [] }, messe, { ...basis, zellPolster: 24 });
    expect(b.a).toBe(kopfBreite(c, messe, { ...basis, zellPolster: 24 }));
  });

  it('klemmt an der globalen Ober- und Untergrenze', () => {
    const lang = 'x'.repeat(100);
    expect(berechneAutoBreiten([col({ key: 'a', label: '' })], { a: [lang] }, messe, { ...basis, maxBreite: 300 }).a)
      .toBe(300);
    expect(berechneAutoBreiten([col({ key: 'a', label: '' })], { a: ['x'] }, messe, { ...basis, minBreite: 64 }).a)
      .toBe(64);
  });

  it('spaltenspezifische Grenzen schlagen die globalen', () => {
    const lang = 'x'.repeat(100);
    const b = berechneAutoBreiten(
      [col({ key: 'a', label: '', maxWidth: 300 }), col({ key: 'b', label: '', minWidth: 142 })],
      { a: [lang], b: ['x'] },
      messe,
      { ...basis, maxBreite: 10000, minBreite: 0 },
    );
    expect(b.a).toBe(300);
    expect(b.b).toBe(142);
  });

  it('hält den Mindestbedarf, wenn eine Spalte min > max konfiguriert hat', () => {
    const b = berechneAutoBreiten(
      [col({ key: 'a', label: '', minWidth: 200, maxWidth: 100 })], { a: ['x'] }, messe, basis,
    );
    expect(b.a).toBe(200);
  });

  it('lässt Spalten mit autoWidth:false ganz aus — sie behalten ihre gepflegte width', () => {
    const b = berechneAutoBreiten(
      [col({ key: 'a', label: '' }), col({ key: 'b', label: '', autoWidth: false, width: 180 })],
      { a: ['abc'], b: ['sehr sehr langer Text'] },
      messe,
      basis,
    );
    expect(Object.keys(b)).toEqual(['a']);
  });

  it('liefert ganze Pixel', () => {
    const messeKrumm: MesseBreite = t => t.length * 7.3333;
    const b = berechneAutoBreiten([col({ key: 'a', label: '' })], { a: ['abc'] }, messeKrumm, basis);
    expect(Number.isInteger(b.a)).toBe(true);
  });
});
