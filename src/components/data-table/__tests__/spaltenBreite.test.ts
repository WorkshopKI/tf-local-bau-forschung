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
  berechneAutoBreitenDetail,
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
  /** Attrappe, die Versalien breiter macht — nur so ist überhaupt prüfbar, in
   *  welcher Schreibweise gemessen wurde. */
  const messeMitCase: MesseBreite = t =>
    [...t].reduce((n, z) => n + (z === z.toUpperCase() && z !== z.toLowerCase() ? 30 : 20), 0);

  it('misst eine NICHT sortierbare Spalte in Großschreibung — so rendert sie', () => {
    // 'abc' → 'ABC', 3 Versalien × 30 + 24 Polster
    expect(kopfBreite(col({ key: 'a', label: 'abc' }), messeMitCase, { zellPolster: 24 })).toBe(114);
  });

  it('misst eine SORTIERBARE Spalte gemischt — der Sortier-Knopf hebt das uppercase auf', () => {
    // Tailwind-Preflight setzt `button { text-transform: none }`. Pauschale
    // Großschreibung veranschlagte „Status und nächster Schritt" 31 px zu breit.
    const c = col({ key: 'a', label: 'abc', sortable: true });
    expect(kopfBreite(c, messeMitCase, { zellPolster: 24, kopfSortIcon: 0 })).toBe(84);
  });

  it('macht Platz für den Sortier-Pfeil, aber nur bei sortierbaren Spalten', () => {
    const o = { zellPolster: 0, kopfSortIcon: 17 };
    expect(kopfBreite(col({ key: 'a', label: 'ab', sortable: true }), messe, o)).toBe(57);
    expect(kopfBreite(col({ key: 'a', label: 'ab', sortable: false }), messe, o)).toBe(40);
  });

  it('macht Platz für den Filter-Chevron nur, wenn der Verbraucher Filter durchreicht', () => {
    const c = col({ key: 'a', label: 'ab', filterable: true });
    const o = { zellPolster: 0, kopfFilterIcon: 21 };
    // Platz für den Chevron bekommt NUR eine wirklich gefilterte Spalte — bei
    // allen anderen liegt er außerhalb des Flusses und erscheint erst beim
    // Überfahren.
    expect(kopfBreite(c, messe, { ...o, gefilterteKeys: [c.key] })).toBe(61);
    expect(kopfBreite(c, messe, { ...o, gefilterteKeys: [] })).toBe(40);
    expect(kopfBreite(c, messe, { ...o, gefilterteKeys: ['andere'] })).toBe(40);
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

describe('berechneAutoBreitenDetail — der ungeklemmte Wunsch', () => {
  const basis = { zellPolster: 0, minBreite: 0, maxBreite: 10_000 };

  it('hält fest, was maxWidth der Spalte weggenommen hat', () => {
    const d = berechneAutoBreitenDetail(
      [col({ key: 'a', label: '', maxWidth: 50 })],
      { a: ['abcdefghij'] },   // 10 Zeichen × 10 = 100
      messe,
      basis,
    );
    expect(d.a).toEqual({ breite: 50, wunsch: 100 });
  });

  it('setzt Wunsch == Breite, wo nichts geklemmt wurde — solche Spalten sind nicht hungrig', () => {
    const d = berechneAutoBreitenDetail(
      [col({ key: 'a', label: '' })],
      { a: ['abcde'] },
      messe,
      basis,
    );
    expect(d.a!.wunsch).toBe(d.a!.breite);
  });

  it('zählt die Untergrenze zum Wunsch — eine hochgezogene Spalte ist nicht „übersättigt"', () => {
    // Ohne das wäre der Wunsch (30) kleiner als die Breite (80) und der Hunger
    // negativ; die Spalte würde beim Verteilen als Geberin missverstanden.
    const d = berechneAutoBreitenDetail(
      [col({ key: 'a', label: '', minWidth: 80 })],
      { a: ['abc'] },
      messe,
      basis,
    );
    expect(d.a).toEqual({ breite: 80, wunsch: 80 });
  });

  it('deckt sich in der Breite exakt mit berechneAutoBreiten', () => {
    const spalten = [
      col({ key: 'a', label: 'Kopf', maxWidth: 40 }),
      col({ key: 'b', label: '', minWidth: 90 }),
      col({ key: 'c', label: '', autoWidth: false }),
    ];
    const kandidaten = { a: ['abcdef'], b: ['xy'], c: ['egal'] };
    const d = berechneAutoBreitenDetail(spalten, kandidaten, messe, basis);
    const b = berechneAutoBreiten(spalten, kandidaten, messe, basis);
    expect(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.breite]))).toEqual(b);
  });
});
