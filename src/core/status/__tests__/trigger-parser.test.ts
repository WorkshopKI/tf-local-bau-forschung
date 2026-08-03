/**
 * Der Trigger-Parser gegen die **14 Fixture-Zeilen** aus dem Anhang von
 * `docs/architecture/todo-regeln-ab-seed.md` (Richtlinie 76).
 *
 * Drei Dinge sichern diese Tests ab:
 *
 * 1. die vier erwarteten Satzformen, die die Seed-Doku ausdrücklich nennt
 *    (AAE/1, ABA/1, AAR/2, AAR/3) — an ihnen hängt die Lesbarkeit der ganzen
 *    Status-Erklärung;
 * 2. dass **nichts still verschwindet**: eine unbekannte Prozedur, ein leerer
 *    Parameter oder ein undeutbares Argument darf keine Zeile verschlucken;
 * 3. die **Positionslesung** — acht feste Argumente von vorn. Bis v2.379 las der
 *    Parser von beiden Enden, weil die Pipe-Anzahl aus einem Screenshot
 *    geschätzt war. Die echte Datei hat das entschieden: `<59|ABB|||||40` hat
 *    sieben Argumente und heißt „TV-Status 40, VB unverändert". Von hinten
 *    gelesen käme das Gegenteil heraus. Alle 14 Fixture-Zeilen liefern unter der
 *    neuen Lesart denselben Satz wie bisher.
 */
import { describe, it, expect } from 'vitest';
import {
  parseTriggerZeile, parseTriggerTabelle, parseStatusVergleich, kuerzelListe,
  textbausteinName, referenzierteKuerzel, baueLegende, triggerSatzVon,
  type TriggerRohzeile,
} from '@/core/status/trigger-parser';

/** Die Fixture-Tabelle, 1:1 aus der Seed-Doku (alle aus Richtlinie 76). */
const FIXTURES: TriggerRohzeile[] = ([
  ['AAE', 1, 'TRG_TVs_Status_TV_VB', '<59|ABB|YIRR||||31|31'],
  ['AAE', 2, 'TRG_TVs_Status_TV_VB', '<99|ABB|||||31|'],
  ['AAE', 3, 'TRG.VorgEintragNeu', 'XAAE|210|0'],
  ['AAR', 1, 'TRG_TVs_Status_TV_VB', '<59|ABB|||||73|73'],
  ['AAR', 2, 'TRG.VorgEintragMail', 'TIB|!.055.VorgInfo.01|BIB'],
  ['AAR', 3, 'TRG.VorgEintragNeu', 'AAA|211|0'],
  ['AAR', 4, 'TRG.VorgEintragNeu', 'AZ1|211|0'],
  ['ABA', 1, 'TRG.Status.TV.VB', '211|74'],
  ['ABA', 2, 'TRG.VorgEintragMail', 'PFM|!.055.VorgInfo.01|ZTP'],
  ['ABB', 3, 'TRG.VorgEintragNeu', 'AZ1|211|0'],
  ['ABB', 5, 'TRG.VorgEintragMail', 'ZIM-Assistenz@vdivde-it.de|!.055.VorgInfo.01'],
  ['ABLF', 1, 'TRG.VorgEintragMail', 'ZIM-qs@vdivde-it.de|!.055.VorgInfo.01'],
  ['ABLW', 1, 'TRG_TVs_Status_TV_VB', '<59|ABB|||||75|'],
  ['ABLWR', 1, 'TRG.Status.TV.VB', '210|73'],
] as const).map(([kuerzel, folge, prozedur, parameter]) => ({
  programm: '76', kuerzel, folge, prozedur, parameter,
}));

const satzVon = (r: TriggerRohzeile): string => parseTriggerZeile(r).satz;

