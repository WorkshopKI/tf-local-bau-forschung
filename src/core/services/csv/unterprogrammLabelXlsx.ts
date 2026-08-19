import * as XLSX from 'xlsx';
import type { IDBStore } from '../storage/idb-store';
import { logAudit } from '../infrastructure/audit-log';
import type { Unterprogramm } from './types';
import { listUnterprogrammeByProgramm } from './idb-csv';
import { saveUnterprogramm } from './unterprogrammRegistry';

/** Eine Zeile aus der Label-XLSX (id/label/jahr). */
export interface UnterprogrammLabelEntry {
  code: string;
  label: string;
  jahr?: string;
}

export type UnterprogrammLabelChangeKind =
  | 'name_changed'
  | 'zeitraum_changed'
  | 'both_changed'
  | 'unchanged'
  | 'unknown_code';

export interface UnterprogrammLabelDiffRow {
  code: string;
  label: string;
  jahr?: string;
  /** Bestehender Eintrag aus IDB (undefined wenn unknown_code). */
  existing?: Unterprogramm;
  kind: UnterprogrammLabelChangeKind;
  /** Welche Felder vom Apply geändert würden. */
  willChangeName: boolean;
  willChangeJahr: boolean;
}

export interface UnterprogrammLabelDiff {
  rows: UnterprogrammLabelDiffRow[];
  /** Kurzfassung für Audit/Toast. */
  summary: {
    name_changed: number;
    zeitraum_changed: number;
    unchanged: number;
    unknown: number;
  };
}

/**
 * Parst eine XLSX-Datei mit Header-Zeile + Spalten id/label/jahr (case-insensitive).
 *
 * - Erste Zeile = Header. Spalten werden lower-case + trim verglichen.
 * - Erkennt Spaltennamen `id`, `label`, `jahr` (deutsch).
 * - Number-IDs werden zu String konvertiert (Excel speichert oft numerisch).
 * - Leere Zeilen werden übersprungen.
 *
 * Wirft mit klarer Meldung wenn Pflicht-Spalten fehlen.
 */
export async function parseUnterprogrammLabelXlsx(file: File): Promise<UnterprogrammLabelEntry[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) throw new Error('XLSX-Datei enthält kein Tabellenblatt.');
  const ws = wb.Sheets[firstSheet];
  if (!ws) throw new Error('Erstes Tabellenblatt ist leer.');

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: '' });
  if (rows.length < 2) throw new Error('XLSX enthält keine Daten unter dem Header.');

  const header = rows[0]!.map(c => String(c ?? '').trim().toLowerCase());
  const idCol = header.indexOf('id');
  const labelCol = header.indexOf('label');
  const jahrCol = header.indexOf('jahr');
  if (idCol === -1 || labelCol === -1) {
    throw new Error('Pflicht-Spalten "id" und "label" wurden nicht gefunden. Vorhandene Header: ' + header.join(', '));
  }

  const out: UnterprogrammLabelEntry[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const idRaw = row[idCol];
    const labelRaw = row[labelCol];
    const jahrRaw = jahrCol >= 0 ? row[jahrCol] : undefined;
    const code = idRaw === undefined || idRaw === null ? '' : String(idRaw).trim();
    const label = labelRaw === undefined || labelRaw === null ? '' : String(labelRaw).trim();
    if (!code && !label) continue; // leere Zeile
    if (!code) continue; // Label ohne Code → keine eindeutige Zuordnung
    const jahr = jahrRaw === undefined || jahrRaw === null ? undefined : String(jahrRaw).trim() || undefined;
    out.push({ code, label, jahr });
  }
  return out;
}

/**
 * Vergleicht den XLSX-Import gegen die in IDB vorhandenen Unterprogramme.
 * Reine Funktion — leicht testbar, kein IDB-Zugriff.
 */
export function computeUnterprogrammLabelDiff(
  existing: Unterprogramm[],
  imported: UnterprogrammLabelEntry[],
): UnterprogrammLabelDiff {
  const byCode = new Map<string, Unterprogramm>();
  for (const up of existing) byCode.set(up.code, up);

  const rows: UnterprogrammLabelDiffRow[] = [];
  let nameChanged = 0;
  let zeitraumChanged = 0;
  let unchanged = 0;
  let unknown = 0;

  for (const entry of imported) {
    const ex = byCode.get(entry.code);
    if (!ex) {
      rows.push({
        code: entry.code,
        label: entry.label,
        jahr: entry.jahr,
        kind: 'unknown_code',
        willChangeName: false,
        willChangeJahr: false,
      });
      unknown++;
      continue;
    }
    const newName = entry.label || undefined;
    const newJahr = entry.jahr || undefined;
    const willChangeName = (ex.name ?? undefined) !== newName;
    const willChangeJahr = (ex.geplanter_zeitraum ?? undefined) !== newJahr;

    let kind: UnterprogrammLabelChangeKind;
    if (willChangeName && willChangeJahr) {
      kind = 'both_changed';
      nameChanged++;
      zeitraumChanged++;
    } else if (willChangeName) {
      kind = 'name_changed';
      nameChanged++;
    } else if (willChangeJahr) {
      kind = 'zeitraum_changed';
      zeitraumChanged++;
    } else {
      kind = 'unchanged';
      unchanged++;
    }

    rows.push({
      code: entry.code,
      label: entry.label,
      jahr: entry.jahr,
      existing: ex,
      kind,
      willChangeName,
      willChangeJahr,
    });
  }

  return { rows, summary: { name_changed: nameChanged, zeitraum_changed: zeitraumChanged, unchanged, unknown } };
}

