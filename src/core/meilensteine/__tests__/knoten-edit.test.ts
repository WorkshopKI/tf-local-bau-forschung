import { describe, it, expect } from 'vitest';
import {
  aendereKnoten, entferneKnoten, fuegeKnotenHinzu, hebeKnotenAn, kinderVon,
  naechsteKnotenId, nummeriereNeu, sortiereKnoten, tiefeVon, verschiebeKnoten,
} from '@/core/meilensteine/knoten-edit';
import { baueSpaltenKatalog, bekannteStatusWerte } from '@/core/meilensteine/spalten-katalog';
import type { MeilensteinKnoten } from '@/core/meilensteine/typen';
import type { CsvSchema } from '@/core/services/csv/types';

function k(id: string, elternId: string | null, sortierung: number): MeilensteinKnoten {
  return {
    id, elternId, nummer: '', label: id, sollWoche: 1, relevantFuerFrist: true,
    nurTypen: [], aktiv: true, bedingung: { einige: [] }, sortierung,
  };
}

/** a → (a1 → a1x), b */
const baum = (): MeilensteinKnoten[] => [
  k('a', null, 10), k('b', null, 20), k('a1', 'a', 10), k('a1x', 'a1', 10),
];

describe('Baum-Navigation', () => {
  it('liefert Kinder nach Sortierung', () => {
    expect(kinderVon(baum(), null).map(x => x.id)).toEqual(['a', 'b']);
    expect(kinderVon(baum(), 'a').map(x => x.id)).toEqual(['a1']);
  });

  it('sortiert in Tiefensuche-Reihenfolge', () => {
    expect(sortiereKnoten(baum()).map(x => x.id)).toEqual(['a', 'a1', 'a1x', 'b']);
  });

  it('hängt Waisen hinten an, statt sie zu verschlucken', () => {
    const mitWaise = [...baum(), k('waise', 'gibtesnicht', 10)];
    expect(sortiereKnoten(mitWaise).map(x => x.id)).toContain('waise');
    expect(sortiereKnoten(mitWaise)).toHaveLength(5);
  });

  it('rechnet die Tiefe zyklen-sicher', () => {
    expect(tiefeVon(baum(), 'a')).toBe(0);
    expect(tiefeVon(baum(), 'a1x')).toBe(2);
    expect(tiefeVon([k('x', 'y', 0), k('y', 'x', 0)], 'x')).toBe(1);
  });
});

describe('nummeriereNeu', () => {
  it('leitet die Anzeige-Nummern aus der Baumposition ab', () => {
    const n = new Map(nummeriereNeu(baum()).map(x => [x.id, x.nummer]));
    expect(n.get('a')).toBe('1');
    expect(n.get('a1')).toBe('1.1');
    expect(n.get('a1x')).toBe('1.1.1');
    expect(n.get('b')).toBe('2');
  });
});

describe('naechsteKnotenId', () => {
  it('vergibt die erste freie ID ohne Uhr und ohne Zufall', () => {
    expect(naechsteKnotenId([])).toBe('mst-n1');
    expect(naechsteKnotenId([k('mst-n1', null, 0)])).toBe('mst-n2');
    expect(naechsteKnotenId([k('mst-n2', null, 0)])).toBe('mst-n1');
  });
});

describe('aendereKnoten', () => {
  it('ändert genau einen Knoten und lässt die ID unangetastet', () => {
    const n = aendereKnoten(baum(), 'a1', { label: 'neu', id: 'gehackt' } as Partial<MeilensteinKnoten>);
    const geaendert = n.find(x => x.id === 'a1')!;
    expect(geaendert.label).toBe('neu');
    expect(n.some(x => x.id === 'gehackt')).toBe(false);
  });

  it('ist bei unbekannter ID ein No-op', () => {
    const b = baum();
    expect(aendereKnoten(b, 'gibtesnicht', { label: 'x' })).toBe(b);
  });
});

describe('fuegeKnotenHinzu', () => {
  it('hängt unter dem Elternteil an und erbt Soll-Woche und Typ-Filter', () => {
    const mitTypen = baum().map(x => (x.id === 'a' ? { ...x, sollWoche: 5, nurTypen: ['FuE' as const] } : x));
    const n = fuegeKnotenHinzu(mitTypen, 'a');
    const neu = n.find(x => x.elternId === 'a' && x.id.startsWith('mst-n'))!;
    expect(neu.sollWoche).toBe(5);
    expect(neu.nurTypen).toEqual(['FuE']);
    expect(neu.nummer).toBe('1.2');
  });

  it('legt auf Wurzelebene an, wenn kein Elternteil genannt ist', () => {
    const n = fuegeKnotenHinzu(baum(), null);
    expect(n.find(x => x.id === 'mst-n1')!.nummer).toBe('3');
  });
});

