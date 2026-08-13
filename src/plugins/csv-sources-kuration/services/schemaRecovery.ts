/**
 * Schema-Recovery: stellt CSV-Schemas aus einer guten, nicht-leeren
 * `csv_schemas.jsonl` wieder her — für den Fall, dass ein leer publizierter
 * Snapshot die Schemas eines Consumers gewischt hat (Empty-Guard-Vorfall,
 * siehe [[csv-schema-wipe-empty-guard-v2312]]). Zwei Bausteine:
 *
 *  1) {@link parseSchemaJsonl} — rein: JSONL → validierte CsvSchema-Records
 *     (Fixture-IDs + fremde Programme werden ausgesondert, damit die Recovery
 *     den Share nicht re-kontaminiert). Testbar ohne IDB/DOM.
 *  2) {@link restoreSchemasToIdb} — schreibt die Records in die lokale IDB
 *     (heilt DIESEN Rechner: die CSV-Quellen erscheinen wieder).
 *  3) {@link republishSnapshot} — schreibt einen frischen Snapshot über den
 *     ECHTEN Publish-Pfad (`writeProgrammSnapshot[Delta]`), sodass Datei UND
 *     Manifest garantiert konsistent sind (neues nicht-leeres `csv_schemas` +
 *     neue `snapshotVersion` + passender Hash). Keine Manifest-Handchirurgie —
 *     alle Consumer heilen beim nächsten Sync. Publish-Guard (v2.312) greift
 *     weiter: da die IDB jetzt nicht-leer ist, wird korrekt geschrieben.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { CsvSchema } from '@/core/services/csv/types';
import { putSchema } from '@/core/services/csv/idb-csv';
import { isFixtureSchemaId } from '@/core/services/seed/fixture-ids';
import { writeProgrammSnapshot, writeProgrammSnapshotDelta } from '@/core/services/csv/snapshot';
import { getDatenShareHandle } from '@/core/services/infrastructure/smb-handle';
import { resolveSnapshotAuthor } from '@/core/services/infrastructure/update-author';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import {
  acquireBuildLock,
  releaseLock,
  startHeartbeat,
} from '@/core/services/infrastructure/build-lock';
import { BUILD_LOCK_STUFE } from '@/core/services/csv/constants';
import { isDeltaSnapshotWriteEnabled } from '@/config/feature-flags';

export interface ParsedSchemaFile {
  /** Gültige, nicht-Fixture-Records fürs Ziel-Programm — genau diese werden geschrieben. */
  schemas: CsvSchema[];
  /** Gesamtzahl nicht-leerer Zeilen in der Datei. */
  totalLines: number;
  /** Zeilen, die kein gültiges Schema-Objekt sind (JSON-Fehler oder falsche Form). */
  parseErrors: number;
  /** Gültige Records mit `fixture-real-*`-ID — bewusst ausgesondert (Re-Kontamination). */
  skippedFixtures: number;
  /** Gültige Records eines ANDEREN Programms als das Ziel — ausgesondert. */
  skippedOtherProgramm: number;
}

/**
 * Minimale Struktur-Prüfung: reicht, um einen Schema-Record von Müll zu trennen.
 *
 * `join_key` gehört dazu, obwohl es nach „Detail" aussieht: `findJoinColumn`
 * sucht `e.canonical === schema.join_key`, und bei fehlendem Wert passt
 * `undefined === undefined` auf den ersten custom-Eintrag. Statt des
 * vorgesehenen Abbruchs würden die Row-Hashes dann auf einem beliebigen Feld
 * (im belegten Fall: einem Fließtext) gekeyt. Die Vorschau meldete solche
 * Records bisher als „gültige Schemas" und schrieb sie mit Schritt 2 team-weit
 * auf den Share.
 */
function isCsvSchemaShape(o: unknown): o is CsvSchema {
  if (!o || typeof o !== 'object') return false;
  const r = o as Record<string, unknown>;
  return (
    typeof r.id === 'string' && r.id.length > 0 &&
    typeof r.programm_id === 'string' && r.programm_id.length > 0 &&
    typeof r.join_key === 'string' && r.join_key.length > 0 &&
    !!r.column_mapping && typeof r.column_mapping === 'object'
  );
}

/**
 * Parst eine `csv_schemas.jsonl` (ein JSON-Objekt je Zeile). Behält nur gültige,
 * nicht-Fixture-Records; ist `programmId` gesetzt, zusätzlich nur Records dieses
 * Programms. Rein — keine Seiteneffekte.
 */
