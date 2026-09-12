/**
 * Der Ist-Termin als Satz für genau die Regel, die dasteht — gegen die Regel
 * der Bewertung (v6.59.2): Blatt = frühestes Datum seines Feldes, „alle" = das
 * späteste der Teile, „eine" = das früheste der erfüllten.
 */
import { describe, expect, it } from 'vitest';
import { istDatumsFeldAus, istTerminErklaerung, misstNurZeitpunkt } from '@/core/meilensteine/ist-termin';
import type { SpaltenEintrag } from '@/core/meilensteine/spalten-katalog';
import type { Bedingung } from '@/core/status';

const spalte = (feldId: string, typ: 'datum' | 'wert', label = feldId): SpaltenEintrag => ({
  feldId, label, typ, quelle: 'csv', schemaAnzahl: 1, quellCodes: [],
});
const SPALTEN: SpaltenEintrag[] = [
  spalte('antragsdatum', 'datum', 'Antragseingang'),
  spalte('tib_kuerz', 'wert', 'TIB'),
  spalte('bib_kuerz', 'wert', 'BIB'),
  spalte('akronym', 'wert', 'VB Kurzname'),
  spalte('D_XPC-', 'wert', 'PreCheck negativ'),
];
const istDatum = istDatumsFeldAus(SPALTEN);
const label = (id: string): string => SPALTEN.find(s => s.feldId === id)?.label ?? id;
const g = (feldId: string): Bedingung => ({ feldId, op: 'gefuellt' });

describe('istDatumsFeldAus', () => {
  it('Katalog-Typ oder die D_-Konvention des Fachsystems', () => {
    expect(istDatum('antragsdatum')).toBe(true);
    // Das Inventar führt D_XPC- als „wert" — der Code sagt Datum.
    expect(istDatum('D_XPC-')).toBe(true);
    expect(istDatum('tib_kuerz')).toBe(false);
    expect(istDatum('status')).toBe(false);
  });
});

describe('istTerminErklaerung', () => {
  it('„alle" über zwei gleich gebaute „eine"-Gruppen (MST 3)', () => {
    const b: Bedingung = { alle: [
      { einige: [g('D_XPC+'), g('D_XPC-')], name: 'PreCheck AB' },
      { einige: [g('D_PC+'), g('D_PC-')], name: 'PreCheck FB' },
    ] };
    expect(istTerminErklaerung(b, undefined, label, istDatum)).toEqual({
      keinDatum: false,
      momentaufnahme: false,
      text: 'Hier: das spätere Datum von „PreCheck AB" und „PreCheck FB"; je Gruppe das frühere ihrer gefüllten Datumsspalten.',
    });
  });

  it('„eine" mit datumsloser Bedingung nennt sie (MST 4.3)', () => {
    const b: Bedingung = { einige: [
      { einige: [g('D_AN'), g('D_XABLF'), g('akronym')] },
      { alle: [g('D_ALS'), { einige: [g('D_ALSB')] }] },
    ] };
    expect(istTerminErklaerung(b, undefined, label, istDatum).text).toBe(
      'Hier: das frühere Datum von Gruppe 1 und Gruppe 2, soweit erfüllt; '
      + 'in Gruppe 1 das frühere ihrer gefüllten Datumsspalten; '
      + 'in Gruppe 2 das spätere ihrer gefüllten Datumsspalten. „VB Kurzname" trägt kein Datum.',
    );
  });

  it('ohne jede Datumsspalte ein Befund (MST 2)', () => {
    const r = istTerminErklaerung({ alle: [g('tib_kuerz'), g('bib_kuerz')] }, undefined, label, istDatum);
    expect(r.keinDatum).toBe(true);
    expect(r.momentaufnahme).toBe(false);
    expect(r.text).toContain('keine Datumsspalte');
  });

  /**
   * Der Fall, der 9.074 Teilvorhaben dauerhaft überfällig stellte (MST 5 der
   * Fassung 43): `status ist „Stellungnahme zur Rücknahmeempf."` ist nicht nur
   * termlos, sondern kann nach dem Weiterziehen nie wieder wahr werden. Der
   * Satz muss das sagen, sonst liest er sich wie der harmlose Fall darüber.
   */
  it('nennt den Status-Schnappschuss als eigenen, schärferen Befund (MST 5)', () => {
    const b: Bedingung = { einige: [
      { feldId: 'status', op: 'ist', wert: 'NL eingegangen' },
      { feldId: 'status', op: 'ist', wert: 'Stellungnahme zur Rücknahmeempf.' },
    ] };
    const r = istTerminErklaerung(b, undefined, label, istDatum);
    expect(r.keinDatum).toBe(true);
    expect(r.momentaufnahme).toBe(true);
    expect(r.text).toContain('nur den heutigen Status');
  });

  it('ein Datums-Zweig neben dem Status hebt den Befund auf', () => {
    const b: Bedingung = { einige: [
      g('D_ARW'),
      { feldId: 'status', op: 'ist', wert: 'Stellungnahme zur Rücknahmeempf.' },
    ] };
    const r = istTerminErklaerung(b, undefined, label, istDatum);
    expect(r.keinDatum).toBe(false);
    expect(r.momentaufnahme).toBe(false);
  });

  it('ein eigenes Ist-Termin-Feld gilt vor der Bedingung', () => {
    expect(istTerminErklaerung({ alle: [g('tib_kuerz')] }, 'antragsdatum', label, istDatum)).toEqual({
      keinDatum: false,
      momentaufnahme: false,
      text: 'Datum aus „Antragseingang", über die Teilvorhaben das früheste.',
    });
  });

  it('eine Einzelbedingung, auch als Blatt-Wurzel', () => {
    expect(istTerminErklaerung(g('antragsdatum'), undefined, label, istDatum).text)
      .toBe('Hier: das Datum von „Antragseingang".');
  });

  it('misstNurZeitpunkt: nur „Ist-Termin-Feld gefüllt" — auch in einer Ein-Kind-Gruppe (MST 9)', () => {
    expect(misstNurZeitpunkt(g('antragsdatum'), 'antragsdatum')).toBe(true);
    expect(misstNurZeitpunkt({ alle: [g('antragsdatum')] }, 'antragsdatum')).toBe(true);
    expect(misstNurZeitpunkt({ alle: [g('antragsdatum'), g('tib_kuerz')] }, 'antragsdatum')).toBe(false);
    expect(misstNurZeitpunkt(g('antragsdatum'), undefined)).toBe(false);
    expect(misstNurZeitpunkt({ feldId: 'antragsdatum', op: 'leer' }, 'antragsdatum')).toBe(false);
    expect(misstNurZeitpunkt(g('akronym'), 'antragsdatum')).toBe(false);
  });

  it('drei Teile unter „alle": das späteste', () => {
    expect(istTerminErklaerung({ alle: [g('D_A'), g('D_B'), g('D_C')] }, undefined, label, istDatum).text)
      .toBe('Hier: das späteste Datum von „D_A", „D_B" und „D_C".');
  });
});
