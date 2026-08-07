/**
 * Die **XLSX-Veredelung** — geprüft, indem das erzeugte Archiv wieder
 * ausgepackt wird.
 *
 * Warum so und nicht über Zusicherungen am Aufruf: der Eingriff schreibt rohes
 * OOXML in ein ZIP. Ein Tippfehler im XML fällt nirgends auf — bis jemand die
 * Datei doppelklickt und Excel sie verweigert. Hier wird deshalb das Ergebnis
 * gelesen, nicht die Absicht.
 *
 * Der Rundlauf `XLSX.read` ist die zweite Hälfte der Zusage: Formatierung nützt
 * nichts, wenn die Datei dabei ihre Daten verliert. Was er NICHT beweist, ist
 * dass Excel sie öffnet — das bleibt ein Handtest.
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import type { Blatt } from '@/core/status/export/arbeitsmappe';
import {
  baueVeredelteMappe, veredeleBlattXml, spaltenName, worksheetKinder, WORKSHEET_FOLGE,
  type BlattVeredelung,
} from '@/core/status/export/arbeitsmappe-veredelung';

const BLATT: Blatt = {
  name: 'Fragen',
  kopf: ['Klärfragen', 'Bestand vom 07.08.2026'],
  spalten: ['ID', 'Frage', 'Kontext', 'Antwort'],
  zeilen: [
    ['a-1', 'Was gilt?', 'Ein langer Kontext, der umbrechen muss.', ''],
    ['a-2', 'Und hier?', 'Noch einer.', ''],
  ],
};

// Kopf (2 Zeilen) + Leerzeile + Spaltenzeile = Zeile 4; Daten ab 5.
const V: BlattVeredelung = {
  kopfZeile: 4, letzteZeile: 6, letzteSpalte: 4,
  breiten: [12, 40, 60, 30],
  umbruch: [2, 3],
  antwort: [4],
  validierungen: [{ zeile: 5, spalte: 4, optionen: ['ja', 'nein', 'unklar'] }],
};

async function baue(
  blaetter: readonly Blatt[] = [BLATT], v: readonly BlattVeredelung[] = [V],
): Promise<{ zip: JSZip; blatt: string; stile: string; ausgelassen: number }> {
  const { zip, bericht } = await baueVeredelteMappe(blaetter, v);
  return {
    zip,
    blatt: (await zip.file('xl/worksheets/sheet1.xml')!.async('string')),
    stile: (await zip.file('xl/styles.xml')!.async('string')),
    ausgelassen: bericht.validierungenAusgelassen,
  };
}

describe('spaltenName', () => {
  it('rechnet über die Buchstabengrenze hinaus', () => {
    expect([1, 4, 26, 27, 28, 52, 53].map(spaltenName))
      .toEqual(['A', 'D', 'Z', 'AA', 'AB', 'AZ', 'BA']);
  });
});

describe('Was im Archiv ankommt', () => {
  it('friert die Kopfzeile ein', async () => {
    const { blatt } = await baue();
    expect(blatt).toContain('<pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/>');
    // Das selbstschließende Element muss geöffnet worden sein, sonst steht der
    // Pane außerhalb seines Elternknotens.
    expect(blatt).not.toMatch(/<sheetView[^>]*\/>/);
    expect(blatt).toContain('</sheetView>');
  });

  it('setzt Autofilter über die Spaltenzeile bis zur letzten Datenzeile', async () => {
    const { blatt } = await baue();
    expect(blatt).toContain('<autoFilter ref="A4:D6"/>');
  });

  it('gibt Sortieren und Filtern unter dem Blattschutz ausdrücklich frei', async () => {
    const { blatt } = await baue();
    const schutz = /<sheetProtection[^>]*\/>/.exec(blatt)?.[0] ?? '';
    expect(schutz).toContain('sheet="1"');
    // Ohne diese beiden wäre der Autofilter darüber unter Schutz tot.
    expect(schutz).toContain('sort="0"');
    expect(schutz).toContain('autoFilter="0"');
  });

  it('entsperrt genau die Antwortspalte', async () => {
    const { blatt, stile } = await baue();
    // Stil 2 trägt die Entsperrung …
    expect(stile).toContain('<protection locked="0"/>');
    expect(stile.match(/<protection locked="0"\/>/g)).toHaveLength(1);
    // … und liegt an D5/D6, nicht an A5.
    expect(blatt).toContain('<c r="D5" s="2"');
    expect(blatt).toContain('<c r="D6" s="2"');
    expect(blatt).not.toMatch(/<c r="A5"[^>]*s="2"/);
  });

  it('gibt Frage und Kontext Zeilenumbruch, dem Rest nicht', async () => {
    const { blatt, stile } = await baue();
    expect(stile).toContain('wrapText="1"');
    expect(blatt).toContain('<c r="B5" s="1"');
    expect(blatt).toContain('<c r="C5" s="1"');
    expect(blatt).not.toMatch(/<c r="A5"[^>]*s=/);      // ID bleibt schmucklos
  });

  it('lässt den Erhebungskopf über der Spaltenzeile unberührt', async () => {
    const { blatt } = await baue();
    expect(blatt).not.toMatch(/<c r="A[12]"[^>]*s=/);
  });

  it('hängt die Auswahlliste an die richtige Zelle, ohne sie zu erzwingen', async () => {
    const { blatt } = await baue();
    expect(blatt).toContain('sqref="D5"');
    expect(blatt).toContain('&quot;ja,nein,unklar&quot;');
    // Angebot, kein Zwang: eine nicht vorgesehene Antwort muss möglich bleiben.
    expect(blatt).toContain('showErrorMessage="0"');
  });

  it('setzt die Spaltenbreiten', async () => {
    const { blatt } = await baue();
    expect(blatt).toContain('<cols>');
    expect(blatt).toMatch(/<col[^>]*width="/);
  });
});

describe('Schema-Reihenfolge', () => {
  const nurValidierung = (xml: string): string => veredeleBlattXml(xml, {
    ...V, kopfZeile: 1, letzteZeile: 1, letzteSpalte: 1, breiten: [], umbruch: [], antwort: [],
    validierungen: [{ zeile: 2, spalte: 1, optionen: ['a'] }],
  }).xml;

  it('setzt dataValidations VOR das nächste zulässige Element', () => {
    const out = nurValidierung('<worksheet><sheetData/><pageMargins left="0"/></worksheet>');
    expect(out.indexOf('<dataValidations')).toBeLessThan(out.indexOf('<pageMargins'));
  });

  it('setzt es auch vor ein Element, das SCHEMATISCH später kommt (Regression)', () => {
    // Der Fehler, der Excel die Datei verweigern ließ: SheetJS schreibt
    // `<ignoredErrors>` immer, im Schema kommt es NEUN Plätze nach
    // dataValidations — und weil es in der Ankerliste fehlte, landete der Block
    // dahinter. Excel meldete „Problem bei einigen Inhalten".
    const out = nurValidierung(
      '<worksheet><sheetData/><ignoredErrors><ignoredError sqref="A1"/></ignoredErrors></worksheet>',
    );
    expect(out.indexOf('<dataValidations')).toBeLessThan(out.indexOf('<ignoredErrors'));
  });

  it('fällt auf das Dokumentende zurück, wenn kein Nachfolger da ist', () => {
    const out = nurValidierung('<worksheet><sheetData/></worksheet>');
    expect(out.indexOf('<dataValidations')).toBeLessThan(out.indexOf('</worksheet>'));
  });

  it('hält die ganze Sequenz der ECHTEN Ausgabe schema-konform', async () => {
    // Der Test, der gefehlt hat. Die Fälle oben laufen gegen selbstgebautes XML
    // und sehen nie, was SheetJS wirklich schreibt; erst diese Prüfung an der
    // erzeugten Datei fängt ein Element, an das niemand gedacht hat.
    const { blatt } = await baue();
    const kinder = worksheetKinder(blatt);
    expect(kinder).toContain('dataValidations');
    expect(kinder).toContain('ignoredErrors');
    const raenge = kinder.map(k => WORKSHEET_FOLGE.indexOf(k));
    expect(raenge).not.toContain(-1);                       // nichts Unbekanntes
    expect(raenge).toEqual([...raenge].sort((a, b) => a - b));
  });
});

describe('Grenzen werden gemeldet, nicht verschluckt', () => {
  it('lässt eine zu lange Auswahlliste aus und zählt sie', async () => {
    const lang = Array.from({ length: 40 }, (_, i) => `Antwortmöglichkeit Nummer ${i}`);
    const { blatt, ausgelassen } = await baue([BLATT], [{
      ...V, validierungen: [{ zeile: 5, spalte: 4, optionen: lang }],
    }]);
    expect(ausgelassen).toBe(1);
    expect(blatt).not.toContain('<dataValidations');
  });

  it('ersetzt Kommas in Optionen, statt die Liste zu zerlegen', async () => {
    const { blatt } = await baue([BLATT], [{
      ...V, validierungen: [{ zeile: 5, spalte: 4, optionen: ['ja, sicher', 'nein'] }],
    }]);
    expect(blatt).toContain('&quot;ja; sicher,nein&quot;');
  });
});

describe('Die Datei bleibt eine Datei', () => {
  it('ist nach der Veredelung weiterhin lesbar und trägt dieselben Daten', async () => {
    const { zip } = await baue();
    const roh = await zip.generateAsync({ type: 'uint8array' });
    const gelesen = XLSX.read(roh, { type: 'array' });
    expect(gelesen.SheetNames).toEqual(['Fragen']);
    const zeilen = XLSX.utils.sheet_to_json<string[]>(gelesen.Sheets.Fragen!, { header: 1 });
    expect(zeilen[3]).toEqual(['ID', 'Frage', 'Kontext', 'Antwort']);
    expect(zeilen[4]?.[1]).toBe('Was gilt?');
  });

  it('trägt eine Stiltabelle, die ein Leser auch auswerten kann', async () => {
    // Der Rundlauf oben parst die Blatt-XML, nicht die Stile — `cellStyles`
    // zwingt den Leser durch `styles.xml`. Ohne diesen Fall bliebe die eine
    // Datei ungeprüft, die hier komplett neu geschrieben wird.
    //
    // Der Community-Leser gibt von einem Stil nur die FÜLLUNG heraus, nicht
    // Alignment oder Protection; die stehen im XML (Fälle oben). Dass die
    // Füllung an der erwarteten Zelle ankommt, beweist aber, dass die Tabelle
    // gelesen und der Index richtig zugeordnet wurde — und nur das ist hier zu
    // zeigen.
    type Gefuellt = { s?: { patternType?: string; fgColor?: { rgb?: string } } };
    const { zip } = await baue();
    const roh = await zip.generateAsync({ type: 'uint8array' });
    const blatt = XLSX.read(roh, { type: 'array', cellStyles: true }).Sheets.Fragen;
    expect((blatt?.D5 as Gefuellt | undefined)?.s).toMatchObject({
      patternType: 'solid', fgColor: { rgb: 'FFF2CC' },
    });
    expect((blatt?.A5 as Gefuellt | undefined)?.s?.patternType).toBe('none');
  });

  it('verkraftet mehrere Blätter', async () => {
    const zweitesBlatt: Blatt = { name: 'Hinweise', kopf: [], spalten: ['Hinweis'], zeilen: [['Lesen.']] };
    const zweitesV: BlattVeredelung = {
      kopfZeile: 1, letzteZeile: 2, letzteSpalte: 1, breiten: [80], umbruch: [1], antwort: [],
    };
    const { zip } = await baue([BLATT, zweitesBlatt], [V, zweitesV]);
    const zwei = await zip.file('xl/worksheets/sheet2.xml')!.async('string');
    expect(zwei).toContain('<pane ySplit="1"');
    const gelesen = XLSX.read(await zip.generateAsync({ type: 'uint8array' }), { type: 'array' });
    expect(gelesen.SheetNames).toEqual(['Fragen', 'Hinweise']);
  });
});

describe('Wenn die Annahme nicht mehr stimmt', () => {
  it('bricht ab, statt eine unformatierte Datei auszuliefern', async () => {
    // Ein Datumswert lässt SheetJS eine zweite Stilzeile schreiben — genau die
    // Lage, in der ein Austausch fremde Formate überschriebe.
    const mitDatum: Blatt = {
      ...BLATT,
      zeilen: [['a-1', 'Was gilt?', new Date('2026-08-07') as unknown as string, '']],
    };
    await expect(baueVeredelteMappe([mitDatum], [V])).rejects.toThrow(/Stiltabelle/);
  });

  it('besteht auf einer Veredelung je Blatt', async () => {
    await expect(baueVeredelteMappe([BLATT, BLATT], [V])).rejects.toThrow(/genau eine/);
  });
});
