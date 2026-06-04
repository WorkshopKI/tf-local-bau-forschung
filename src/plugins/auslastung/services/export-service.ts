/**
 * Export-Service fuer das Auslastungs-Modul.
 *
 * `exportDeAnonymizedXlsx()`: direkter Download mit echten TIB-Kuerzeln. Der
 * PL-Build ist seit v2.16 beim App-Start per Rollen-Passwort gated; das Mapping
 * anonId→Kuerzel lebt ausschliesslich im RAM und wird NIE persistiert.
 *
 * Datenmodell der Export-Zeile (v2.18):
 *   Aktenzeichen | Akronym | VB-Titel | TVs | Empfohlener MA | Passungs-Score |
 *   Restkapazität (TVs) | Confidence | Status | Alternative 1 … Alternative 5
 *
 * Die „Alternative N"-Spalten listen pro Verbund die naechstbesten ANDEREN
 * Bearbeiter (Matching-Top-5 ohne den zugewiesenen MA), je Zelle
 * `Kuerzel · Kompetenz% · N TVs frei`. Die dafuer noetigen MatchResults
 * uebergibt der Aufrufer als `matchesByLead` (Hook `useKuerzelExport`).
 */
import * as XLSX from 'xlsx';
import type { Antrag, Verbund } from '@/core/services/csv/types';
import {
  type AnonymerMitarbeiter,
  type AuslastungData,
  type MatchResult,
  type Zuweisung,
} from '../types';
import type { AnonymMap } from './anonym-map';
import { resolveVerbundMeta, verbundKeyOf, pickVerbundZuweisung } from './verbund-aggregation';
import { effektiveJahresStunden } from './kapazitaet-pro-typ';

/** Anzahl der „weitere moegliche Bearbeiter"-Spalten. */
const ALT_COUNT = 5;

/** Ein alternativer Bearbeiter (Matching-Kandidat) fuer die Alternative-Spalten. */
export interface ExportAlternative {
  anonId: string;
  /** Echtes Kuerzel — wird in `exportDeAnonymizedXlsx` aus der AnonymMap gefuellt. */
  kuerzel?: string;
  kompetenz: number; // 0..1
  tvsFrei: number;
}

export interface ExportRow {
  aktenzeichen: string;
  akronym: string;
  vbTitel: string;
  anzahlTV: number;       // TVs des Verbundes (Zuweisung erfolgt pro Verbund)
  ma: string;             // anonyme oder echte ID — je nach Variante
  score: number;          // 0..1 — Kompetenz des zugewiesenen MA
  restTVs: number;        // Restkapazität des zugewiesenen MA in TVs
  confidence: 'high' | 'medium' | 'low';
  status: string;
  /** Top-5 alternative Bearbeiter (ohne den zugewiesenen MA). */
  alternativen: ExportAlternative[];
}

export interface BuildRowsInput {
  data: AuslastungData;
  antraege: Antrag[];
  /** Optional: pro Antrag die Top-N-Vorschlaege (fuer noch nicht zugewiesene). */
  pendingMatches?: Map<string, MatchResult[]>;
  /** Pro zugewiesenem Verbund (Buchungs-Lead-Aktenzeichen) die vollstaendig
   *  gescorten MatchResults — fuer Kompetenz/Restkapazität des zugewiesenen MA
   *  + die Top-5-Alternativen. */
  matchesByLead?: Map<string, MatchResult[]>;
  /** Filter — wenn gesetzt, nur Zuweisungen dieses Quartals. */
  quartal?: string;
  /** Verbund-Store fuer Titel/Akronym-Aufloesung (liegen NICHT am Antrag). */
  verbuendeById?: ReadonlyMap<string, Verbund>;
}

/**
 * Baut die Export-Zeilen aus dem aktuellen Zustand zusammen.
 *
 * EINE Zeile pro Verbund des aktiven Quartals (eine Einheit, ein Bearbeiter) —
 * zugewiesene Zuweisungen werden pro `verbundKeyOf` gebuendelt. Bei Altdaten mit
 * mehreren konkurrierenden Zuweisungen entscheidet `pickVerbundZuweisung`
 * (Praezedenz freigegeben > selbst > vorgeschlagen). `abgelehnt`-Zeilen werden
 * ueberlesen. Mit `matchesByLead` werden Kompetenz/Restkapazität des zugewiesenen
 * MA + die Top-5-Alternativen befuellt (sonst graceful-Fallback).
 */
export function buildExportRows(input: BuildRowsInput): ExportRow[] {
  const { data, antraege, pendingMatches, matchesByLead, verbuendeById } = input;
  const quartal = input.quartal ?? data.config.aktuellesQuartal;
  const stundenProTV = data.config.stundenProTV && data.config.stundenProTV > 0 ? data.config.stundenProTV : 9;
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
    rows.push(toRow(a, z.anonId, scoreFromAssignment(z), z, data.mitarbeiter, stundenProTV, verbuendeById, matchesByLead));
  }

  // 2) Optional: Top-N-Vorschlaege fuer nicht-zugewiesene Antraege (nicht vom
  //    De-Anon-Export genutzt; bleibt fuer evtl. andere Aufrufer).
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
          anzahlTV: 1,
          ma: m.anonId,
          score: m.kompetenzScore,
          restTVs: Math.floor(Math.max(0, m.restKapazitaet) / stundenProTV),
          confidence: m.confidence,
          status: 'vorgeschlagen',
          alternativen: [],
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
  // Fallback ohne Match-Daten: manuell freigegeben/selbst -> 1.0.
  if (z.status === 'freigegeben' || z.status === 'selbst') return 1.0;
  return 0;
}

