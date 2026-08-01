import { describe, it, expect } from 'vitest';
import {
  baueVerbundFelder, zaehleVorkommen, simuliere, verteilung, diffPhasen, zuletztGesehen,
  csvSpaltenJeFeld,
} from '@/core/status/cockpit-berechnung';
import { baueSeedVersion } from '@/core/status/seed';
import { aendereWert } from '@/core/status/katalog-edit';
import { wertId } from '@/core/status/typen';
import type { StatusEvent } from '@/core/status/event-typen';
import type { ColumnMapping, CsvSchema } from '@/core/services/csv/types';

const version = baueSeedVersion();

describe('cockpit-berechnung', () => {
  it('baueVerbundFelder routet ebene-korrekt (verbund_status ← Verbund.status)', () => {
    const vf = baueVerbundFelder(version, 'VB1', { status: 'bewilligt' },
      [{ aktenzeichen: 'AZ1', record: { status: 'gutachten fertig', vb_phase: 3 } }]);
    expect(vf.felder.verbund_status).toBe('bewilligt');
    expect(vf.tvFelder.AZ1?.status).toBe('gutachten fertig');
    expect(vf.tvFelder.AZ1?.vb_phase).toBe('3');
  });

  it('zaehleVorkommen zählt je Verbund einmal (nicht je TV)', () => {
    const alle = [
      baueVerbundFelder(version, 'VB1', {}, [
        { aktenzeichen: 'A', record: { status: 'bewilligt' } },
        { aktenzeichen: 'B', record: { status: 'bewilligt' } },
      ]),
      baueVerbundFelder(version, 'VB2', {}, [{ aktenzeichen: 'C', record: { status: 'beantragt' } }]),
    ];
    const vk = zaehleVorkommen(alle);
    expect(vk.get(wertId('status', 'bewilligt'))).toBe(1);
    expect(vk.get(wertId('status', 'beantragt'))).toBe(1);
  });

  it('simuliere + verteilung', () => {
    const alle = [
      baueVerbundFelder(version, 'VB1', {}, [{ aktenzeichen: 'A', record: { status: 'gutachten fertig' } }]),
      baueVerbundFelder(version, 'VB2', {}, [{ aktenzeichen: 'B', record: { status: 'bewilligt' } }]),
    ];
    const vt = verteilung(simuliere(version, alle));
    expect(vt.fachpruefung).toBe(1);
    expect(vt.bewilligung).toBe(1);
  });

  it('diffPhasen erkennt Phasenwechsel durch Katalog-Edit', () => {
    const alle = [baueVerbundFelder(version, 'VB1', {}, [{ aktenzeichen: 'A', record: { status: 'gutachten fertig' } }])];
    const aktiv = simuliere(version, alle);
    const entwurfVersion = aendereWert(version, wertId('status', 'gutachten fertig'), { spinePhase: 'bewilligung', rang: 40 });
    const d = diffPhasen(aktiv, simuliere(entwurfVersion, alle));
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ verbundId: 'VB1', vorher: 'fachpruefung', nachher: 'bewilligung' });
  });

  it('zuletztGesehen nimmt das jüngste erfasstAm', () => {
    const evs: StatusEvent[] = [
      { id: '1', verbundId: 'v', feldId: 'status', wert: 'bewilligt', erfasstAm: '2026-01-01T00:00:00.000Z', importId: 'i', quelle: 'initial' },
      { id: '2', verbundId: 'v', feldId: 'status', wert: 'bewilligt', erfasstAm: '2026-03-01T00:00:00.000Z', importId: 'i', quelle: 'import' },
    ];
    expect(zuletztGesehen(evs).get(wertId('status', 'bewilligt'))).toBe('2026-03-01T00:00:00.000Z');
  });
});

function schema(id: string, column_mapping: ColumnMapping): CsvSchema {
  return {
    id, programm_id: 'P', csv_source_name: id, is_master: true, join_key: 'aktenzeichen',
    priority: 0, column_mapping, created_at: '2026-01-01T00:00:00.000Z',
  };
}

describe('csvSpaltenJeFeld — Herkunft eines Katalog-Feldes', () => {
  it('bildet das kanonische Feld auf die CSV-Spalte ab', () => {
    const m = csvSpaltenJeFeld([schema('s1', { STATUS: { canonical: 'status' } })]);
    expect(m.get('status')).toEqual(['STATUS']);
  });

  it('sammelt verschieden benannte Spalten mehrerer Programme sortiert und doppelfrei', () => {
    const m = csvSpaltenJeFeld([
      schema('s1', { D_STAT: { canonical: 'status' } }),
      schema('s2', { STATUS: { canonical: 'status' } }),
      schema('s3', { STATUS: { canonical: 'status' } }),
    ]);
    expect(m.get('status')).toEqual(['D_STAT', 'STATUS']);
  });

  it('ignorierte Spalten zählen nicht als Herkunft', () => {
    const m = csvSpaltenJeFeld([schema('s1', { ALT: { canonical: 'status', ignore: true } })]);
    expect(m.has('status')).toBe(false);
  });

  it('ungemappte Spalte ist ihr eigener Key (wie im Meilenstein-Spaltenvorrat)', () => {
    const m = csvSpaltenJeFeld([schema('s1', { D_QS: { type: 'date' } })]);
    expect(m.get('D_QS')).toEqual(['D_QS']);
  });

  /**
   * Beobachtet an `D_AAE` (Antragseingang) und `D_ABB` (Bewilligung): beide sind
   * kanonisch gemappt. Ohne diesen Zweit-Eintrag stünden sie nur unter
   * `antragsdatum`/`bewilligung_datum`, und der Kürzel-Tab meldete für zwei
   * Kernspalten „nicht im Export".
   */
  it('findet eine kanonisch gemappte Spalte AUCH unter ihrem rohen Namen', () => {
    const m = csvSpaltenJeFeld([schema('s1', { D_AAE: { canonical: 'antragsdatum' } })]);
    expect(m.get('antragsdatum')).toEqual(['D_AAE']);
    expect(m.get('D_AAE')).toEqual(['D_AAE']);
  });

  it('vermischt dabei die beiden Sichten nicht', () => {
    const m = csvSpaltenJeFeld([
      schema('s1', { D_AAE: { canonical: 'antragsdatum' } }),
      schema('s2', { EINGANG: { canonical: 'antragsdatum' } }),
    ]);
    // Das kanonische Feld kennt beide Quellen, das Kürzel-Feld nur die eigene.
    expect(m.get('antragsdatum')).toEqual(['D_AAE', 'EINGANG']);
    expect(m.get('D_AAE')).toEqual(['D_AAE']);
  });
});