export function parseSchemaJsonl(text: string, programmId: string | null): ParsedSchemaFile {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const schemas: CsvSchema[] = [];
  let parseErrors = 0;
  let skippedFixtures = 0;
  let skippedOtherProgramm = 0;

  for (const line of lines) {
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      parseErrors++;
      continue;
    }
    if (!isCsvSchemaShape(obj)) {
      parseErrors++;
      continue;
    }
    if (isFixtureSchemaId(obj.id)) {
      skippedFixtures++;
      continue;
    }
    if (programmId !== null && obj.programm_id !== programmId) {
      skippedOtherProgramm++;
      continue;
    }
    schemas.push(obj);
  }

  return { schemas, totalLines: lines.length, parseErrors, skippedFixtures, skippedOtherProgramm };
}

/** Schreibt die Schema-Records in die lokale IDB (idempotent per `id`) + Audit. */
export async function restoreSchemasToIdb(
  idb: IDBStore,
  schemas: readonly CsvSchema[],
): Promise<number> {
  for (const s of schemas) await putSchema(idb, s);
  await logAudit(idb, {
    action: 'csv_schemas_restored',
    details: { count: schemas.length, ids: schemas.map(s => s.id) },
  }).catch(() => undefined);
  return schemas.length;
}

export type RepublishResult =
  | { status: 'written'; mode: 'delta' | 'full' | 'v1'; snapshotVersion: string }
  | { status: 'no-handle' }
  /** Ein anderer Schreiber hält den Lock — nichts geschrieben. */
  | { status: 'lock-besetzt'; blockingKurator: string; ageMinutes: number };

/**
 * Schreibt einen frischen Snapshot über den echten Publish-Pfad. Delta-Modus mit
 * leerem Change-Set lässt die antraege-Basis unangetastet und schreibt nur die
 * kleinen Stores (inkl. des jetzt nicht-leeren `csv_schemas`) + ein frisches
 * Manifest neu — genau das, was zum Heilen des Shares nötig ist. Unter Build-Lock
 * (mit Heartbeat), analog zum Auto-Refresh-Batch-Write.
 *
 * **Ein besetzter Lock bricht ab.** Bis v4.23.0 verwarf diese Funktion das
 * Ergebnis von `acquireBuildLock` in derselben Zeile und rief `forceLock` —
 * als einziger Publish-Pfad des Moduls ohne Rückfrage und ohne Abbruch
 * (`runAutoRefresh` wirft, `importCsvSource` fragt). Danach schrieb dieser
 * Rechner Manifest und kleine Stores in dasselbe Verzeichnis, in das ein noch
 * laufender Import gleich sein Delta publiziert, und das `finally` löschte
 * anschließend die Lock-Datei, obwohl der andere Lauf noch schrieb. Der Knopf
 * ist zwar dev-only — der dev-Build erbt aber den ECHTEN Team-Share.
 */
export async function republishSnapshot(
  idb: IDBStore,
  programmId: string,
): Promise<RepublishResult> {
  const handle = await getDatenShareHandle(idb);
  if (!handle) return { status: 'no-handle' };

  const author = await resolveSnapshotAuthor(idb);
  const lockRes = await acquireBuildLock(idb, BUILD_LOCK_STUFE, {});
  if (!lockRes.acquired) {
    return {
      status: 'lock-besetzt',
      blockingKurator: lockRes.existing.kurator_name ?? 'unbekannt',
      ageMinutes: lockRes.ageMinutes,
    };
  }
  const hb = startHeartbeat(idb);
  try {
    if (isDeltaSnapshotWriteEnabled()) {
      const r = await writeProgrammSnapshotDelta(idb, handle, programmId, author, { touchedAz: [], removedAz: [] });
      await logAudit(idb, { action: 'snapshot_written', user: author, details: { programmId, source: 'schema_recovery', mode: r.mode } }).catch(() => undefined);
      return { status: 'written', mode: r.mode, snapshotVersion: r.snapshotVersion };
    }
    const r = await writeProgrammSnapshot(idb, handle, programmId, author);
    await logAudit(idb, { action: 'snapshot_written', user: author, details: { programmId, source: 'schema_recovery' } }).catch(() => undefined);
    return { status: 'written', mode: 'v1', snapshotVersion: r.snapshotVersion };
  } finally {
    // stop() wartet den laufenden Schlag ab — sonst legt er die freigegebene
    // Lock-Datei hinterher neu an (Pitfall #52).
    await hb.stop();
    await releaseLock(idb).catch(() => undefined);
  }
}
