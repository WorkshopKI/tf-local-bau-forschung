/**
 * Gemeinsamer Unterbau der Referenz-Importe: XLSX → Rohzeilen je Blatt, darauf
 * die Kopfzeilen-Suche **per Namen** statt per Position.
 *
 * Zwei Schritte, bewusst getrennt: `leseMappe` macht die IO, `findeKopfInMappe`
 * ist rein. Das Blatt „Erklärung Parameter" führt gar keine Kopfzeile
 * (`parameter-blatt.ts`) — es liest dieselben Rohzeilen, ohne die Datei ein
 * zweites Mal zu öffnen und ohne die Kopfsuche zu kopieren.
 *
 * Warum header-tolerant und nicht positionsbasiert: die Zuarbeiten kommen aus
 * dem Fachsystem und ändern zwischen Fassungen ihre Spaltenreihenfolge. Ein
 * Import auf festen Indizes liest dann klaglos die falsche Spalte — der
 * schlimmste Fehlermodus, weil er wie ein Erfolg aussieht.
 *
 * Warum das Blatt beim Namen genannt wird: die echte Zuarbeit ist eine Mappe mit
 * mehreren Blättern („Trigger-Prozeduren", „Erklärung Parameter", „Erklärung
 * Prozedur"). Immer das erste zu nehmen hieße, auf die Blattreihenfolge zu
 * wetten. Passt der Name nicht, werden alle Blätter nach einem passenden Kopf
 * durchsucht — erst dann gibt der Import auf.
 *
 * Und wenn nichts passt, wird **nicht geraten**: die Meldung nennt die
 * gefundenen Blätter und Überschriften, damit der Kurator sieht, was die Datei
 * wirklich enthält. Vorbild: `kompetenz-import.ts` (Auslastung).
 */
import * as XLSX from 'xlsx';

/** Ein Blatt als getrimmte Rohzeilen — die gemeinsame Grundlage beider Formate. */
export interface RohBlatt {
  name: string;
  /** Zeilen in Dateireihenfolge, inklusive Leerzeilen (Index = Zeilennummer − 1). */
  zeilen: string[][];
}

/** Eine eingelesene Tabelle: normalisierte Kopfzeile + Rohzeilen. */
export interface XlsxTabelle {
  /** Name des Blattes, aus dem gelesen wurde. */
  blatt: string;
  /** Überschriften in Originalschreibweise (für Fehlermeldungen). */
  kopf: string[];
  /** Datenzeilen ohne die Kopfzeile; Zellen als getrimmte Strings. */
  zeilen: string[][];
  /** 1-basierte Nummer der Kopfzeile im Blatt (für Fehlermeldungen). */
  kopfZeileNr: number;
}

export interface XlsxLeseFehler {
  fehler: string;
}

export type XlsxLeseErgebnis = XlsxTabelle | XlsxLeseFehler;

/** Generisch, damit auch `RohBlatt[] | XlsxLeseFehler` damit geprüft werden kann. */
export function istLeseFehler<T extends object>(e: T | XlsxLeseFehler): e is XlsxLeseFehler {
  return 'fehler' in e;
}

const KEINE_TABELLE = 'Keine Tabelle in der Datei gefunden.';

/** Vergleichsform einer Überschrift: NFC, ohne Sonderzeichen, kleingeschrieben. */
export function kopfKey(roh: unknown): string {
  return String(roh ?? '').normalize('NFC').toLowerCase().replace(/[^a-z0-9äöüß]/g, '');
}

export interface LeseOptionen {
  /** Bevorzugtes Blatt. Kein Treffer ⇒ alle Blätter werden durchsucht. */
  blattName?: string;
  /** Wie viele Zeilen von oben nach der Kopfzeile abgesucht werden. */
  maxSuchtiefe?: number;
}

/** Blätter in Prüfreihenfolge: das benannte zuerst, dann der Rest der Mappe. */
export function blattReihenfolge(
  namen: readonly string[], blattName: string | undefined,
): string[] {
  if (!blattName) return [...namen];
  const gesucht = kopfKey(blattName);
  return [
    ...namen.filter(n => kopfKey(n) === gesucht),
    ...namen.filter(n => kopfKey(n) !== gesucht),
  ];
}

/** Die Mappe einmal öffnen; jedes Blatt als getrimmte Zeilen-Matrix. */
export async function leseMappe(datei: File): Promise<RohBlatt[] | XlsxLeseFehler> {
  let wb: XLSX.WorkBook;
  try {
    const buf = await datei.arrayBuffer();
    wb = XLSX.read(buf, { type: 'array' });
  } catch (err) {
    return { fehler: `XLSX konnte nicht gelesen werden: ${err instanceof Error ? err.message : String(err)}` };
  }

  const blaetter: RohBlatt[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const aoa = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' });
    blaetter.push({ name, zeilen: aoa.map(r => (r ?? []).map(c => String(c ?? '').trim())) });
  }
  return blaetter.length > 0 ? blaetter : { fehler: KEINE_TABELLE };
}

