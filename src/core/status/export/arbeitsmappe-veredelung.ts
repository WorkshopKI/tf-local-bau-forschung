/**
 * Eine Arbeitsmappe, die **reihum geht** — mit dem Format, das dafür nötig ist.
 *
 * **Warum es diese Datei gibt.** Die gebündelte XLSX-Bibliothek (SheetJS
 * Community) schreibt von dem, was eine herumgereichte Datei braucht, nur drei
 * Dinge: Autofilter, Spaltenbreiten, mehrere Blätter. Fixierte Kopfzeile,
 * Zeilenumbruch, Zellfüllung, entsperrte Zellen und Datenvalidierung kann ihr
 * Writer nicht — `dataValidations` ist dort ein leerer Kommentar, `sheetView`
 * wird ohne `<pane>` geschrieben, und die Stiltabelle ist auf einen einzigen
 * Eintrag festverdrahtet. Ohne entsperrte Zellen wäre Blattschutz sogar
 * schädlich: er sperrte die Antwortspalte mit.
 *
 * Deshalb der Nachschritt. Eine XLSX ist ein ZIP; `jszip` liegt ohnehin im
 * Bündel. Geschrieben wird wie bisher, danach werden zwei Dateien im Archiv
 * ersetzt bzw. ergänzt. **Keine zweite Bibliothek** — ein zweiter ZIP-Stack in
 * einem Single-File-Build, der als `pl` schon 18,5 MB wiegt, wäre der teurere
 * Weg zum selben Ergebnis.
 *
 * **Warum das nicht heimlich schiefgehen darf.** Diese Datei ist wochenlang
 * unterwegs und kommt mit Antworten zurück. Eine Formatierung, die still
 * ausfällt, merkt niemand — außer daran, dass der Kontext abgeschnitten ist und
 * geraten wird. Die Annahme über die erzeugte `styles.xml` wird deshalb
 * **geprüft**: passt sie nicht, bricht der Export mit einem Satz ab, statt eine
 * unformatierte Datei auszuliefern.
 *
 * `schreibeArbeitsmappe` und seine drei Bestandskonsumenten bleiben unberührt.
 */
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { baueArbeitsmappe, type Blatt } from './arbeitsmappe';

/** Excels harte Grenze für eine eingebettete Auswahlliste (Zeichen inkl. Komma). */
const VALIDIERUNG_MAX = 255;

/** Eine Auswahlliste an genau einer Zelle. */
export interface Validierung {
  /** 1-basiert. */
  zeile: number;
  /** 1-basiert. */
  spalte: number;
  optionen: readonly string[];
}

/** Wie ein Blatt zu veredeln ist. Alle Zeilen/Spalten 1-basiert. */
export interface BlattVeredelung {
  /** Zeile der Spaltenüberschriften. Darüber (inklusive) wird eingefroren. */
  kopfZeile: number;
  /** Letzte Datenzeile; `kopfZeile`, wenn es keine Daten gibt. */
  letzteZeile: number;
  /** Letzte belegte Spalte. */
  letzteSpalte: number;
  /** Spaltenbreiten in Zeichen, ab Spalte 1. */
  breiten: readonly number[];
  /** Spalten mit Zeilenumbruch — lange Texte, die lesbar dastehen müssen. */
  umbruch: readonly number[];
  /** Spalten, in die geschrieben wird: gefüllt und entsperrt. */
  antwort: readonly number[];
  validierungen?: readonly Validierung[];
}

/** Was die Veredelung getan — und was sie gelassen — hat. */
export interface VeredelungsBericht {
  /** Auswahllisten, die Excels 255-Zeichen-Grenze gerissen hätten. */
  validierungenAusgelassen: number;
}

// --- Stiltabelle ----------------------------------------------------------

/** Die vier Stile. Index 0 muss zu SheetJS' Vorgabe passen (siehe `STIL_XML`). */
const STIL_NORMAL = 0;
const STIL_UMBRUCH = 1;
const STIL_ANTWORT = 2;
const STIL_KOPF = 3;

/**
 * Die Stiltabelle, die SheetJS' eigene ersetzt.
 *
 * **Index 0 bleibt byte-gleich zu ihrer Vorgabe**, damit jede Zelle ohne
 * `s`-Attribut unverändert aussieht — nur so ist der Eingriff additiv.
 * `locked` ist per Vorgabe wahr; deshalb muss allein die Antwortspalte
 * ausdrücklich entsperrt werden.
 */
