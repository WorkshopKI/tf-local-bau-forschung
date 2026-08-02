/**
 * Die beiden Referenz-Importe gegen echte XLSX-Mappen (im Test gebaut).
 *
 * Der Anlass steht im Modulkopf von `trigger-import.ts`: der erste echte Import
 * hat 2450 Zeilen auf 362 eingedampft, weil das Programm nicht im Schlüssel
 * stand. Diese Tests halten fest, dass das nicht wiederkommt — und dass der
 * Import lieber abbricht als ohne Programm weiterzumachen.
 */
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { importiereTriggerTabelle } from '@/core/status/import/trigger-import';
import { importiereStatusKatalog } from '@/core/status/import/status-katalog-import';
import { STATUS_CODE_KATALOG } from '@/core/status/status-codes';

/** Baut eine XLSX-Mappe aus benannten Blättern (jedes als Zeilen-Matrix). */
function mappe(blaetter: Record<string, string[][]>): File {
  const wb = XLSX.utils.book_new();
  for (const [name, zeilen] of Object.entries(blaetter)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(zeilen), name);
  }
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([buf], 'zuarbeit.xlsx');
}

const TRIGGER_KOPF = ['Richtlinie', 'Kürzel', 'Folge', 'Prozedur', 'Parameter'];

/** Zwei Programme, dieselbe (Kürzel, Folge) — der Fall, der 2088 Zeilen fraß. */
const ZWEI_PROGRAMME = [
  TRIGGER_KOPF,
  ['76', 'AAE', '1', 'TRG_TVs_Status_TV_VB', '<59|ABB|YIRR||||31|31'],
  ['139', 'AAE', '1', 'TRG.Status.TV.VB', '211|59'],
  ['139', 'ABB', '1', 'TRG.Status.TV.VB', '211|74'],
];

const KUERZEL = ['AAE', 'ABB', 'YIRR'];

describe('importiereTriggerTabelle — Programm als Schlüssel-Dimension', () => {
  it('behält dieselbe (Kürzel, Folge) in zwei Programmen und warnt NICHT', async () => {
    const e = await importiereTriggerTabelle(
      mappe({ 'Trigger-Prozeduren': ZWEI_PROGRAMME }), [], KUERZEL,
    );
    expect(e.fehler).toBeUndefined();
    expect(e.zeilen).toHaveLength(3);
    expect(e.warnungen).toEqual([]);
    expect(e.zeilen.filter(z => z.kuerzel === 'AAE').map(z => z.programm)).toEqual(['76', '139']);
  });

  it('zählt Zeilen und Kürzel je Programm', async () => {
    const e = await importiereTriggerTabelle(
      mappe({ 'Trigger-Prozeduren': ZWEI_PROGRAMME }), [], KUERZEL,
    );
    expect(e.jeProgramm).toEqual([
      { programm: '76', zeilen: 1, kuerzel: 1 },
      { programm: '139', zeilen: 2, kuerzel: 2 },
    ]);
  });

  it('warnt weiterhin bei einer echten Dublette INNERHALB eines Programms', async () => {
    const e = await importiereTriggerTabelle(
      mappe({
        'Trigger-Prozeduren': [
          ...ZWEI_PROGRAMME,
          ['139', 'AAE', '1', 'TRG.Status.TV.VB', '211|99'],
        ],
      }),
      [], KUERZEL,
    );
    expect(e.zeilen).toHaveLength(3);
    expect(e.warnungen.join(' ')).toContain('in Programm 139 mehrfach');
  });

  it('vereinheitlicht NFD-Umlaute, statt sie als zwei Kürzel zu führen', async () => {
    const e = await importiereTriggerTabelle(
      mappe({
        'Trigger-Prozeduren': [
          TRIGGER_KOPF,
          ['76', 'ÄK'.normalize('NFC'), '1', 'TRG.Status.TV.VB', '211|59'],
          ['76', 'ÄK'.normalize('NFD'), '1', 'TRG.Status.TV.VB', '211|59'],
        ],
      }),
      [], ['ÄK'],
    );
    expect(e.zeilen).toHaveLength(1);
    expect(e.zeilen[0]?.kuerzel).toBe('ÄK'.normalize('NFC'));
    expect(e.warnungen.join(' ')).toContain('mehrfach');
  });

  it('bricht ab, wenn die Programm-Spalte ganz fehlt — statt teilzuimportieren', async () => {
    const e = await importiereTriggerTabelle(
      mappe({
        'Trigger-Prozeduren': [
          ['Kürzel', 'Folge', 'Prozedur', 'Parameter'],
          ['AAE', '1', 'TRG.Status.TV.VB', '211|59'],
        ],
      }),
      [], KUERZEL,
    );
    expect(e.zeilen).toEqual([]);
    expect(e.fehler).toContain('Richtlinie');
    expect(e.fehler).toContain('Trigger-Prozeduren');
  });

  it('überspringt eine Zeile ohne Programmwert und sagt es', async () => {
    const e = await importiereTriggerTabelle(
      mappe({
        'Trigger-Prozeduren': [
          TRIGGER_KOPF,
          ['', 'AAE', '1', 'TRG.Status.TV.VB', '211|59'],
          ['76', 'ABB', '1', 'TRG.Status.TV.VB', '211|74'],
        ],
      }),
      [], KUERZEL,
    );
    expect(e.zeilen).toHaveLength(1);
    expect(e.warnungen.join(' ')).toContain('ohne Programm-Angabe');
  });
});

