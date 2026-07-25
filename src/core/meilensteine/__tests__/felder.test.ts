import { describe, it, expect } from 'vitest';
import {
  baueMeilensteinKontext, benoetigteFelder, feldRefsAusBedingung, feldRefsAusKnoten, loeseFelderAuf,
} from '@/core/meilensteine/felder';
import { baueSeedPlan } from '@/core/meilensteine/seed';
import type { CsvSchema } from '@/core/services/csv/types';
import type { Bedingung } from '@/core/status';

function schema(mapping: CsvSchema['column_mapping']): CsvSchema {
  return {
    id: 'S1', programm_id: 'P1', csv_source_name: 'test.csv', is_master: true,
    join_key: 'aktenzeichen', priority: 1, column_mapping: mapping,
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

describe('feldRefsAusBedingung', () => {
  it('sammelt verschachtelte Referenzen dedupliziert in stabiler Reihenfolge', () => {
    const b: Bedingung = {
      alle: [
        { einige: [{ feldId: 'b', op: 'gefuellt' }, { feldId: 'a', op: 'gefuellt' }] },
        { feldId: 'b', op: 'leer' },
        { feldId: 'c', op: 'ist', wert: 'x' },
      ],
    };
    expect(feldRefsAusBedingung(b)).toEqual(['b', 'a', 'c']);
  });

  it('nimmt das istDatumFeld eines Knotens mit auf', () => {
    const k = baueSeedPlan().knoten.find(x => x.id === 'mst-6')!;
    expect(feldRefsAusKnoten(k)).toEqual(['bewilligung_datum']);
  });
});

describe('benoetigteFelder', () => {
  it('deckt kanonische Felder und rohe CSV-Codes des Auslieferungs-Plans ab', () => {
    const felder = benoetigteFelder(baueSeedPlan());
    expect(felder).toContain('antragsdatum');
    expect(felder).toContain('tib_kuerz');
    expect(felder).toContain('status');
    expect(felder).toContain('bewilligung_datum');
    expect(felder).toContain('D_PC+');
    expect(felder).toContain('D_QS');
    expect(new Set(felder).size).toBe(felder.length);
  });
});

describe('loeseFelderAuf', () => {
  const s = schema({
    'D_QS': { canonical: undefined, custom: 'qs_datum', type: 'date', label: 'QS erledigt' },
    'D_PC+': { custom: 'precheck_positiv', type: 'date' },
    'D_AAE': { canonical: 'antragsdatum', type: 'date' },
  });

  it('mappt CSV-Codes auf den tatsächlichen Record-Key samt Schema-Label', () => {
    const [qs] = loeseFelderAuf([s], ['D_QS']);
    expect(qs).toEqual({ feldId: 'D_QS', recordKey: 'qs_datum', label: 'QS erledigt', viaSpaltenCode: true });
  });

  it('lässt kanonische Feld-Keys unverändert (Identität)', () => {
    const [status] = loeseFelderAuf([s], ['status']);
    expect(status).toEqual({ feldId: 'status', recordKey: 'status', label: 'status', viaSpaltenCode: false });
  });

  it('macht aus einem unbekannten CSV-Code einen nie gefüllten Key statt zu werfen', () => {
    const [unbekannt] = loeseFelderAuf([s], ['D_GIBTESNICHT']);
    expect(unbekannt!.recordKey).toBe('D_GIBTESNICHT');
    expect(unbekannt!.viaSpaltenCode).toBe(false);
  });

  it('erhält die Reihenfolge der Anfrage', () => {
    expect(loeseFelderAuf([s], ['status', 'D_QS', 'D_PC+']).map(f => f.feldId))
      .toEqual(['status', 'D_QS', 'D_PC+']);
  });
});

describe('baueMeilensteinKontext', () => {
  const aufloesung = loeseFelderAuf(
    [schema({ 'D_QS': { custom: 'qs_datum', type: 'date' } })],
    ['status', 'D_QS', 'antragsdatum'],
  );

  it('legt Werte unter der feldId der Bedingung ab, nicht unter dem Record-Key', () => {
    const ctx = baueMeilensteinKontext(aufloesung, {}, [
      { aktenzeichen: 'AZ-1', record: { qs_datum: '01.03.2026', antragsdatum: '05.01.2026' } },
    ]);
    expect(ctx.get('D_QS')).toEqual(['01.03.2026']);
    expect(ctx.get('qs_datum')).toBeUndefined();
  });

  it('sammelt Verbund- und Teilvorhaben-Werte zusammen', () => {
    const ctx = baueMeilensteinKontext(
      aufloesung,
      { status: 'bewilligt' },
      [
        { aktenzeichen: 'AZ-1', record: { status: 'beantragt' } },
        { aktenzeichen: 'AZ-2', record: { status: 'bewilligt' } },
      ],
    );
    expect(ctx.get('status')).toEqual(['bewilligt', 'beantragt', 'bewilligt']);
  });

  it('überspringt leere Werte und konvertiert Zahlen', () => {
    const mitZahl = loeseFelderAuf([], ['vb_phase', 'leer']);
    const ctx = baueMeilensteinKontext(mitZahl, {}, [
      { aktenzeichen: 'AZ-1', record: { vb_phase: 3, leer: '   ' } },
    ]);
    expect(ctx.get('vb_phase')).toEqual(['3']);
    expect(ctx.get('leer')).toBeUndefined();
  });
});