const STIL_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
  + '<fonts count="2">'
  + '<font><sz val="12"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>'
  + '<font><b/><sz val="12"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>'
  + '</fonts>'
  + '<fills count="3">'
  + '<fill><patternFill patternType="none"/></fill>'
  + '<fill><patternFill patternType="gray125"/></fill>'
  + '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill>'
  + '</fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="4">'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1">'
  + '<alignment vertical="top" wrapText="1"/></xf>'
  + '<xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1" applyAlignment="1" applyProtection="1">'
  + '<alignment vertical="top" wrapText="1"/><protection locked="0"/></xf>'
  + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">'
  + '<alignment vertical="top" wrapText="1"/></xf>'
  + '</cellXfs>'
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
  + '<dxfs count="0"/>'
  + '<tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleMedium4"/>'
  + '</styleSheet>';

/**
 * Die Gestalt, auf die der Eingriff baut: genau ein Stileintrag, also keine
 * Zelle mit eigenem Format. Sobald die Mappe ein Datums- oder Zahlenformat
 * trägt, wächst `cellXfs` — dann verschöbe ein Austausch fremde Formate.
 */
const ERWARTETE_STILTABELLE = '<cellXfs count="1"';

// --- Hilfen ---------------------------------------------------------------

/** 1 → `A`, 27 → `AA`. */
export function spaltenName(n: number): string {
  let s = '';
  for (let r = n; r > 0; r = Math.floor((r - 1) / 26)) {
    s = String.fromCharCode(65 + ((r - 1) % 26)) + s;
  }
  return s;
}

function xmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Eine eingebettete Auswahlliste. Kommas trennen die Einträge — ein Komma IM
 * Eintrag zerlegte ihn in zwei; es wird deshalb ersetzt, nicht escaped (Excel
 * kennt für die Inline-Form kein Escape). `null`, wenn die Liste Excels Grenze
 * reißt: dann steht die Auswahl weiter im Kontext, und die Zelle bleibt frei.
 */
