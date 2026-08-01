/**
 * Der Trigger-Parser gegen die **14 Fixture-Zeilen** aus dem Anhang von
 * `docs/architecture/todo-regeln-ab-seed.md` (Richtlinie 76).
 *
 * Zwei Dinge sichern diese Tests ab:
 *
 * 1. die vier erwarteten Satzformen, die die Seed-Doku ausdrücklich nennt
 *    (AAE/1, ABA/1, AAR/2, AAR/3) — an ihnen hängt die Lesbarkeit der ganzen
 *    Status-Erklärung;
 * 2. dass **nichts still verschwindet**: eine unbekannte Prozedur, ein leerer
 *    Parameter oder eine abweichende Anzahl leerer Pipes darf keine Zeile
 *    verschlucken. Die Pipe-Anzahl der Fixtures stammt aus einem Screenshot und
 *    wird sich beim ersten echten XLSX-Import als leicht anders herausstellen.
 */
import { describe, it, expect } from 'vitest';
import {
  parseTriggerZeile, parseTriggerTabelle, parseStatusVergleich,
  textbausteinName, referenzierteKuerzel, type TriggerRohzeile,
} from '@/core/status/trigger-parser';

/** Die Fixture-Tabelle, 1:1 aus der Seed-Doku. */
const FIXTURES: TriggerRohzeile[] = [
  { kuerzel: 'AAE', folge: 1, prozedur: 'TRG_TVs_Status_TV_VB', parameter: '<59|ABB|YIRR||||31|31' },
  { kuerzel: 'AAE', folge: 2, prozedur: 'TRG_TVs_Status_TV_VB', parameter: '<99|ABB|||||31|' },
  { kuerzel: 'AAE', folge: 3, prozedur: 'TRG.VorgEintragNeu', parameter: 'XAAE|210|0' },
  { kuerzel: 'AAR', folge: 1, prozedur: 'TRG_TVs_Status_TV_VB', parameter: '<59|ABB|||||73|73' },
  { kuerzel: 'AAR', folge: 2, prozedur: 'TRG.VorgEintragMail', parameter: 'TIB|!.055.VorgInfo.01|BIB' },
  { kuerzel: 'AAR', folge: 3, prozedur: 'TRG.VorgEintragNeu', parameter: 'AAA|211|0' },
  { kuerzel: 'AAR', folge: 4, prozedur: 'TRG.VorgEintragNeu', parameter: 'AZ1|211|0' },
  { kuerzel: 'ABA', folge: 1, prozedur: 'TRG.Status.TV.VB', parameter: '211|74' },
  { kuerzel: 'ABA', folge: 2, prozedur: 'TRG.VorgEintragMail', parameter: 'PFM|!.055.VorgInfo.01|ZTP' },
  { kuerzel: 'ABB', folge: 3, prozedur: 'TRG.VorgEintragNeu', parameter: 'AZ1|211|0' },
  { kuerzel: 'ABB', folge: 5, prozedur: 'TRG.VorgEintragMail', parameter: 'ZIM-Assistenz@vdivde-it.de|!.055.VorgInfo.01' },
  { kuerzel: 'ABLF', folge: 1, prozedur: 'TRG.VorgEintragMail', parameter: 'ZIM-qs@vdivde-it.de|!.055.VorgInfo.01' },
  { kuerzel: 'ABLW', folge: 1, prozedur: 'TRG_TVs_Status_TV_VB', parameter: '<59|ABB|||||75|' },
  { kuerzel: 'ABLWR', folge: 1, prozedur: 'TRG.Status.TV.VB', parameter: '210|73' },
];

const satzVon = (r: TriggerRohzeile): string => parseTriggerZeile(r).satz;

describe('Trigger-Parser — die vier in der Seed-Doku genannten Satzformen', () => {
  it('AAE/1: bedingter Statuswechsel auf TV und VB', () => {
    expect(satzVon(FIXTURES[0]!)).toBe(
      'Wenn VB-Status vor 59, TV hat kein ABB, kein TV des Verbunds hat YIRR '
      + '→ setze TV-Status 31 und VB-Status 31.',
    );
  });

  it('ABA/1: unbedingter Statuswechsel', () => {
    expect(satzVon(FIXTURES[7]!)).toBe('Setze TV-Status (211) auf 74.');
  });

  it('AAR/2: Mail mit Textbaustein und CC', () => {
    expect(satzVon(FIXTURES[4]!)).toBe('Mail an TIB, Textbaustein VorgInfo.01, CC BIB.');
  });

  it('AAR/3: Folge-Vorgangseintrag', () => {
    expect(satzVon(FIXTURES[5]!)).toBe('Vorgangseintrag AAA anlegen (TV-Ebene 211, +0 Tage).');
  });
});