/** Kurzform für Einzelfälle: Programm 76, Folge 1. */
const roh = (kuerzel: string, prozedur: string, parameter: string): TriggerRohzeile =>
  ({ programm: '76', kuerzel, folge: 1, prozedur, parameter });

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

  it('AAR/2: Mail mit Textbaustein und CC — beide mit ihrer Rolle', () => {
    expect(satzVon(FIXTURES[4]!)).toBe('Mail an TIB (FB), Textbaustein VorgInfo.01, CC BIB (AB).');
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

  it('behält Programm, Kürzel, Folge und Rohparameter unverändert bei', () => {
    expect(geparst).toHaveLength(FIXTURES.length);
    expect(geparst[10]!.programm).toBe('76');
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

describe('Trigger-Parser — feste Positionen statt Lesen von beiden Enden', () => {
  it('deutet die im Bestand beobachtete Kurzform als „kein VB-Statuswechsel"', () => {
    // `<59|ABB|||||40` — sieben Argumente. Position 7 (VB-Status) fehlt ganz.
    // Von hinten gelesen wäre die 40 der VB-Status und der TV-Status leer —
    // genau die Umkehr, die diesen Umbau ausgelöst hat.
    const p = parseTriggerZeile(roh('AK4', 'TRG_TVs_Status_TV_VB', '<59|ABB|||||40')).geparst;
    expect(p?.art).toBe('statusTvVb');
    if (p?.art === 'statusTvVb') {
      expect(p.statusTv).toBe(40);
      expect(p.statusVb).toBeNull();
    }
  });

  it('führt ein neuntes Argument mit, statt die Zielstatus zu verschieben', () => {
    const p = parseTriggerZeile(
      roh('AAE', 'TRG_TVs_Status_TV_VB', '<59|ABB|YIRR||||31|31|XTRA'),
    ).geparst;
    if (p?.art === 'statusTvVb') {
      expect(p.statusTv).toBe(31);
      expect(p.statusVb).toBe(31);
      expect(p.weitere).toContain('XTRA');
    }
  });

  it('führt ein unerwartetes Argument im Satz mit, statt es zu verschlucken', () => {
    const satz = satzVon(roh('AAE', 'TRG_TVs_Status_TV_VB', '<59|ABB|YIRR|XYZ|||31|31'));
    expect(satz).toContain('weiteres Argument „XYZ"');
  });
});

describe('Trigger-Parser — Zulässigkeitsprüfung (leere Argumente 7/8)', () => {
  // Legacy-Doku: leere Zielstatus in `TRG_TVs_Status_TV_VB` sind gültig und
  // heißen „keine Statusänderung". Die Zeile sagt dann, unter welchen Umständen
  // das Kürzel überhaupt gesetzt werden darf.
  const ZULAESSIG = '<99|||AB||||';

  it('deutet die Zeile, statt sie zu verwerfen', () => {
    const z = parseTriggerZeile(roh('XKS', 'TRG_TVs_Status_TV_VB', ZULAESSIG));
    expect(z.geparst?.art).toBe('statusTvVb');
    if (z.geparst?.art === 'statusTvVb') {
      expect(z.geparst.statusTv).toBeNull();
      expect(z.geparst.statusVb).toBeNull();
      expect(z.geparst.status).toEqual({ op: '<', code: 99 });
      expect(z.geparst.weitere).toContain('AB');
    }
  });

  it('sagt im Satz, dass der Status unverändert bleibt', () => {
    expect(satzVon(roh('XKS', 'TRG_TVs_Status_TV_VB', ZULAESSIG))).toBe(
      'Kürzel nur zulässig, wenn VB-Status vor 99, weiteres Argument „AB"; Status bleibt unverändert.',
    );
  });

  it('nimmt die Bedingungs-Kürzel jetzt in die Katalog-Prüfung auf', () => {
    // Vorher gingen sie mit der verworfenen Deutung verloren.
    const z = parseTriggerZeile(roh('XKS', 'TRG_TVs_Status_TV_VB', '<99|ABB|YIRR|||||'));
    expect(referenzierteKuerzel(z)).toEqual(['XKS', 'ABB', 'YIRR']);
  });

  it('gilt auch für die Kurzform ohne Schluss-Pipes', () => {
    // Fehlende Schluss-Pipes heißen „Argument fehlt" — für die Zielstatus ist
    // das derselbe Fall wie ein leeres Argument.
    const z = parseTriggerZeile(roh('AAE', 'TRG_TVs_Status_TV_VB', '<59|ABB'));
    expect(z.geparst?.art).toBe('statusTvVb');
    expect(z.satz).toBe('Kürzel nur zulässig, wenn VB-Status vor 59, TV hat kein ABB; Status bleibt unverändert.');
  });
});

describe('Trigger-Parser — Komma-Listen sind UND-Listen', () => {
  it('zerlegt die Bedingungs-Argumente und formuliert sie als Aufzählung', () => {
    const z = parseTriggerZeile(roh('AK4', 'TRG_TVs_Status_TV_VB', '<59|ABB,AB,AK4|||||31|31'));
    expect(z.geparst?.art).toBe('statusTvVb');
    if (z.geparst?.art === 'statusTvVb') {
      expect(z.geparst.ohneTvKuerzel).toEqual(['ABB', 'AB', 'AK4']);
    }
    expect(z.satz).toContain('TV hat keines von ABB, AB, AK4');
  });

  it('nennt ein einzelnes Kürzel weiterhin ohne Aufzählungsformel', () => {
    expect(satzVon(FIXTURES[3]!)).toContain('TV hat kein ABB');
  });

  it('nimmt die gesplitteten Kürzel in die Katalog-Prüfung auf', () => {
    const z = parseTriggerZeile(roh('AK4', 'TRG_TVs_Status_TV_VB', '<59|ABB,AB|TTV1,TVB1|ID|||31|31'));
    expect(referenzierteKuerzel(z)).toEqual(['AK4', 'ABB', 'AB', 'TTV1', 'TVB1', 'ID']);
  });

  it('wirft doppelte Nennungen in derselben Liste weg', () => {
    expect(kuerzelListe('ABB, abb ,AB')).toEqual(['ABB', 'AB']);
    expect(kuerzelListe('')).toEqual([]);
    expect(kuerzelListe(undefined)).toEqual([]);
  });
});

describe('Trigger-Parser — Schreibweise und NFC', () => {
  it('behält die Original-Schreibweise der Kürzel bei', () => {
    const z = parseTriggerZeile(roh('ÄK', 'TRG_TVs_Status_TV_VB', '<59|ÄT|||||31|31'));
    expect(z.kuerzel).toBe('ÄK');
    expect(z.satz).toContain('TV hat kein ÄT');
    expect(referenzierteKuerzel(z)).toEqual(['ÄK', 'ÄT']);
  });

  it('normalisiert NFD-Umlaute auf NFC, ohne die Anzeige zu ändern', () => {
    const nfd = 'ÄK'.normalize('NFD');
    const z = parseTriggerZeile(roh(nfd, 'TRG.Status.TV.VB', '211|74'));
    expect(z.kuerzel).toBe('ÄK'.normalize('NFC'));
    expect(z.kuerzel.length).toBe(2);
  });
});

describe('Trigger-Parser — Textbaustein-Legende', () => {
  const legende = baueLegende([
    { kennung: '!.055.VorgInfo.01', text: 'Information über einen neuen Vorgang' },
  ]);

  it('ergänzt den Klartext, wo die Legende ihn kennt', () => {
    const z = parseTriggerZeile(FIXTURES[4]!);
    expect(triggerSatzVon(z, legende)).toBe(
      'Mail an TIB (FB), Textbaustein VorgInfo.01 — Information über einen neuen Vorgang, CC BIB (AB).',
    );
  });

  it('liefert ohne Legende exakt den gespeicherten Satz', () => {
    const z = parseTriggerZeile(FIXTURES[4]!);
    expect(triggerSatzVon(z)).toBe(z.satz);
    expect(triggerSatzVon(z, baueLegende([]))).toBe(z.satz);
  });

  it('baueLegende liefert undefined statt einer leeren Map', () => {
    expect(baueLegende(undefined)).toBeUndefined();
    expect(baueLegende([])).toBeUndefined();
  });
});

describe('Trigger-Parser — Ehrlichkeit bei Unbekanntem', () => {
  it('markiert eine unbekannte Prozedur als nicht interpretiert und behält den Rohtext', () => {
    const z = parseTriggerZeile(roh('XYZ', 'TRG.Irgendwas.Neues', 'a|b|c'));
    expect(z.geparst).toBeNull();
    expect(z.satz).toBe('Nicht interpretiert: a|b|c');
    expect(z.prozedur).toBe('TRG.Irgendwas.Neues');
  });

  it('markiert eine Zeile ohne Bedingung UND ohne Zielstatus als nicht interpretiert', () => {
    // Bis v2.385 galt „kein Zielstatus" allein als Abbruchgrund — damit fielen
    // auch die Zulässigkeits-Zeilen heraus (siehe eigener Block unten). Jetzt
    // muss die Zeile WEDER Bedingung NOCH Wirkung tragen, um stumm zu sein.
    const z = parseTriggerZeile(roh('PFM', 'TRG_TVs_Status_TV_VB', 'PFM!.055.VorgInfo.01'));
    expect(z.geparst).toBeNull();
    expect(z.satz).toBe('Nicht interpretiert: PFM!.055.VorgInfo.01');
  });

  it('benennt auch leere Parameter statt einen leeren Satz zu liefern', () => {
    const z = parseTriggerZeile(roh('AAE', 'TRG.VorgEintragNeu', ''));
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
