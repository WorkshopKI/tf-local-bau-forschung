/**
 * Export-Service fuer das Auslastungs-Modul.
 *
 * Zwei Varianten:
 *  - exportAnonymousXlsx(): direkter Download mit anonymen IDs (MA01...)
 *  - exportProtectedZip(password): AES-256-verschluesseltes ZIP mit
 *    de-anonymisiertem XLSX (echte Kuerzel ausschliesslich im RAM).
 *
 * Datenmodell der Export-Zeile:
 *   Aktenzeichen | VB-Titel | TV-Titel | MA | Score | Restkapazitaet |
 *   Aufwand (h) | Confidence | Status
 *
 * Anonymitaets-Garantie: das invertierte Mapping (MA01 -> echtes Kuerzel)
 * wird NIE persistiert; es lebt nur fuer die Dauer eines Export-Vorgangs.
 */
import * as XLSX from 'xlsx';
import type { Antrag } from '@/core/services/csv/types';
import {
  CANONICAL_TITEL,
  CANONICAL_VERBUND_TITEL,
  type AnonymerMitarbeiter,
  type AuslastungData,
  type MatchResult,
  type Zuweisung,
} from '../types';
import type { AnonymMap } from './anonym-map';

export interface ExportRow {
  aktenzeichen: string;
  vbTitel: string;
  tvTitel: string;
  ma: string;             // anonyme oder echte ID — je nach Variante
  score: number;          // 0..1
  restkapazitaet: number; // Stunden
  aufwand: number;
  confidence: 'high' | 'medium' | 'low';
  status: string;
}

/**
 * Baut die Export-Zeilen aus dem aktuellen Zustand zusammen.
 *
 * Pro Zuweisung des aktiven Quartals eine Zeile. Bei `freigegeben` UND
 * `selbst` kommt eine Zeile pro MA pro Antrag — bei der UI sieht man
 * dann genau, wer wie viel macht. `abgelehnt`-Zeilen werden ueberlesen.
 *
 * Caller kann zusaetzlich noch Match-Vorschlaege fuer NICHT-zugewiesene
 * Antraege uebergeben (`pendingMatches`) — dann werden auch Top-3-Vorschlaege
 * mit Status `vorgeschlagen` zur Tabelle hinzugefuegt.
 */
export interface BuildRowsInput {
  data: AuslastungData;
  antraege: Antrag[];
  /** Optional: pro Antrag die Top-3-Vorschlaege (fuer noch nicht zugewiesene). */
  pendingMatches?: Map<string, MatchResult[]>;
  /** Filter — wenn gesetzt, nur Zuweisungen dieses Quartals. */
  quartal?: string;
}

export function buildExportRows(input: BuildRowsInput): ExportRow[] {
  const { data, antraege, pendingMatches } = input;
  const quartal = input.quartal ?? data.config.aktuellesQuartal;
  const indexAz = new Map<string, Antrag>(antraege.map(a => [a.aktenzeichen, a]));
  const rows: ExportRow[] = [];

  // 1) Zuweisungen mit Status `freigegeben` oder `selbst`
  for (const z of data.zuweisungen) {
    if (z.quartal !== quartal) continue;
    if (z.status === 'abgelehnt') continue;
    const a = indexAz.get(z.antragId);
    if (!a) continue;
    rows.push(toRow(a, z.anonId, scoreFromAssignment(z), z, quartal, data.mitarbeiter));
  }

  // 2) Optional: Top-N-Vorschlaege fuer nicht-zugewiesene Antraege
  if (pendingMatches) {
    const zugewiesen = new Set(
      data.zuweisungen
        .filter(z => z.quartal === quartal && z.status !== 'abgelehnt')
        .map(z => z.antragId),
    );
    for (const [az, matches] of pendingMatches.entries()) {
      if (zugewiesen.has(az)) continue;
      const a = indexAz.get(az);
      if (!a) continue;
      for (const m of matches.slice(0, 3)) {
        rows.push({
          aktenzeichen: a.aktenzeichen,
          vbTitel: stringOr(a[CANONICAL_VERBUND_TITEL], '—'),
          tvTitel: stringOr(a[CANONICAL_TITEL], '—'),
          ma: m.anonId,
          score: m.kompetenzScore,
          restkapazitaet: m.restKapazitaet,
          aufwand: m.benoetigteStunden,
          confidence: m.confidence,
          status: 'vorgeschlagen',
        });
      }
    }
  }

  // Stabil sortieren: Aktz., dann Score absteigend
  rows.sort((a, b) =>
    a.aktenzeichen.localeCompare(b.aktenzeichen)
    || b.score - a.score
  );
  return rows;
}

function scoreFromAssignment(z: Zuweisung): number {
  // Bei manuell freigegebenen Zuweisungen kein Score verfuegbar -> 1.0.
  // Selbst-eingetragen ebenfalls 1.0 (MA hat selbst entschieden).
  if (z.status === 'freigegeben' || z.status === 'selbst') return 1.0;
  return 0;
}

