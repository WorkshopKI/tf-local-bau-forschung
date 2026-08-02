/**
 * Gemeinsamer Unterbau der Referenz-Importe: XLSX → Kopfzeile + Datenzeilen,
 * **Blatt per Namen**, Spalten **per Namen** statt per Position.
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
 *
 * Rein bis auf das Lesen der übergebenen `File` — kein IDB, kein Share.
 */
import * as XLSX from 'xlsx';

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

export function istLeseFehler(e: XlsxLeseErgebnis): e is XlsxLeseFehler {
  return 'fehler' in e;
}

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
function blattReihenfolge(wb: XLSX.WorkBook, blattName: string | undefined): string[] {
  const namen = [...wb.SheetNames];
  if (!blattName) return namen;
  const gesucht = kopfKey(blattName);
  const treffer = namen.filter(n => kopfKey(n) === gesucht);
  return [...treffer, ...namen.filter(n => kopfKey(n) !== gesucht)];
}

/**
 * Die Kopfzeile eines Blattes suchen; `null`, wenn keine alle Aliase führt.
 *
 * Ein Treffer OHNE Datenzeilen wird zurückgegeben, nicht verschwiegen — der
 * Aufrufer sucht dann in den übrigen Blättern weiter und kann am Ende sagen
 * „Kopf gefunden, aber leer" statt „nichts gefunden".
 */
function findeKopf(
  aoa: string[][],
  pflichtAliase: readonly (readonly string[])[],
  grenze: number,
): { kopf: string[]; zeilen: string[][]; kopfZeileNr: number } | null {
  for (let i = 0; i < grenze; i++) {
    const kopf = (aoa[i] ?? []).map(c => String(c ?? '').trim());
    const keys = kopf.map(kopfKey);
    const vollstaendig = pflichtAliase.every(aliase => aliase.some(a => keys.includes(kopfKey(a))));
    if (!vollstaendig) continue;
    const zeilen = aoa.slice(i + 1)
      .map(r => (r ?? []).map(c => String(c ?? '').trim()))
      .filter(r => r.some(c => c.length > 0));
    return { kopf, zeilen, kopfZeileNr: i + 1 };
  }
  return null;
}

/**
 * Liest das passende Blatt und sucht die Kopfzeile: die erste Zeile unter den
 * ersten `maxSuchtiefe`, in der **alle** Pflicht-Aliase vorkommen.
 *
 * Die Suche über mehrere Zeilen ist nötig, weil die Zuarbeiten gern eine Titel-
 * oder Leerzeile über dem eigentlichen Kopf führen.
 */
export async function leseXlsxTabelle(
  datei: File,
  pflichtAliase: readonly (readonly string[])[],
  opts: LeseOptionen = {},
): Promise<XlsxLeseErgebnis> {
  const maxSuchtiefe = opts.maxSuchtiefe ?? 8;
  let wb: XLSX.WorkBook;
  try {
    const buf = await datei.arrayBuffer();
    wb = XLSX.read(buf, { type: 'array' });
  } catch (err) {
    return { fehler: `XLSX konnte nicht gelesen werden: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (wb.SheetNames.length === 0) return { fehler: 'Keine Tabelle in der Datei gefunden.' };

  const gesehen = new Set<string>();
  let leeresBlatt: string | null = null;
  for (const name of blattReihenfolge(wb, opts.blattName)) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const aoa = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' });
    const grenze = Math.min(maxSuchtiefe, aoa.length);
    const treffer = findeKopf(aoa, pflichtAliase, grenze);
    if (treffer && treffer.zeilen.length > 0) return { blatt: name, ...treffer };
    if (treffer) leeresBlatt ??= name;
    // Für die Fehlermeldung sammeln, was in den Kopfzeilen wirklich stand.
    for (let i = 0; i < grenze; i++) {
      for (const c of aoa[i] ?? []) {
        const t = String(c ?? '').trim();
        if (t) gesehen.add(t);
      }
    }
  }

  if (leeresBlatt) {
    return { fehler: `Blatt „${leeresBlatt}": Kopfzeile gefunden, aber keine Datenzeile darunter.` };
  }
  const erwartet = pflichtAliase.map(a => `„${a[0]}"`).join(', ');
  const gefunden = gesehen.size > 0 ? [...gesehen].slice(0, 25).join(' · ') : '(keine)';
  const blaetter = wb.SheetNames.join(' · ');
  return {
    fehler: `Keine passende Kopfzeile gefunden. Erwartet: ${erwartet}. `
      + `Blätter der Datei: ${blaetter}. Gefundene Überschriften: ${gefunden}`,
  };
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
