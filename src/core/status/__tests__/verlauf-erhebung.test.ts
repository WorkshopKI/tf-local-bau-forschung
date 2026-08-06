/**
 * Die Bilanz des Bestandslaufs — reine Aggregation.
 *
 * Geprüft wird vor allem, dass **Einheiten nicht vermischt** werden: Spuren,
 * Termine und Abschnitte sind drei Grundgesamtheiten, und „Verbund mit Termin"
 * ist etwas anderes als „Verbund mit Statuswechsel". Genau diese Verwechslung
 * hat im ersten Lauf 91 % statt 21 % gemeldet.
 */
import { describe, it, expect } from 'vitest';
import {
  leereBefunde, nimmAuf, c16Treffer, anteil, type VerlaufsSpur,
} from '@/core/status/verlauf';

const LAGE = { art: 'bekannt', form: 'NW' } as const;

function spur(o: Partial<VerlaufsSpur> & Pick<VerlaufsSpur, 'art' | 'zustand'>): VerlaufsSpur {
  return {
    id: 'X', herkunft: 'abgeleitet', segmente: [], uebergaenge: [],
    journalAb: null, projektform: LAGE, ...o,
  };
}

const uebergang = (o: Partial<VerlaufsSpur['uebergaenge'][number]> = {}): VerlaufsSpur['uebergaenge'][number] => ({
  kuerzel: 'AAE', datum: '2024-02-01', rollen: [], rollenLage: 'neutral',
  konfidenz: 'kein_kuerzel', bezeichnung: 'Antragseingang', bezeichnungEindeutig: true, ...o,
});

const segment = (o: Partial<VerlaufsSpur['segmente'][number]> = {}): VerlaufsSpur['segmente'][number] => ({
  statusRef: null, vonDatum: null, bisDatum: null, dauerTage: null, dauerUnsicher: true, ...o,
});

describe('verlauf/erhebung — die Bilanz', () => {
  it('zählt Spuren, Termine und Abschnitte getrennt', () => {
    const b = leereBefunde();
    nimmAuf(b, [
      spur({ art: 'tv', zustand: 'verlauf', uebergaenge: [uebergang(), uebergang()], segmente: [segment()] }),
      spur({ art: 'tv', zustand: 'nicht_beobachtet' }),
      spur({ art: 'verbund', zustand: 'verlauf', uebergaenge: [uebergang()], segmente: [segment(), segment()] }),
    ]);
    expect(b.teilvorhaben).toBe(2);
    expect(b.verbuende).toBe(1);
    expect(b.uebergaenge).toBe(3);
    expect(b.segmente).toBe(3);
    expect(b.zustaendeTv).toEqual({
      verlauf: 1, nicht_beobachtet: 1, kein_bearbeitungsstand: 0, kein_wert_im_csv: 0,
    });
  });

  it('trennt „Verbund mit Termin" von „Verbund mit Statuswechsel"', () => {
    const b = leereBefunde();
    // Ein Verbund mit Terminen, aber ohne belegten Wechsel: der Normalfall.
    nimmAuf(b, [spur({ art: 'verbund', zustand: 'nicht_beobachtet', uebergaenge: [uebergang()] })]);
    nimmAuf(b, [spur({ art: 'verbund', zustand: 'verlauf', uebergaenge: [uebergang()] })]);
    expect(b.verbuendeMitTermin).toBe(2);
    expect(b.verbuendeMitStatuswechsel).toBe(1);
  });

  it('trennt die beiden Abweichungs-Arten, statt sie zu einer Zahl zu addieren', () => {
    const b = leereBefunde();
    nimmAuf(b, [
      spur({
        art: 'tv', zustand: 'verlauf',
        abweichung: { art: 'nicht_ableitbar', erwartet: null, beobachtet: 'Schlussvermerk', datum: '2026-08-06' },
      }),
      spur({
        art: 'tv', zustand: 'verlauf',
        abweichung: { art: 'widerspruch', erwartet: null, beobachtet: 'Widerruf', datum: '2026-08-06' },
      }),
    ]);
    expect(b.abweichungNichtAbleitbar).toBe(1);
    expect(b.abweichungWiderspruch).toBe(1);
  });

  it('merkt sich die längste Spur samt Ebene', () => {
    const b = leereBefunde();
    nimmAuf(b, [spur({ art: 'tv', id: 'kurz', zustand: 'verlauf', uebergaenge: [uebergang()] })]);
    nimmAuf(b, [spur({
      art: 'tv', id: 'lang', zustand: 'verlauf',
      uebergaenge: [uebergang(), uebergang(), uebergang()], segmente: [segment()],
    })]);
    expect(b.laengsteSpur).toEqual({ id: 'lang', art: 'tv', uebergaenge: 3, segmente: 1 });
  });

  it('zählt die Einzelmerkmale eines Übergangs', () => {
    const b = leereBefunde();
    nimmAuf(b, [spur({
      art: 'tv', zustand: 'verlauf',
      uebergaenge: [
        uebergang({ konfidenz: 'trigger_bestaetigt', setztStatus: { roh: 'x', code: null, kurz: 'x', lang: 'x', labelHerkunft: 'ohne' } }),
        uebergang({ scopeUnbestimmt: true }),
        uebergang({ kuerzelHistorisch: 'MVA', kuerzel: 'ÄA' }),
        uebergang({ ausAggregation: { quantor: 'alle', kuerzel: 'PC+', erfuellt: false } }),
        uebergang({ ausAggregation: { quantor: 'kein', kuerzel: 'PC-', erfuellt: null } }),
      ],
    })]);
    expect(b.ohneZielcode).toBe(1);
    expect(b.scopeUnbestimmt).toBe(1);
    expect(b.historischeKuerzel).toBe(1);
    expect(b.aggregationNichtErfuellt).toBe(1);
    expect(b.aggregationNichtPruefbar).toBe(1);
    expect(b.konfidenz.trigger_bestaetigt).toBe(1);
    expect(b.konfidenz.kein_kuerzel).toBe(4);
  });

  it('zählt C16-Treffer je (Programm, Kürzel) — nicht programmübergreifend', () => {
    const tv = new Set(['76|AAE', '78|ABB']);
    const vb = new Set(['76|ABB']);
    expect(c16Treffer(['AAE', 'ABB'], '76', tv, vb)).toEqual({ tv: 1, vb: 1 });
    expect(c16Treffer(['AAE', 'ABB'], '78', tv, vb)).toEqual({ tv: 1, vb: 0 });
    expect(c16Treffer(['AAE'], '47', tv, vb)).toEqual({ tv: 0, vb: 0 });
  });

  it('sagt bei leerer Grundgesamtheit „—", statt durch null zu teilen', () => {
    expect(anteil(0, 0)).toBe('—');
    expect(anteil(1, 4)).toBe('25.0 %');
  });
});