describe('importiereTriggerTabelle — Ehrlichkeit über den Rest', () => {
  it('listet nicht interpretierte Zeilen konkret, statt sie nur zu zählen', async () => {
    const e = await importiereTriggerTabelle(
      mappe({
        'Trigger-Prozeduren': [
          TRIGGER_KOPF,
          ['76', 'AAE', '1', 'TRG.Status.TV.VB', '211|59'],
          ['76', 'ZZZ', '2', 'TRG.Neu.Unbekannt', 'a|b|c'],
        ],
      }),
      [], KUERZEL,
    );
    expect(e.nichtInterpretiert).toEqual([
      { programm: '76', kuerzel: 'ZZZ', folge: 2, parameterRoh: 'a|b|c' },
    ]);
  });

  it('meldet Kürzel, die der Katalog nicht kennt — inklusive der Komma-Listen', async () => {
    const e = await importiereTriggerTabelle(
      mappe({
        'Trigger-Prozeduren': [
          TRIGGER_KOPF,
          ['76', 'AAE', '1', 'TRG_TVs_Status_TV_VB', '<59|ABB,TTV1|TVB1|ID|||31|31'],
        ],
      }),
      [], KUERZEL,
    );
    expect(e.unbekannteKuerzel).toEqual(['ID', 'TTV1', 'TVB1']);
  });

  it('nennt Programme des Bestands, für die die Datei schweigt — mit Antragszahl', async () => {
    const e = await importiereTriggerTabelle(
      mappe({ 'Trigger-Prozeduren': ZWEI_PROGRAMME }), [], KUERZEL,
      [{ programm: '76', antraege: 12 }, { programm: '137', antraege: 340 }],
    );
    expect(e.programmeOhneTrigger).toEqual([{ programm: '137', antraege: 340 }]);
  });
});