describe('entferneKnoten', () => {
  it('löscht den Knoten samt aller Nachfahren und nummeriert neu', () => {
    const n = entferneKnoten(baum(), 'a');
    expect(n.map(x => x.id)).toEqual(['b']);
    expect(n[0]!.nummer).toBe('1');
  });

  it('lässt Geschwister unangetastet', () => {
    expect(entferneKnoten(baum(), 'a1').map(x => x.id).sort()).toEqual(['a', 'b']);
  });
});

describe('verschiebeKnoten', () => {
  it('tauscht mit dem Nachbarn und nummeriert neu', () => {
    const n = verschiebeKnoten(baum(), 'b', 'hoch');
    expect(sortiereKnoten(n).map(x => x.id)).toEqual(['b', 'a', 'a1', 'a1x']);
    expect(n.find(x => x.id === 'b')!.nummer).toBe('1');
  });

  it('ist am Rand ein No-op', () => {
    const b = baum();
    expect(verschiebeKnoten(b, 'a', 'hoch')).toBe(b);
    expect(verschiebeKnoten(b, 'b', 'runter')).toBe(b);
  });
});

describe('hebeKnotenAn', () => {
  it('macht den Knoten zum Geschwister seines Elternteils — direkt dahinter', () => {
    const n = hebeKnotenAn(baum(), 'a1');
    expect(sortiereKnoten(n).map(x => x.id)).toEqual(['a', 'a1', 'a1x', 'b']);
    expect(n.find(x => x.id === 'a1')!.elternId).toBeNull();
    expect(n.find(x => x.id === 'a1')!.nummer).toBe('2');
    // Der eigene Ast zieht mit, statt zurückzubleiben.
    expect(n.find(x => x.id === 'a1x')!.nummer).toBe('2.1');
  });

  it('hebt aus der dritten Ebene in die zweite, nicht bis nach oben', () => {
    const n = hebeKnotenAn(baum(), 'a1x');
    expect(n.find(x => x.id === 'a1x')!.elternId).toBe('a');
    expect(n.find(x => x.id === 'a1x')!.nummer).toBe('1.2');
  });

  it('ist auf der obersten Ebene und bei unbekannter ID ein No-op', () => {
    const b = baum();
    expect(hebeKnotenAn(b, 'a')).toBe(b);
    expect(hebeKnotenAn(b, 'gibtesnicht')).toBe(b);
  });
});

describe('baueSpaltenKatalog', () => {
  const schema = (id: string, mapping: CsvSchema['column_mapping']): CsvSchema => ({
    id, programm_id: 'P1', csv_source_name: `${id}.csv`, is_master: true,
    join_key: 'aktenzeichen', priority: 1, column_mapping: mapping,
    created_at: '2026-01-01T00:00:00.000Z',
  });

  it('bietet kanonische Felder unter ihrem Key und rohe Spalten unter ihrem Code an', () => {
    const eintraege = baueSpaltenKatalog([
      schema('S1', {
        D_AAE: { canonical: 'antragsdatum', type: 'date', label: 'Antragseingang' },
        D_QS: { custom: 'qs', type: 'date', label: 'QS erledigt' },
      }),
    ]);
    expect(eintraege.map(e => e.feldId)).toEqual(['antragsdatum', 'D_QS']);
    expect(eintraege[0]!.quelle).toBe('kanonisch');
    expect(eintraege[1]!.quelle).toBe('csv');
    expect(eintraege[1]!.label).toBe('QS erledigt');
  });

  it('unterscheidet Datums- von Wert-Spalten (steuert die Operatoren)', () => {
    const eintraege = baueSpaltenKatalog([
      schema('S1', { A: { custom: 'a', type: 'date' }, B: { custom: 'b', type: 'string' } }),
    ]);
    expect(eintraege.find(e => e.feldId === 'A')!.typ).toBe('datum');
    expect(eintraege.find(e => e.feldId === 'B')!.typ).toBe('wert');
  });

  it('verschmilzt dieselbe Spalte aus mehreren Programmen zu einem Eintrag', () => {
    const eintraege = baueSpaltenKatalog([
      schema('S1', { D_QS: { custom: 'qs' } }),
      schema('S2', { D_QS: { custom: 'qs' } }),
    ]);
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0]!.schemaAnzahl).toBe(2);
  });

  it('überspringt ignorierte Spalten', () => {
    expect(baueSpaltenKatalog([schema('S1', { X: { custom: 'x', ignore: true } })])).toEqual([]);
  });
});

describe('bekannteStatusWerte', () => {
  it('liefert den kanonischen Wertevorrat alphabetisch und dublettenfrei', () => {
    const werte = bekannteStatusWerte();
    expect(werte.length).toBeGreaterThan(10);
    expect(new Set(werte).size).toBe(werte.length);
    expect([...werte].sort((a, b) => a.localeCompare(b, 'de'))).toEqual(werte);
  });
});
