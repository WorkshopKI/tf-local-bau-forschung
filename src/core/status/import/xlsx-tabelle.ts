/**
 * Gemeinsamer Unterbau der Referenz-Importe: XLSX → Kopfzeile + Datenzeilen,
 * Spalten **per Namen** statt per Position.
 *
 * Warum header-tolerant und nicht positionsbasiert: die Zuarbeiten kommen aus
 * dem Fachsystem und ändern zwischen Fassungen ihre Spaltenreihenfolge. Ein
 * Import auf festen Indizes liest dann klaglos die falsche Spalte — der
 * schlimmste Fehlermodus, weil er wie ein Erfolg aussieht.
 *
 * Und wenn kein Kopf passt, wird **nicht geraten**: die Meldung nennt die
 * gefundenen Überschriften, damit der Kurator sieht, was die Datei wirklich
 * enthält. Vorbild: `kompetenz-import.ts` (Auslastung).
 *
 * Rein bis auf das Lesen der übergebenen `File` — kein IDB, kein Share.
 */
import * as XLSX from 'xlsx';

/** Eine eingelesene Tabelle: normalisierte Kopfzeile + Rohzeilen. */
export interface XlsxTabelle {
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

/**
 * Liest das erste Blatt und sucht die Kopfzeile: die erste Zeile unter den
 * ersten `maxSuchtiefe`, in der **alle** Pflicht-Aliase vorkommen.
 *
 * Die Suche über mehrere Zeilen ist nötig, weil die Zuarbeiten gern eine Titel-
 * oder Leerzeile über dem eigentlichen Kopf führen.
 */
export async function leseXlsxTabelle(
  datei: File,
  pflichtAliase: readonly (readonly string[])[],
  maxSuchtiefe = 8,
): Promise<XlsxLeseErgebnis> {
  let wb: XLSX.WorkBook;
  try {
    const buf = await datei.arrayBuffer();
    wb = XLSX.read(buf, { type: 'array' });
  } catch (err) {
    return { fehler: `XLSX konnte nicht gelesen werden: ${err instanceof Error ? err.message : String(err)}` };
  }

  const ws = wb.Sheets[wb.SheetNames[0] ?? ''];
  if (!ws) return { fehler: 'Keine Tabelle in der Datei gefunden.' };

  const aoa = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' });
  if (aoa.length < 2) return { fehler: 'Datei zu kurz — erwartet werden eine Kopfzeile und mindestens eine Datenzeile.' };

  const grenze = Math.min(maxSuchtiefe, aoa.length);
  for (let i = 0; i < grenze; i++) {
    const kopf = (aoa[i] ?? []).map(c => String(c ?? '').trim());
    const keys = kopf.map(kopfKey);
    const vollstaendig = pflichtAliase.every(aliase => aliase.some(a => keys.includes(kopfKey(a))));
    if (!vollstaendig) continue;
    const zeilen = aoa.slice(i + 1)
      .map(r => (r ?? []).map(c => String(c ?? '').trim()))
      .filter(r => r.some(c => c.length > 0));
    if (zeilen.length === 0) return { fehler: 'Kopfzeile gefunden, aber keine Datenzeile darunter.' };
    return { kopf, zeilen, kopfZeileNr: i + 1 };
  }

  const gesehen = new Set<string>();
  for (let i = 0; i < grenze; i++) {
    for (const c of aoa[i] ?? []) {
      const t = String(c ?? '').trim();
      if (t) gesehen.add(t);
    }
  }
  const erwartet = pflichtAliase.map(a => `„${a[0]}"`).join(', ');
  const gefunden = gesehen.size > 0 ? [...gesehen].slice(0, 25).join(' · ') : '(keine)';
  return {
    fehler: `Keine passende Kopfzeile gefunden. Erwartet: ${erwartet}. `
      + `Gefundene Überschriften in den ersten ${grenze} Zeilen: ${gefunden}`,
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