/**
 * Welche FELDER der Import schreiben darf.
 *
 * Bis v4.119 gab es diese Achse nicht: die Knöpfe „Nur Labels" / „Nur Jahr"
 * schränkten allein die ZEILEN-Menge ein (`name_changed` + `both_changed`
 * bzw. `zeitraum_changed` + `both_changed`) — und `both_changed` steht in
 * beiden Mengen. Für eine Zeile, in der sich Label UND Jahr geändert hatten,
 * schrieb der Apply darum beides, egal welcher Knopf gedrückt war. Der Knopf
 * hielt nicht, was er beschriftete.
 */
export type UnterprogrammLabelFeldWahl = 'beide' | 'name' | 'jahr';

/** Schreibt diese Zeile unter der gewählten Feld-Achse überhaupt etwas? */
export function zeileSchreibtEtwas(
  row: UnterprogrammLabelDiffRow,
  felder: UnterprogrammLabelFeldWahl,
): boolean {
  if (row.kind === 'unknown_code' || row.kind === 'unchanged') return false;
  return (row.willChangeName && felder !== 'jahr') || (row.willChangeJahr && felder !== 'name');
}

/**
 * Wendet die per `selectedCodes` ausgewählten Diff-Zeilen an.
 * - Schreibt nur Zeilen, deren `code` in `selectedCodes` ist.
 * - Überspringt `unknown_code`-Zeilen unbedingt (kein Auto-Anlegen).
 * - `felder` grenzt zusätzlich die SPALTEN ein (siehe `UnterprogrammLabelFeldWahl`).
 * - Audit-Event mit Counts der tatsächlich geschriebenen Felder.
 */
export async function applyUnterprogrammLabelDiff(
  idb: IDBStore,
  programmId: string,
  diff: UnterprogrammLabelDiff,
  selectedCodes: Set<string>,
  kuratorName?: string,
  felder: UnterprogrammLabelFeldWahl = 'beide',
): Promise<{ written: number; nameWrites: number; zeitraumWrites: number }> {
  let written = 0;
  let nameWrites = 0;
  let zeitraumWrites = 0;

  for (const row of diff.rows) {
    if (!selectedCodes.has(row.code)) continue;
    if (!zeileSchreibtEtwas(row, felder)) continue;
    if (!row.existing) continue;

    const schreibeName = row.willChangeName && felder !== 'jahr';
    const schreibeJahr = row.willChangeJahr && felder !== 'name';

    await saveUnterprogramm(idb, {
      id: row.existing.id,
      programm_id: row.existing.programm_id,
      code: row.existing.code,
      aktiv: row.existing.aktiv,
      // Leerer String statt `undefined`: eine Zeile, die auf „→ —" steht,
      // MEINT das Leeren. `undefined` hiesse „nicht mitgeschickt" und liesse
      // den alten Wert stehen — die Vorschau haette dann etwas versprochen,
      // was der Lauf nicht tut (v4.119).
      name: schreibeName ? row.label : row.existing.name,
      geplanter_zeitraum: schreibeJahr
        ? (row.jahr ?? '')
        : row.existing.geplanter_zeitraum,
    });
    written++;
    if (schreibeName) nameWrites++;
    if (schreibeJahr) zeitraumWrites++;
  }

  await logAudit(idb, {
    action: 'unterprogramm_labels_imported',
    user: kuratorName,
    details: {
      programm_id: programmId,
      total_rows: diff.rows.length,
      felder,
      written,
      name_changes: nameWrites,
      zeitraum_changes: zeitraumWrites,
      unknown_codes: diff.summary.unknown,
    },
  });

  return { written, nameWrites, zeitraumWrites };
}

/** Convenience: lädt Bestand + computiert Diff in einem Call. */
export async function buildUnterprogrammLabelDiff(
  idb: IDBStore,
  programmId: string,
  imported: UnterprogrammLabelEntry[],
): Promise<UnterprogrammLabelDiff> {
  const existing = await listUnterprogrammeByProgramm(idb, programmId);
  return computeUnterprogrammLabelDiff(existing, imported);
}