describe('leseXlsxTabelle — Blattwahl', () => {
  it('nimmt das benannte Blatt, auch wenn ein früheres passen würde', async () => {
    const e = await importiereTriggerTabelle(
      mappe({
        Entwurf: [TRIGGER_KOPF, ['76', 'ALT', '1', 'TRG.Status.TV.VB', '211|11']],
        'Trigger-Prozeduren': [TRIGGER_KOPF, ['76', 'NEU', '1', 'TRG.Status.TV.VB', '211|59']],
      }),
      [], ['ALT', 'NEU'],
    );
    expect(e.zeilen.map(z => z.kuerzel)).toEqual(['NEU']);
  });

  it('durchsucht alle Blätter, wenn der Name nicht passt', async () => {
    const e = await importiereTriggerTabelle(
      mappe({ Irgendwas: [TRIGGER_KOPF, ['76', 'AAE', '1', 'TRG.Status.TV.VB', '211|59']] }),
      [], KUERZEL,
    );
    expect(e.zeilen).toHaveLength(1);
  });

  it('nennt im Fehlerfall die Blätter der Mappe', async () => {
    const e = await importiereTriggerTabelle(
      mappe({ Deckblatt: [['Titel'], ['ZIM-Zuarbeit']], Notizen: [['a'], ['b']] }),
      [], KUERZEL,
    );
    expect(e.fehler).toContain('Deckblatt');
    expect(e.fehler).toContain('Notizen');
  });
});

/**
 * Das echte Blatt: Spalte A Wert, B Erklärung, C Kategorie („Status" /
 * „Bearbeiter" / leer), Zeile 1 nur Beschriftung. Es hat KEINE Kopfzeile im
 * Sinne der Alias-Suche — bis v2.380 brach der Import genau daran ab.
 */
const LEGENDE = [
  ['Inhalt Parameter', 'Erklärung', ''],
  ['210', 'Zuordnung zum Verbund', ''],
  ['211', 'Zuordnung zum Teilvorhaben', ''],
  ['BIB', 'Bearbeiter Inland', 'Bearbeiter'],
  ['TIB', 'technischer Bearbeiter', 'Bearbeiter'],
  ['XYZ', 'unbekanntes Kürzel der Zuarbeit', 'Bearbeiter'],
  ['31', 'beantragt', 'Status'],
  ['59', 'bewilligt', 'Status'],
  ['99', 'Schlussvermerk', 'Status'],
  ['!.055.VorgInfo.01', 'Information über einen neuen Vorgang', ''],
];

describe('importiereStatusKatalog — Legenden-Format „Erklärung Parameter"', () => {
  it('liest das Blatt ohne Kopfzeile und verwirft die Beschriftungszeile', async () => {
    const e = await importiereStatusKatalog(mappe({ 'Erklärung Parameter': LEGENDE }), []);
    expect(e.fehler).toBeUndefined();
    expect(e.format).toBe('legende');
    expect(e.blatt).toBe('Erklärung Parameter');
    expect(e.eintraege.map(x => x.code)).toEqual([31, 59, 99]);
    expect(e.textbausteine).toEqual([
      { kennung: '!.055.VorgInfo.01', text: 'Information über einen neuen Vorgang' },
    ]);
    // BIB/TIB kennt `MAIL_ROLLE`, XYZ nicht — nur das Unbekannte wird gemeldet.
    expect(e.unbekannteBearbeiter).toEqual(['XYZ']);
  });

  it('macht aus 210/211 KEINE Statuscodes — dort entscheidet die Kategorie-Spalte', async () => {
    const e = await importiereStatusKatalog(mappe({ 'Erklärung Parameter': LEGENDE }), []);
    expect(e.eintraege.map(x => x.code)).not.toContain(210);
    expect(e.eintraege.map(x => x.code)).not.toContain(211);
    expect(e.bilanz.zuordnung).toBe(2);
  });

  it('hält die Bezugsdatei-Nummern gegen unsere erschlossene Lesart', async () => {
    const e = await importiereStatusKatalog(mappe({ 'Erklärung Parameter': LEGENDE }), []);
    expect(e.ebenenHinweise).toEqual([
      { wert: '210', text: 'Zuordnung zum Verbund', unsereLesart: 'VB' },
      { wert: '211', text: 'Zuordnung zum Teilvorhaben', unsereLesart: 'TV' },
    ]);
  });

  it('zählt jede gelesene Zeile in genau einen Topf — die Beschriftung in keinen', async () => {
    const e = await importiereStatusKatalog(mappe({ 'Erklärung Parameter': LEGENDE }), []);
    expect(e.bilanz).toEqual({
      status: 3, bearbeiter: 3, textbaustein: 1, zuordnung: 2, unklar: 0,
    });
    const summe = Object.values(e.bilanz).reduce((a, b) => a + b, 0);
    expect(summe).toBe(LEGENDE.length - 1);
  });

  it('erkennt das Format auch, wenn das Blatt anders heißt', async () => {
    const e = await importiereStatusKatalog(mappe({ Tabelle1: LEGENDE }), []);
    expect(e.format).toBe('legende');
    expect(e.blatt).toBe('Tabelle1');
    expect(e.eintraege).toHaveLength(3);
  });

  it('ergibt gegen den Seed einen leeren Diff — die Zusage der Nacharbeit', async () => {
    const alsLegende = [
      ['Inhalt Parameter', 'Erklärung', ''],
      ...STATUS_CODE_KATALOG.map(e => [String(e.code), e.text, 'Status']),
    ];
    const e = await importiereStatusKatalog(
      mappe({ 'Erklärung Parameter': alsLegende }), STATUS_CODE_KATALOG,
    );
    expect(e.eintraege).toHaveLength(STATUS_CODE_KATALOG.length);
    expect(e.diff?.leer).toBe(true);
  });
});