function auswahlFormel(optionen: readonly string[]): string | null {
  const sauber = optionen.map(o => o.replace(/,/g, ';').replace(/"/g, "'").trim()).filter(o => o !== '');
  if (sauber.length === 0) return null;
  const liste = sauber.join(',');
  return liste.length > VALIDIERUNG_MAX ? null : liste;
}

/**
 * Wohin `<dataValidations>` im Blatt gehört. Das Schema schreibt eine feste
 * Reihenfolge vor; landet der Block hinter einem Element, das nach ihm kommen
 * müsste, öffnet Excel die Datei nicht mehr. Erster passender Anker gewinnt.
 */
const NACHFOLGER = [
  '<hyperlinks', '<printOptions', '<pageMargins', '<pageSetup', '<headerFooter',
  '<rowBreaks', '<colBreaks', '<drawing', '<legacyDrawing', '</worksheet>',
];

function setzeVor(xml: string, block: string): string {
  for (const anker of NACHFOLGER) {
    const i = xml.indexOf(anker);
    if (i >= 0) return xml.slice(0, i) + block + xml.slice(i);
  }
  return xml + block;
}

// --- Der Eingriff ---------------------------------------------------------

function stilFuer(v: BlattVeredelung, spalte: number, zeile: number): number | null {
  if (zeile === v.kopfZeile) return STIL_KOPF;
  if (zeile < v.kopfZeile) return null;                    // Erhebungs-Kopf: unberührt
  if (v.antwort.includes(spalte)) return STIL_ANTWORT;
  if (v.umbruch.includes(spalte)) return STIL_UMBRUCH;
  return null;
}

/** Setzt Stile, friert die Kopfzeile ein und hängt die Auswahllisten an. */
export function veredeleBlattXml(
  xml: string, v: BlattVeredelung,
): { xml: string; ausgelassen: number } {
  let out = xml.replace(/<c r="([A-Z]+)(\d+)"/g, (ganz, sp: string, z: string) => {
    const spalte = [...sp].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0);
    const stil = stilFuer(v, spalte, Number(z));
    return stil === null || stil === STIL_NORMAL ? ganz : `<c r="${sp}${z}" s="${stil}"`;
  });

  // Kopfzeile fixieren. SheetJS schreibt das Element selbstschließend; es muss
  // geöffnet werden, damit `<pane>` hineinpasst.
  const erste = v.kopfZeile + 1;
  out = out.replace(/<sheetView([^>]*?)\/>/, (_g, attr: string) =>
    `<sheetView${attr}>`
    + `<pane ySplit="${v.kopfZeile}" topLeftCell="A${erste}" activePane="bottomLeft" state="frozen"/>`
    + `<selection pane="bottomLeft" activeCell="A${erste}" sqref="A${erste}"/>`
    + '</sheetView>');

  let ausgelassen = 0;
  const regeln: string[] = [];
  for (const val of v.validierungen ?? []) {
    const formel = auswahlFormel(val.optionen);
    if (formel === null) { ausgelassen++; continue; }
    const zelle = `${spaltenName(val.spalte)}${val.zeile}`;
    regeln.push(
      // `showErrorMessage="0"`: die Liste ist ein Angebot, kein Zwang. Wer eine
      // Antwort geben will, die nicht vorgesehen war, muss sie geben können.
      `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="0" sqref="${zelle}">`
      + `<formula1>&quot;${xmlText(formel)}&quot;</formula1></dataValidation>`,
    );
  }
  if (regeln.length > 0) {
    out = setzeVor(out, `<dataValidations count="${regeln.length}">${regeln.join('')}</dataValidations>`);
  }
  return { xml: out, ausgelassen };
}

/** Baut die Mappe und veredelt sie. Getrennt vom Download, damit Tests sie auspacken können. */
export async function baueVeredelteMappe(
  blaetter: readonly Blatt[], veredelung: readonly BlattVeredelung[],
): Promise<{ zip: JSZip; bericht: VeredelungsBericht }> {
  if (blaetter.length === 0) throw new Error('Nichts zu exportieren — keine Auswertung enthalten.');
  if (blaetter.length !== veredelung.length) {
    throw new Error('Zu jedem Blatt gehört genau eine Veredelung.');
  }

  const mappe = baueArbeitsmappe(blaetter);
  veredelung.forEach((v, i) => {
    const ws = mappe.Sheets[mappe.SheetNames[i]!];
    if (ws === undefined) return;
    ws['!cols'] = v.breiten.map(wch => ({ wch }));
    if (v.letzteZeile > v.kopfZeile) {
      ws['!autofilter'] = {
        ref: `A${v.kopfZeile}:${spaltenName(v.letzteSpalte)}${v.letzteZeile}`,
      };
    }
    // Unter Schutz sind Sortieren und Filtern per Vorgabe VERBOTEN — beides
    // ausdrücklich freigeben, sonst wäre der Autofilter darüber tot. Spalten-
    // und Zeilenmaße ebenfalls, damit niemand den Schutz aufheben muss, um eine
    // Spalte breiter zu ziehen.
    ws['!protect'] = { sort: false, autoFilter: false, formatColumns: false, formatRows: false };
  });

  const roh = XLSX.write(mappe, { type: 'array', bookType: 'xlsx', compression: true }) as ArrayBuffer;
  const zip = await JSZip.loadAsync(roh);

  const stile = await zip.file('xl/styles.xml')?.async('string');
  if (stile === undefined || !stile.includes(ERWARTETE_STILTABELLE)) {
    throw new Error(
      'Der XLSX-Export kann die Formatierung nicht setzen: die Stiltabelle der '
      + 'Bibliothek sieht anders aus als erwartet. Die Datei wurde NICHT erzeugt — '
      + 'eine unformatierte Fassung wäre für den Umlauf unbrauchbar.',
    );
  }
  zip.file('xl/styles.xml', STIL_XML);

  let ausgelassen = 0;
  for (let i = 0; i < veredelung.length; i++) {
    const pfad = `xl/worksheets/sheet${i + 1}.xml`;
    const datei = zip.file(pfad);
    if (datei === null) throw new Error(`Blatt ${i + 1} fehlt im erzeugten Archiv (${pfad}).`);
    const ergebnis = veredeleBlattXml(await datei.async('string'), veredelung[i]!);
    zip.file(pfad, ergebnis.xml);
    ausgelassen += ergebnis.ausgelassen;
  }

  return { zip, bericht: { validierungenAusgelassen: ausgelassen } };
}

/**
 * Schreibt die veredelte Mappe und stößt den Download an.
 *
 * Blob-Anker statt `XLSX.writeFile`, weil das Archiv nach dem Schreiben noch
 * einmal angefasst wird. Unter `file://` unbedenklich: ein `download`-Anker auf
 * eine Object-URL ist kein Netzwerkzugriff und keine Navigation.
 */
export async function schreibeVeredelteArbeitsmappe(
  blaetter: readonly Blatt[], veredelung: readonly BlattVeredelung[], dateiname: string,
): Promise<VeredelungsBericht> {
  const { zip, bericht } = await baueVeredelteMappe(blaetter, veredelung);
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  a.click();
  URL.revokeObjectURL(url);
  return bericht;
}