/**
 * Die Kopfzeile eines Blattes suchen; `null`, wenn keine alle Aliase führt.
 *
 * Ein Treffer OHNE Datenzeilen wird zurückgegeben, nicht verschwiegen — der
 * Aufrufer sucht dann in den übrigen Blättern weiter und kann am Ende sagen
 * „Kopf gefunden, aber leer" statt „nichts gefunden".
 */
function findeKopf(
  zeilen: readonly string[][],
  pflichtAliase: readonly (readonly string[])[],
  grenze: number,
): { kopf: string[]; zeilen: string[][]; kopfZeileNr: number } | null {
  for (let i = 0; i < grenze; i++) {
    const kopf = [...(zeilen[i] ?? [])];
    const keys = kopf.map(kopfKey);
    const vollstaendig = pflichtAliase.every(aliase => aliase.some(a => keys.includes(kopfKey(a))));
    if (!vollstaendig) continue;
    return {
      kopf,
      zeilen: zeilen.slice(i + 1).filter(r => r.some(c => c.length > 0)),
      kopfZeileNr: i + 1,
    };
  }
  return null;
}

/**
 * Sucht die Kopfzeile in einer gelesenen Mappe: die erste Zeile unter den ersten
 * `maxSuchtiefe`, in der **alle** Pflicht-Aliase vorkommen.
 *
 * Die Suche über mehrere Zeilen ist nötig, weil die Zuarbeiten gern eine Titel-
 * oder Leerzeile über dem eigentlichen Kopf führen. Rein — keine IO.
 */
export function findeKopfInMappe(
  blaetter: readonly RohBlatt[],
  pflichtAliase: readonly (readonly string[])[],
  opts: LeseOptionen = {},
): XlsxLeseErgebnis {
  if (blaetter.length === 0) return { fehler: KEINE_TABELLE };
  const maxSuchtiefe = opts.maxSuchtiefe ?? 8;
  const nachName = new Map(blaetter.map(b => [b.name, b]));

  const gesehen = new Set<string>();
  let leeresBlatt: string | null = null;
  for (const name of blattReihenfolge(blaetter.map(b => b.name), opts.blattName)) {
    const blatt = nachName.get(name);
    if (!blatt) continue;
    const grenze = Math.min(maxSuchtiefe, blatt.zeilen.length);
    const treffer = findeKopf(blatt.zeilen, pflichtAliase, grenze);
    if (treffer && treffer.zeilen.length > 0) return { blatt: name, ...treffer };
    if (treffer) leeresBlatt ??= name;
    // Für die Fehlermeldung sammeln, was in den Kopfzeilen wirklich stand.
    for (let i = 0; i < grenze; i++) {
      for (const c of blatt.zeilen[i] ?? []) if (c) gesehen.add(c);
    }
  }

  if (leeresBlatt) {
    return { fehler: `Blatt „${leeresBlatt}": Kopfzeile gefunden, aber keine Datenzeile darunter.` };
  }
  const erwartet = pflichtAliase.map(a => `„${a[0]}"`).join(', ');
  const gefunden = gesehen.size > 0 ? [...gesehen].slice(0, 25).join(' · ') : '(keine)';
  const blaetterNamen = blaetter.map(b => b.name).join(' · ');
  return {
    fehler: `Keine passende Kopfzeile gefunden. Erwartet: ${erwartet}. `
      + `Blätter der Datei: ${blaetterNamen}. Gefundene Überschriften: ${gefunden}`,
  };
}

/** Mappe lesen und die Kopfzeile suchen — der übliche Weg in einem Aufruf. */
export async function leseXlsxTabelle(
  datei: File,
  pflichtAliase: readonly (readonly string[])[],
  opts: LeseOptionen = {},
): Promise<XlsxLeseErgebnis> {
  const mappe = await leseMappe(datei);
  if (istLeseFehler(mappe)) return mappe;
  return findeKopfInMappe(mappe, pflichtAliase, opts);
}

/** Spaltenindex per Alias-Liste; `-1`, wenn keiner passt. */
export function spalte(kopf: readonly string[], aliase: readonly string[]): number {
  const keys = kopf.map(kopfKey);
  for (const a of aliase) {
    const i = keys.indexOf(kopfKey(a));
    if (i >= 0) return i;
  }
  return -1;
}

/** Zelle als getrimmter String; fehlende Spalte → ''. */
export function zelle(zeile: readonly string[], index: number): string {
  return index < 0 ? '' : (zeile[index] ?? '').trim();
}