describe('importiereStatusKatalog — Kopfzeilen-Variante bleibt gültig', () => {
  const PARAMETER = [
    ['Parameter', 'Bedeutung'],
    ['31', 'beantragt'],
    ['59', 'bewilligt'],
    ['TIB', 'technischer Bearbeiter'],
    ['XYZ', 'unbekanntes Kürzel der Zuarbeit'],
    ['!.055.VorgInfo.01', 'Information über einen neuen Vorgang'],
  ];

  it('trennt Statuscodes, Bearbeiter und Textbausteine ohne Kategorie-Spalte', async () => {
    const e = await importiereStatusKatalog(mappe({ 'Erklärung Parameter': PARAMETER }), []);
    expect(e.fehler).toBeUndefined();
    expect(e.format).toBe('kopf');
    expect(e.eintraege.map(x => x.code)).toEqual([31, 59]);
    expect(e.textbausteine).toEqual([
      { kennung: '!.055.VorgInfo.01', text: 'Information über einen neuen Vorgang' },
    ]);
    // TIB kennt `MAIL_ROLLE`, XYZ nicht — nur das Unbekannte wird gemeldet.
    expect(e.unbekannteBearbeiter).toEqual(['XYZ']);
  });

  it('lässt eine Kategorie-Spalte entscheiden, wo sie vorhanden ist', async () => {
    const e = await importiereStatusKatalog(
      mappe({
        'Erklärung Parameter': [
          ['Kategorie', 'Parameter', 'Bedeutung'],
          ['Status', '31', 'beantragt'],
          ['Bearbeiter', 'BIB', 'Bearbeiter Inland'],
          ['Textbaustein', '!.055.VorgInfo.01', 'Neuer Vorgang'],
        ],
      }),
      [],
    );
    expect(e.format).toBe('kopf');
    expect(e.eintraege.map(x => x.code)).toEqual([31]);
    expect(e.textbausteine).toHaveLength(1);
    expect(e.unbekannteBearbeiter).toEqual([]);
  });

  it('meldet Zeilen, die sich keiner Art zuordnen lassen', async () => {
    const e = await importiereStatusKatalog(
      mappe({
        'Erklärung Parameter': [
          ['Parameter', 'Bedeutung'],
          ['31', 'beantragt'],
          ['ein längerer Freitext ohne Art', 'irgendwas'],
        ],
      }),
      [],
    );
    expect(e.eintraege).toHaveLength(1);
    expect(e.warnungen.join(' ')).toContain('keiner Art zuordnen');
  });
});