/** Restkapazität (in TVs) eines MA aus der groben Quartals-Naeherung — Fallback,
 *  wenn keine MatchResults vorliegen (z.B. Tests). */
function restTVsFallback(
  mitarbeiter: Record<string, AnonymerMitarbeiter>,
  anonId: string,
  z: Zuweisung,
  stundenProTV: number,
): number {
  const ma = mitarbeiter[anonId];
  const quartKap = ma ? effektiveJahresStunden(ma) / 4 : 0;
  return Math.floor(Math.max(0, quartKap - z.stunden) / stundenProTV);
}

function toRow(
  a: Antrag,
  anonId: string,
  fallbackScore: number,
  z: Zuweisung,
  mitarbeiter: Record<string, AnonymerMitarbeiter>,
  stundenProTV: number,
  verbuendeById?: ReadonlyMap<string, Verbund>,
  matchesByLead?: Map<string, MatchResult[]>,
): ExportRow {
  const meta = resolveVerbundMeta(verbuendeById?.get(verbundKeyOf(a)), a);
  const matches = matchesByLead?.get(a.aktenzeichen);

  let score = fallbackScore;
  let restTVs: number;
  let alternativen: ExportAlternative[] = [];

  if (matches && matches.length > 0) {
    const assigned = matches.find(m => m.anonId === anonId);
    if (assigned) {
      score = assigned.kompetenzScore;
      restTVs = Math.floor(Math.max(0, assigned.restKapazitaet) / stundenProTV);
    } else {
      restTVs = restTVsFallback(mitarbeiter, anonId, z, stundenProTV);
    }
    alternativen = matches
      .filter(m => m.anonId !== anonId)
      .slice(0, ALT_COUNT)
      .map(m => ({
        anonId: m.anonId,
        kompetenz: m.kompetenzScore,
        tvsFrei: Math.floor(Math.max(0, m.restKapazitaet) / stundenProTV),
      }));
  } else {
    restTVs = restTVsFallback(mitarbeiter, anonId, z, stundenProTV);
  }

  return {
    aktenzeichen: a.aktenzeichen,
    akronym: meta.akronym,
    vbTitel: meta.verbundTitel || '—',
    anzahlTV: z.anzahlTV ?? 1,
    ma: anonId,
    score,
    restTVs,
    confidence: score >= 0.5 ? 'high' : score >= 0.2 ? 'medium' : 'low',
    status: z.status,
    alternativen,
  };
}

/** XLSX-WorkBook aus Export-Zeilen. */
export function buildWorkbook(rows: ExportRow[], quartal: string): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const header = [
    'Aktenzeichen', 'Akronym', 'VB-Titel', 'TVs', 'Empfohlener MA',
    'Passungs-Score', 'Restkapazität (TVs)', 'Confidence', 'Status',
    ...Array.from({ length: ALT_COUNT }, (_, i) => `Option ${i + 1} (Kürzel · Passung · TVs frei)`),
  ];
  const sheetData = [
    header,
    ...rows.map(r => [
      r.aktenzeichen,
      r.akronym,
      r.vbTitel,
      r.anzahlTV,
      r.ma,
      Number(r.score.toFixed(3)),
      r.restTVs,
      r.confidence,
      r.status,
      ...Array.from({ length: ALT_COUNT }, (_, i) => formatAlternative(r.alternativen[i])),
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws['!cols'] = [
    { wch: 18 }, { wch: 16 }, { wch: 40 }, { wch: 6 }, { wch: 10 },
    { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 14 },
    ...Array.from({ length: ALT_COUNT }, () => ({ wch: 32 })),
  ];
  XLSX.utils.book_append_sheet(wb, ws, `Auslastung ${quartal}`);
  return wb;
}

/** Eine Alternative-Zelle: `Kuerzel · 87% · 21 TVs` (leer wenn kein Kandidat). */
function formatAlternative(alt: ExportAlternative | undefined): string {
  if (!alt) return '';
  const name = alt.kuerzel ?? alt.anonId;
  return `${name} · ${Math.round(alt.kompetenz * 100)}% · ${alt.tvsFrei} TVs`;
}

/**
 * De-anonymisierter XLSX-Export — direkter Download mit echten TIB-Kuerzeln.
 * Mappt den zugewiesenen MA UND alle Alternativen anonId→Kuerzel.
 *
 * Dateiname: `auslastung-kuerzel-{quartal}.xlsx`.
 */
export function exportDeAnonymizedXlsx(
  input: BuildRowsInput & { anonymMap: AnonymMap },
): void {
  const quartal = input.quartal ?? input.data.config.aktuellesQuartal;
  const toReal = input.anonymMap.toReal;
  const rows: ExportRow[] = buildExportRows({ ...input, quartal }).map(r => ({
    ...r,
    ma: toReal.get(r.ma) ?? r.ma,
    alternativen: r.alternativen.map(alt => ({ ...alt, kuerzel: toReal.get(alt.anonId) ?? alt.anonId })),
  }));
  const wb = buildWorkbook(rows, quartal);
  XLSX.writeFile(wb, `auslastung-kuerzel-${quartal}.xlsx`);
}
