import { describe, it, expect } from 'vitest';
import {
  kategorienMitDatumsfeldern, kategorieSpaltenSignatur, loeseKategorieSpalten,
} from '@/core/status/kategorie-projektion';
import { toAntragListItem } from '@/core/services/csv/list-view';
import type { Antrag } from '@/core/services/csv/types';
import type { ColumnMapping, CsvSchema } from '@/core/services/csv/types';
import type { MappingVersion, StatusFeldEintrag, StatusKategorie } from '@/core/status/typen';

function schema(mapping: ColumnMapping): CsvSchema {
  return {
    id: 's', programm_id: 'p', csv_source_name: 's', is_master: true,
    priority: 100, join_key: 'aktenzeichen', column_mapping: mapping,
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

const SCHEMA = schema({
  FKZ: { canonical: 'aktenzeichen', type: 'string', required: true },
  D_ZZA: { type: 'date' },
  D_ZZB: { type: 'date' },
  D_ZZTEXT: { type: 'string' },
  D_ZZFREMD: { type: 'date' },
});

function feld(p: Partial<StatusFeldEintrag> & { feldId: string }): StatusFeldEintrag {
  return {
    label: p.feldId, typ: 'datum', ebene: 'tv',
    prominenzDefault: 'normal', aktiv: true, unkuratiert: false, ...p,
  };
}

function kat(id: string, label: string, aktiv = true): StatusKategorie {
  return { id, elternId: null, label, ebene: 'tv', reihenfolge: 10, aktiv };
}

function fassung(felder: StatusFeldEintrag[], kategorien: StatusKategorie[]): MappingVersion {
  return {
    version: 1, autor: null, zeitstempel: '2026-01-01T00:00:00.000Z',
    felder, werte: [], regeln: [], kategorien,
  };
}

const BASIS = fassung(
  [
    feld({ feldId: 'D_ZZA', code: 'ZZA', label: 'Schritt A', kategorieId: 'tv.zz' }),
    feld({ feldId: 'D_ZZB', code: 'ZZB', label: 'Schritt B', kategorieId: 'tv.zz' }),
  ],
  [kat('tv.zz', 'Testordner')],
);

describe('loeseKategorieSpalten', () => {
  it('bündelt die Datumsfelder eines Ordners zu einer Spalte', () => {
    const s = loeseKategorieSpalten(BASIS, [SCHEMA]);
    expect(s).toHaveLength(1);
    expect(s[0]?.label).toBe('Testordner');
    expect(s[0]?.felder.map(f => f.feld)).toEqual(['d_zza', 'd_zzb']);
  });

  it('lässt Textfelder weg — sie tragen keinen Termin, nach dem sich sortieren ließe', () => {
    const v = fassung(
      [feld({ feldId: 'D_ZZTEXT', typ: 'text', code: 'ZZTEXT', kategorieId: 'tv.zz' })],
      [kat('tv.zz', 'Testordner')],
    );
    expect(loeseKategorieSpalten(v, [SCHEMA])).toEqual([]);
  });

  it('lässt stillgelegte Felder, stillgelegte Ordner und „Ignoriert" weg', () => {
    const stillgelegt = fassung(
      [feld({ feldId: 'D_ZZA', kategorieId: 'tv.zz', aktiv: false })],
      [kat('tv.zz', 'Testordner')],
    );
    expect(loeseKategorieSpalten(stillgelegt, [SCHEMA])).toEqual([]);

    const ignoriert = fassung(
      [feld({ feldId: 'D_ZZA', kategorieId: 'tv.zz', prominenzDefault: 'ignoriert' })],
      [kat('tv.zz', 'Testordner')],
    );
    expect(loeseKategorieSpalten(ignoriert, [SCHEMA])).toEqual([]);

    const ordnerAus = fassung(
      [feld({ feldId: 'D_ZZA', kategorieId: 'tv.zz' })],
      [kat('tv.zz', 'Testordner', false)],
    );
    expect(loeseKategorieSpalten(ordnerAus, [SCHEMA])).toEqual([]);
  });

  it('lässt Ordner weg, deren Spalten dieses Programm nicht mappt', () => {
    // Ohne Mapping fiele die Auflösung auf die feldId zurück — die steht in
    // keinem Record, die Spalte bliebe garantiert leer. Sie trotzdem im
    // Spaltenpicker anzubieten wäre Rauschen.
    const v = fassung(
      [feld({ feldId: 'D_GIBTSNICHT', code: 'GIBTSNICHT', kategorieId: 'tv.zz' })],
      [kat('tv.zz', 'Testordner')],
    );
    expect(loeseKategorieSpalten(v, [SCHEMA])).toEqual([]);
  });

  it('nimmt kanonische Felder ohne Code immer mit — sie sind selbst der Record-Key', () => {
    const v = fassung(
      [feld({ feldId: 'antragsdatum', label: 'Antragseingang', kategorieId: 'tv.zz' })],
      [kat('tv.zz', 'Testordner')],
    );
    expect(loeseKategorieSpalten(v, [SCHEMA])[0]?.felder.map(f => f.feld)).toEqual(['antragsdatum']);
  });

  it('ist stabil sortiert', () => {
    const v = fassung(
      [
        feld({ feldId: 'D_ZZA', kategorieId: 'tv.b' }),
        feld({ feldId: 'D_ZZB', kategorieId: 'tv.a' }),
      ],
      [kat('tv.b', 'B'), kat('tv.a', 'A')],
    );
    expect(loeseKategorieSpalten(v, [SCHEMA]).map(s => s.kategorieId)).toEqual(['tv.a', 'tv.b']);
  });
});

describe('kategorieSpaltenSignatur', () => {
  it('ändert sich, wenn ein Ordner umbenannt wird', () => {
    const a = kategorieSpaltenSignatur(loeseKategorieSpalten(BASIS, [SCHEMA]));
    const umbenannt = { ...BASIS, kategorien: [kat('tv.zz', 'Anderer Name')] };
    expect(kategorieSpaltenSignatur(loeseKategorieSpalten(umbenannt, [SCHEMA]))).not.toBe(a);
  });

  it('ändert sich, wenn ein Feld umgehängt wird', () => {
    const a = kategorieSpaltenSignatur(loeseKategorieSpalten(BASIS, [SCHEMA]));
    const umgehaengt: MappingVersion = {
      ...BASIS,
      kategorien: [kat('tv.zz', 'Testordner'), kat('tv.yy', 'Zweiter')],
      felder: BASIS.felder.map(f => (f.feldId === 'D_ZZB' ? { ...f, kategorieId: 'tv.yy' } : f)),
    };
    expect(kategorieSpaltenSignatur(loeseKategorieSpalten(umgehaengt, [SCHEMA]))).not.toBe(a);
  });
});

describe('kategorienMitDatumsfeldern', () => {
  it('bietet nur Ordner an, denen ein aktives Datumsfeld zugeordnet ist', () => {
    const v = fassung(
      [
        feld({ feldId: 'D_ZZA', kategorieId: 'tv.zz' }),
        feld({ feldId: 'D_ZZTEXT', typ: 'text', kategorieId: 'tv.leer' }),
      ],
      [kat('tv.zz', 'Mit Termin'), kat('tv.leer', 'Nur Text')],
    );
    expect(kategorienMitDatumsfeldern(v)).toEqual([{ kategorieId: 'tv.zz', label: 'Mit Termin' }]);
  });
});

describe('toAntragListItem — Ordner-Spalten', () => {
  const antrag = {
    aktenzeichen: 'FKZ1', programm_id: 'p', _updated_at: '2026-01-01T00:00:00.000Z',
    d_zza: '01.02.2026', d_zzb: '05.03.2026',
  } as unknown as Antrag;

  it('schreibt je Ordner das JÜNGSTE Datum samt Feldbezeichnung', () => {
    const spalten = loeseKategorieSpalten(BASIS, [SCHEMA]);
    const item = toAntragListItem(antrag, undefined, spalten);
    expect(item.kat_status).toEqual({ 'tv.zz': { l: 'Schritt B', d: '2026-03-05' } });
  });

  it('schreibt gar nichts, wenn kein Ordner einen Wert hat', () => {
    const leer = { ...antrag, d_zza: '', d_zzb: '' } as unknown as Antrag;
    expect(toAntragListItem(leer, undefined, loeseKategorieSpalten(BASIS, [SCHEMA])).kat_status)
      .toBeUndefined();
  });

  it('bleibt ohne den Parameter unverändert (Alt-Aufrufer)', () => {
    expect(toAntragListItem(antrag).kat_status).toBeUndefined();
  });
});