function toRow(
  a: Antrag,
  anonId: string,
  score: number,
  z: Zuweisung,
  _quartal: string,
  mitarbeiter: Record<string, AnonymerMitarbeiter>,
): ExportRow {
  const ma = mitarbeiter[anonId];
  const quartKap = ma ? ma.jahresKapazitaet / 4 : 0;
  // Rest ist hier post-hoc nicht 100% exakt verfuegbar — wir geben quartalsKap
  // - z.stunden als Naeherung. Der Empfaenger sieht ja die echten Werte sowieso
  // im Dashboard.
  const rest = Math.max(0, quartKap - z.stunden);
  return {
    aktenzeichen: a.aktenzeichen,
    vbTitel: stringOr(a[CANONICAL_VERBUND_TITEL], '—'),
    tvTitel: stringOr(a[CANONICAL_TITEL], '—'),
    ma: anonId,
    score,
    restkapazitaet: rest,
    aufwand: z.stunden,
    confidence: score >= 0.5 ? 'high' : score >= 0.2 ? 'medium' : 'low',
    status: z.status,
  };
}

function stringOr(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v : fallback;
}

/** XLSX-WorkBook aus Export-Zeilen. */
export function buildWorkbook(rows: ExportRow[], quartal: string): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const sheetData = [
    ['Aktenzeichen', 'VB-Titel', 'TV-Titel', 'Empfohlener MA', 'Kompetenz-Score', 'Restkapazitaet (h)', 'Aufwand (h)', 'Confidence', 'Status'],
    ...rows.map(r => [
      r.aktenzeichen,
      r.vbTitel,
      r.tvTitel,
      r.ma,
      Number(r.score.toFixed(3)),
      Math.round(r.restkapazitaet),
      r.aufwand,
      r.confidence,
      r.status,
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  // Spalten-Breiten — minimale Aesthetik
  ws['!cols'] = [
    { wch: 18 }, { wch: 40 }, { wch: 40 }, { wch: 8 },
    { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, `Auslastung ${quartal}`);
  return wb;
}

/**
 * Anonymer XLSX-Export — direkter Download.
 * Dateiname: `auslastung-anonym-{quartal}.xlsx`.
 */
export function exportAnonymousXlsx(input: BuildRowsInput): void {
  const quartal = input.quartal ?? input.data.config.aktuellesQuartal;
  const rows = buildExportRows({ ...input, quartal });
  const wb = buildWorkbook(rows, quartal);
  XLSX.writeFile(wb, `auslastung-anonym-${quartal}.xlsx`);
}

/**
 * Erzeugt ein XLSX-Workbook mit DE-ANONYMISIERTEN Rows. Das invertierte
 * Mapping wird NICHT persistiert — nur fuer diesen Aufruf.
 *
 * Rueckgabe als ArrayBuffer fuer das anschliessende Verpacken ins ZIP.
 */
export function buildDeAnonymizedWorkbook(
  input: BuildRowsInput & { anonymMap: AnonymMap },
): { workbook: ArrayBuffer; quartal: string; rowCount: number } {
  const quartal = input.quartal ?? input.data.config.aktuellesQuartal;
  const rows = buildExportRows({ ...input, quartal });
  // De-Anonymisierung
  const deAnonymizedRows: ExportRow[] = rows.map(r => ({
    ...r,
    ma: input.anonymMap.toReal.get(r.ma) ?? r.ma,  // fallback if unknown
  }));
  const wb = buildWorkbook(deAnonymizedRows, quartal);
  const arr = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return { workbook: arr, quartal, rowCount: rows.length };
}

/**
 * Packt das de-anonymisierte XLSX in ein AES-256-verschluesseltes ZIP.
 * Caller muss das Passwort liefern.
 *
 * Dateiname: `auslastung-{quartal}.zip` — die XLSX im ZIP heisst dann
 * `auslastung-{quartal}.xlsx`.
 *
 * Technologie: `@zip.js/zip.js` — unterstuetzt AES-256 nativ.
 */
export async function exportProtectedZip(
  input: BuildRowsInput & { anonymMap: AnonymMap; password: string },
): Promise<void> {
  if (!input.password || input.password.length < 4) {
    throw new Error('Passwort muss mindestens 4 Zeichen lang sein');
  }
  const zipjs = await import('@zip.js/zip.js');
  const { ZipWriter, BlobReader, BlobWriter, Uint8ArrayReader } = zipjs;

  const { workbook, quartal } = buildDeAnonymizedWorkbook(input);
  const xlsxBlobBytes = new Uint8Array(workbook);
  const xlsxFilename = `auslastung-${quartal}.xlsx`;

  const zipBlob = new BlobWriter('application/zip');
  const writer = new ZipWriter(zipBlob, {
    password: input.password,
    encryptionStrength: 3,   // 3 = AES-256
    zipCrypto: false,        // strikt AES, keine Legacy-Verschluesselung
  });
  await writer.add(xlsxFilename, new Uint8ArrayReader(xlsxBlobBytes));
  // README im ZIP — erinnert dass die Datei sensitive Daten enthaelt.
  const readme = `Diese Datei enthaelt de-anonymisierte Auslastungs-Daten ` +
    `fuer das Quartal ${quartal}.\n` +
    `Bitte vertraulich behandeln und nach Gebrauch loeschen.\n\n` +
    `Erstellt am: ${new Date().toLocaleString('de-DE')}\n`;
  await writer.add(
    'README.txt',
    new BlobReader(new Blob([readme], { type: 'text/plain' })),
    { password: input.password, encryptionStrength: 3 } as Parameters<typeof writer.add>[2],
  );
  await writer.close();

  const blob = await zipBlob.getData();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `auslastung-${quartal}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