describe('Trigger-Parser — alle 14 Fixture-Zeilen', () => {
  const geparst = parseTriggerTabelle(FIXTURES);

  it('deutet jede Zeile (keine „nicht interpretiert" im Fixture-Satz)', () => {
    const offen = geparst.filter(z => z.geparst === null);
    expect(offen.map(z => `${z.kuerzel}/${z.folge}`)).toEqual([]);
  });

  it('behält Kürzel, Folge und Rohparameter unverändert bei', () => {
    expect(geparst).toHaveLength(FIXTURES.length);
    expect(geparst[10]!.kuerzel).toBe('ABB');
    expect(geparst[10]!.folge).toBe(5);
    expect(geparst[10]!.parameterRoh).toBe('ZIM-Assistenz@vdivde-it.de|!.055.VorgInfo.01');
  });

  it('lässt die CC-Angabe weg, wenn die Zeile keine führt', () => {
    expect(satzVon(FIXTURES[10]!)).toBe(
      'Mail an ZIM-Assistenz@vdivde-it.de, Textbaustein VorgInfo.01.',
    );
  });

  it('meldet einen fehlenden VB-Zielstatus nicht als 0, sondern lässt ihn weg', () => {
    // `<99|ABB|||||31|` — nur der TV-Status wird gesetzt.
    expect(satzVon(FIXTURES[1]!)).toBe(
      'Wenn VB-Status vor 99, TV hat kein ABB → setze TV-Status 31.',
    );
    const p = parseTriggerZeile(FIXTURES[1]!).geparst;
    expect(p?.art).toBe('statusTvVb');
    if (p?.art === 'statusTvVb') {
      expect(p.statusTv).toBe(31);
      expect(p.statusVb).toBeNull();
    }
  });

  it('beschriftet die VB-Ebene 210 als solche', () => {
    expect(satzVon(FIXTURES[13]!)).toBe('Setze VB-Status (210) auf 73.');
    expect(satzVon(FIXTURES[2]!)).toBe('Vorgangseintrag XAAE anlegen (VB-Ebene 210, +0 Tage).');
  });
});

describe('Trigger-Parser — Toleranz gegenüber der Pipe-Anzahl', () => {
  // Die Pipe-Anzahl der Fixtures stammt aus einem Screenshot; die Originaldatei
  // kann mehr oder weniger leere Argumente führen. Gelesen wird deshalb von
  // beiden Enden her.
  const varianten = [
    '<59|ABB|YIRR|||31|31',      // ein leeres Argument weniger
    '<59|ABB|YIRR|||||31|31',    // eines mehr
  ];

  it('liefert für alle Schreibweisen denselben Satz', () => {
    for (const parameter of varianten) {
      expect(satzVon({ kuerzel: 'AAE', folge: 1, prozedur: 'TRG_TVs_Status_TV_VB', parameter }))
        .toBe(
          'Wenn VB-Status vor 59, TV hat kein ABB, kein TV des Verbunds hat YIRR '
          + '→ setze TV-Status 31 und VB-Status 31.',
        );
    }
  });

  it('führt ein unerwartetes Argument im Satz mit, statt es zu verschlucken', () => {
    const satz = satzVon({
      kuerzel: 'AAE', folge: 1, prozedur: 'TRG_TVs_Status_TV_VB',
      parameter: '<59|ABB|YIRR|XYZ|||31|31',
    });
    expect(satz).toContain('weiteres Argument „XYZ"');
  });
});

describe('Trigger-Parser — Ehrlichkeit bei Unbekanntem', () => {
  it('markiert eine unbekannte Prozedur als nicht interpretiert und behält den Rohtext', () => {
    const z = parseTriggerZeile({
      kuerzel: 'XYZ', folge: 1, prozedur: 'TRG.Irgendwas.Neues', parameter: 'a|b|c',
    });
    expect(z.geparst).toBeNull();
    expect(z.satz).toBe('Nicht interpretiert: a|b|c');
    expect(z.prozedur).toBe('TRG.Irgendwas.Neues');
  });

  it('markiert eine bekannte Prozedur mit unbrauchbaren Parametern als nicht interpretiert', () => {
    const z = parseTriggerZeile({
      kuerzel: 'AAE', folge: 1, prozedur: 'TRG_TVs_Status_TV_VB', parameter: '<59|ABB',
    });
    expect(z.geparst).toBeNull();
    expect(z.satz).toBe('Nicht interpretiert: <59|ABB');
  });

  it('benennt auch leere Parameter statt einen leeren Satz zu liefern', () => {
    const z = parseTriggerZeile({ kuerzel: 'AAE', folge: 1, prozedur: 'TRG.VorgEintragNeu', parameter: '' });
    expect(z.satz).toBe('Nicht interpretiert: (keine Parameter)');
  });
});

describe('Trigger-Parser — Hilfsfunktionen', () => {
  it('parseStatusVergleich liest die drei Operatoren', () => {
    expect(parseStatusVergleich('<59')).toEqual({ op: '<', code: 59 });
    expect(parseStatusVergleich(' > 31 ')).toEqual({ op: '>', code: 31 });
    expect(parseStatusVergleich('=99')).toEqual({ op: '=', code: 99 });
    expect(parseStatusVergleich('ABB')).toBeNull();
    expect(parseStatusVergleich('')).toBeNull();
  });

  it('textbausteinName streift die interne Dateinummer ab', () => {
    expect(textbausteinName('!.055.VorgInfo.01')).toBe('VorgInfo.01');
    expect(textbausteinName('VorgInfo.01')).toBe('VorgInfo.01');
  });

  it('referenzierteKuerzel nennt Bedingungs- und Folge-Kürzel, aber keine Mail-Empfänger', () => {
    expect(referenzierteKuerzel(parseTriggerZeile(FIXTURES[0]!))).toEqual(['AAE', 'ABB', 'YIRR']);
    expect(referenzierteKuerzel(parseTriggerZeile(FIXTURES[5]!))).toEqual(['AAR', 'AAA']);
    // TIB/BIB sind Zuständigkeits-Spalten, keine Vorgangskürzel.
    expect(referenzierteKuerzel(parseTriggerZeile(FIXTURES[4]!))).toEqual(['AAR']);
  });
});
