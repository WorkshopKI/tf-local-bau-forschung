/**
 * Export-Service fuer das Auslastungs-Modul.
 *
 * Zwei Varianten:
 *  - exportAnonymousXlsx(): direkter Download mit anonymen IDs (MA01...)
 *  - exportDeAnonymizedXlsx(): direkter Download mit echten Kuerzeln (kein
 *    Passwortschutz — die Variante liegt auf einem geschuetzten SMB-Bereich;
 *    das Mapping anonId→Kuerzel lebt ausschliesslich im RAM).
 *
 * Datenmodell der Export-Zeile:
 *   Aktenzeichen | VB-Titel | TV-Titel | MA | Score | Restkapazitaet |
 *   Aufwand (h) | Confidence | Status
 *
 * Anonymitaets-Garantie: das invertierte Mapping (MA01 -> echtes Kuerzel)
 * wird NIE persistiert; es lebt nur fuer die Dauer eines Export-Vorgangs.
 */
import * as XLSX from 'xlsx';
import type { Antrag, Verbund } from '@/core/services/csv/types';
import {
  CANONICAL_TITEL,
  type AnonymerMitarbeiter,
  type AuslastungData,
  type MatchResult,
  type Zuweisung,
} from '../types';
import type { AnonymMap } from './anonym-map';
import { resolveVerbundMeta, verbundKeyOf, pickVerbundZuweisung } from './verbund-aggregation';
import { effektiveJahresStunden } from './kapazitaet-pro-typ';

export interface ExportRow {
  aktenzeichen: string;
  akronym: string;
  vbTitel: string;
  tvTitel: string;
  anzahlTV: number;       // TVs des Verbundes (Zuweisung erfolgt pro Verbund)
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
 * EINE Zeile pro Verbund des aktiven Quartals (eine Einheit, ein Bearbeiter) —
 * zugewiesene Zuweisungen werden pro `verbundKeyOf` gebuendelt. Bei Altdaten mit
 * mehreren konkurrierenden Zuweisungen eines Verbundes entscheidet
 * `pickVerbundZuweisung` (Praezedenz freigegeben > selbst > vorgeschlagen).
 * `abgelehnt`-Zeilen werden ueberlesen.
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
  /** Verbund-Store fuer Titel/Akronym-Aufloesung (liegen NICHT am Antrag). */
  verbuendeById?: ReadonlyMap<string, Verbund>;
}

export function buildExportRows(input: BuildRowsInput): ExportRow[] {
  const { data, antraege, pendingMatches, verbuendeById } = input;
  const quartal = input.quartal ?? data.config.aktuellesQuartal;
  const indexAz = new Map<string, Antrag>(antraege.map(a => [a.aktenzeichen, a]));
  const rows: ExportRow[] = [];

  // 1) Zugewiesene Zuweisungen pro Verbund buendeln — EINE Zeile pro Verbund.
  const verbundGroups = new Map<string, Zuweisung[]>();
  for (const z of data.zuweisungen) {
    if (z.quartal !== quartal) continue;
    if (z.status === 'abgelehnt') continue;
    const a = indexAz.get(z.antragId);
    if (!a) continue;
    const key = verbundKeyOf(a);
    const g = verbundGroups.get(key);
    if (g) g.push(z); else verbundGroups.set(key, [z]);
  }
  for (const candidates of verbundGroups.values()) {
    const z = pickVerbundZuweisung(candidates);
    const a = indexAz.get(z.antragId)!;
    rows.push(toRow(a, z.anonId, scoreFromAssignment(z), z, quartal, data.mitarbeiter, verbuendeById));
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
      const meta = resolveVerbundMeta(verbuendeById?.get(verbundKeyOf(a)), a);
      for (const m of matches.slice(0, 3)) {
        rows.push({
          aktenzeichen: a.aktenzeichen,
          akronym: meta.akronym,
          vbTitel: meta.verbundTitel || '—',
          tvTitel: stringOr(a[CANONICAL_TITEL], '—'),
          anzahlTV: 1,
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
  verbuendeById?: ReadonlyMap<string, Verbund>,
): ExportRow {
  const ma = mitarbeiter[anonId];
  const quartKap = ma ? effektiveJahresStunden(ma) / 4 : 0;
  // Rest ist hier post-hoc nicht 100% exakt verfuegbar — wir geben quartalsKap
  // - z.stunden als Naeherung. Der Empfaenger sieht ja die echten Werte sowieso
  // im Dashboard.
  const rest = Math.max(0, quartKap - z.stunden);
  // Verbund-Titel/Akronym aus dem verbuende-Store (liegen nicht am Antrag).
  const meta = resolveVerbundMeta(verbuendeById?.get(verbundKeyOf(a)), a);
  return {
    aktenzeichen: a.aktenzeichen,
    akronym: meta.akronym,
    vbTitel: meta.verbundTitel || '—',
    tvTitel: stringOr(a[CANONICAL_TITEL], '—'),
    anzahlTV: z.anzahlTV ?? 1,
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
    ['Aktenzeichen', 'Akronym', 'VB-Titel', 'TV-Titel', 'TVs', 'Empfohlener MA', 'Kompetenz-Score', 'Restkapazitaet (h)', 'Aufwand (h)', 'Confidence', 'Status'],
    ...rows.map(r => [
      r.aktenzeichen,
      r.akronym,
      r.vbTitel,
      r.tvTitel,
      r.anzahlTV,
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
    { wch: 18 }, { wch: 16 }, { wch: 40 }, { wch: 40 }, { wch: 6 }, { wch: 8 },
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
 * De-anonymisierter XLSX-Export — direkter Download mit echten TIB-Kuerzeln.
 *
 * Kein Passwortschutz: die PL-/Kurator-Variante liegt auf einem zugriffs-
 * geschuetzten SMB-Bereich (Schutz auf Ordner-Ebene). Das invertierte Mapping
 * (anonId → echtes Kuerzel) wird NICHT persistiert — es lebt nur fuer die Dauer
 * dieses Aufrufs im RAM.
 *
 * Dateiname: `auslastung-kuerzel-{quartal}.xlsx`.
 */
export function exportDeAnonymizedXlsx(
  input: BuildRowsInput & { anonymMap: AnonymMap },
): void {
  const quartal = input.quartal ?? input.data.config.aktuellesQuartal;
  const rows: ExportRow[] = buildExportRows({ ...input, quartal }).map(r => ({
    ...r,
    ma: input.anonymMap.toReal.get(r.ma) ?? r.ma,  // fallback if unknown
  }));
  const wb = buildWorkbook(rows, quartal);
  XLSX.writeFile(wb, `auslastung-kuerzel-${quartal}.xlsx`);
}
