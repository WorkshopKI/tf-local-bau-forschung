/**
 * Die Zusage der Faltung: **ein Status ist eine Zeile — und nichts geht dabei
 * verloren.**
 *
 * Derselbe Code steht im Katalog zweimal (TV und Verbund). Bis v4.95 stand er
 * deshalb auch zweimal in der Tabelle, mit identischen Werten in jeder
 * kuratierten Spalte; der Reiter sagte 60, der Baum daneben 30. Gefaltet wird
 * die Anzeige — die Ablage behält beide Zeilen, und wo sie doch einmal
 * auseinanderlaufen, sagt die Zeile das, statt eine der beiden zu verschweigen.
 */
import { describe, it, expect } from 'vitest';
import { baueKatalogZeilen, zaehleStatus, type ZeilenKontext } from '../katalogZeilen';
import { aendereCodeWerte } from '@/core/status';
import type { MappingVersion, StatusWertEintrag } from '@/core/status';

function wert(p: Partial<StatusWertEintrag> & { feldId: string; wert: string }): StatusWertEintrag {
  return {
    id: `${p.feldId}::${p.wert}`, kategorie: 'offen', prominenz: 'normal',
    aktiv: true, unkuratiert: false, ...p,
  } as StatusWertEintrag;
}

/** Ein Code, wie ihn der Katalog führt: einmal am TV-Feld, einmal am Verbund-Feld. */
function paar(code: number, w: string, extra: Partial<StatusWertEintrag> = {}) {
  return [
    wert({ feldId: 'status', wert: w, code, ...extra }),
    wert({ feldId: 'verbund_status', wert: w, code, ...extra }),
  ];
}

const CTX: ZeilenKontext = {
  feldName: id => (id === 'status' ? 'TV-Status' : 'Verbund-Status'),
  csvSpalte: id => (id === 'status' ? 'STATUS_TV' : 'STATUS_VB'),
  phasen: undefined,
  vorkommen: new Map([['status::beantragt', 40], ['verbund_status::beantragt', 2]]),
  zuletzt: new Map([['status::beantragt', '2026-08-01'], ['verbund_status::beantragt', '2026-08-14']]),
  liegezeitVorschlag: new Map(),
};

describe('baueKatalogZeilen — eine Zeile je Status', () => {
  it('faltet TV- und Verbund-Zeile zu einer', () => {
    const zeilen = baueKatalogZeilen(paar(31, 'beantragt'), CTX);
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]!.ebenen).toEqual(['TV', 'Verbund']);
  });

  it('führt die TV-Zeile — sie trägt den Status, den die Regeln lesen', () => {
    const zeilen = baueKatalogZeilen(paar(31, 'beantragt'), CTX);
    expect(zeilen[0]!.w.feldId).toBe('status');
  });

  it('summiert die Vorkommen und nimmt das jüngste Datum', () => {
    // Sonst zeigte die gefaltete Zeile die Zahl EINER ihrer beiden Quellen —
    // eine Angabe über den Status, gerechnet über die Hälfte des Bestands.
    const z = baueKatalogZeilen(paar(31, 'beantragt'), CTX)[0]!;
    expect(z.vorkommen).toBe(42);
    expect(z.zuletzt).toBe('2026-08-14');
  });

  it('meldet keine Abweichung, solange beide Zeilen dasselbe sagen', () => {
    expect(baueKatalogZeilen(paar(31, 'beantragt', { zieltage: 14 }), CTX)[0]!.abweichend)
      .toEqual([]);
  });

  it('nennt die abweichenden Felder, statt eine der beiden Zeilen zu verschweigen', () => {
    const zwei = [
      wert({ feldId: 'status', wert: 'beantragt', code: 31, zieltage: 14 }),
      wert({ feldId: 'verbund_status', wert: 'beantragt', code: 31, zieltage: 30, aktiv: false }),
    ];
    expect(baueKatalogZeilen(zwei, CTX)[0]!.abweichend).toEqual(['Zieltage', 'aktiv']);
  });

  it('lässt einen Wert ohne Code für sich — da gibt es nichts zu falten', () => {
    const ohne = [wert({ feldId: 'status', wert: 'irgendwas' })];
    const z = baueKatalogZeilen(ohne, CTX)[0]!;
    expect(z.eintraege).toHaveLength(1);
    expect(z.abweichend).toEqual([]);
  });

  it('hält zwei verschiedene Codes auseinander', () => {
    expect(baueKatalogZeilen([...paar(31, 'beantragt'), ...paar(32, 'ablehnungsreif')], CTX))
      .toHaveLength(2);
  });
});

describe('zaehleStatus — der Zähler spricht dieselbe Sprache wie der Baum', () => {
  it('zählt Status, nicht Katalogzeilen', () => {
    expect(zaehleStatus([...paar(31, 'a'), ...paar(32, 'b')])).toBe(2);
  });

  it('zählt einen Wert ohne Code einzeln mit', () => {
    expect(zaehleStatus([...paar(31, 'a'), wert({ feldId: 'status', wert: 'x' })])).toBe(2);
  });
});

describe('aendereCodeWerte — eine Änderung trifft beide Katalogzeilen', () => {
  const version = { werte: paar(31, 'beantragt'), felder: [] } as unknown as MappingVersion;

  it('schreibt TV und Verbund gleichzeitig', () => {
    const neu = aendereCodeWerte(version, 31, { zieltage: 21 });
    expect(neu.werte.map(w => w.zieltage)).toEqual([21, 21]);
  });

  it('lässt Identität und Ebene unangetastet', () => {
    const neu = aendereCodeWerte(version, 31, { id: 'kaputt', feldId: 'kaputt', code: 99 } as never);
    expect(neu.werte.map(w => w.feldId)).toEqual(['status', 'verbund_status']);
    expect(neu.werte.every(w => w.code === 31)).toBe(true);
  });

  it('fasst einen fremden Code nicht an', () => {
    const gemischt = {
      werte: [...paar(31, 'a'), ...paar(32, 'b')], felder: [],
    } as unknown as MappingVersion;
    const neu = aendereCodeWerte(gemischt, 31, { aktiv: false });
    expect(neu.werte.map(w => w.aktiv)).toEqual([false, false, true, true]);
  });
});
