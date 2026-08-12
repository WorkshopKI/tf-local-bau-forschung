/**
 * Build-Lock (Phase 1a + v1.9).
 *
 * Schema Sektion 10.6: `_intern/build-lock.json` verhindert parallele Builds.
 * Stale-Detection: Heartbeat älter als 2h → Lock gilt als abgestürzt und
 * kann direkt übernommen werden.
 *
 * v3.46.1 — drei Härtungen gegen den „eigenen Nachhall" (siehe Pitfall #52):
 *   1. `owner_id` macht entscheidbar, ob ein vorgefundener Lock das eigene
 *      Überbleibsel ist — dann wird er übernommen statt zu blockieren.
 *   2. `startHeartbeat` gibt einen Takt zurück, dessen `stop()` den bereits
 *      laufenden Schlag ABWARTET. `clearInterval` allein tut das nicht: der
 *      Schlag lief weiter und legte die gerade freigegebene Lock-Datei neu an.
 *   3. `releaseLock` prüft nach, ob das Löschen gegriffen hat, statt Erfolg zu
 *      behaupten (der Audit-Eintrag log bis dahin auch bei Fehlschlag).
 */

import { getInternHandle, getDatenShareHandle } from './smb-handle';
import { atomicWrite, readText, removeFile } from './atomic-write';
import { logAudit } from './audit-log';
import { uuid } from '@/core/services/id-generator';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { BuildLock } from './types';
import { BUILD_LOCK_PATH, PROGRAMM_DIR_NAME } from './types';
import { resolveSnapshotAuthor } from './update-author';

export const STALE_HEARTBEAT_MS = 2 * 60 * 60 * 1000;

/**
 * Stufen-spezifische Stale-Schwelle für die CSV-Import-Stufe (v2.61.5).
 *
 * Hintergrund: Der CSV-Import (`stufe = 'csv-import'`, siehe
 * `BUILD_LOCK_STUFE` in `csv/constants.ts`) hält den Lock über parse → diff →
 * merge → snapshot. Stürzt der Tab dabei ab (z.B. Citrix-OOM), läuft das
 * `finally { releaseLock }` im Importer nie → der Lock bleibt auf dem Share
 * liegen und blockierte bisher das ganze Team bis zur 2h-Default-Schwelle.
 *
 * Der Importer schreibt jetzt alle `HEARTBEAT_INTERVAL_MS` einen Heartbeat
 * (siehe importer.ts). Damit ist ein AKTIVER Import immer frisch und ein
 * abgestürzter räumt sich nach dieser kurzen Schwelle selbst ab — passend zur
 * Banner-Aussage „in 2-3 Min erneut versuchen". Die lange Default-Schwelle
 * bleibt für andere Stufen (v.a. den ~46-min-Embedding-Build) erhalten.
 */
export const CSV_IMPORT_STALE_HEARTBEAT_MS = 3 * 60 * 1000;

/** Heartbeat-Intervall für lang laufende, gelockte Operationen (Importer). */
export const HEARTBEAT_INTERVAL_MS = 15 * 1000;

/** Wartezeit vor dem zweiten Lösch-Versuch in {@link releaseLock}. */
export const RELEASE_RETRY_DELAY_MS = 200;

/** CSV-Import-Stufenname — muss mit `BUILD_LOCK_STUFE` in `csv/constants.ts`
 *  übereinstimmen (Infrastructure-Layer importiert bewusst NICHT aus dem
 *  höheren csv-Service → der Wire-String wird hier gespiegelt). */
const CSV_IMPORT_STUFE = 'csv-import';

/** Stale-Schwelle abhängig von der Lock-Stufe. */
export function staleThresholdForStufe(stufe: string): number {
  return stufe === CSV_IMPORT_STUFE ? CSV_IMPORT_STALE_HEARTBEAT_MS : STALE_HEARTBEAT_MS;
}

/**
 * Kennung DIESER Modul-Ladung (= dieses Tabs). Bewusst NICHT in der IDB
 * persistiert: nach einem Reload ist es absichtlich ein anderer Halter — sonst
 * könnte ein frisch geladener Tab den Lock eines noch lebenden Zweit-Tabs
 * stehlen. Ein Lock, den ein abgestürzter Tab hinterlässt, räumt weiterhin die
 * Stale-Schwelle ab (3 Min für `csv-import`).
 */
const OWNER_ID = uuid();

export function eigeneOwnerId(): string {
  return OWNER_ID;
}

/**
 * Glaubt dieses Modul gerade, den Lock zu halten? Zweite Bedingung der
 * Selbst-Übernahme: ohne sie könnten zwei parallele Flows im SELBEN Tab (ein
 * Dialog-Reimport während eines Auto-Refresh — die Dialoge hängen nicht am
 * `data-mutation-gate`) sich den aktiven Lock kommentarlos wegnehmen, wo sie
 * heute korrekt blockieren.
 */
let haeltLock = false;

export async function readBuildLock(idb: IDBStore): Promise<BuildLock | null> {
  const parent = await getDatenShareHandle(idb);
  if (!parent) return null;
  const text = await readText(parent, BUILD_LOCK_PATH);
  if (!text) return null;
  try {
    const raw = JSON.parse(text) as BuildLock & { admin_name?: string };
    const kurator_name = raw.kurator_name ?? raw.admin_name ?? 'unknown';
    return { ...raw, kurator_name };
  } catch {
    return null;
  }
}

function ageMinutes(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Infinity;
  return Math.max(0, (Date.now() - t) / 60_000);
}

export function isStale(lock: BuildLock): boolean {
  return ageMinutes(lock.heartbeat) * 60_000 > staleThresholdForStufe(lock.stufe);
}

/**
 * Wem gehört dieser Lock aus Sicht dieses Tabs? `owner_id` schlägt
 * Namensgleichheit — derselbe Mensch in einem zweiten Fenster ist NICHT
 * derselbe Halter, und ein Lock aus einem älteren Build (ohne `owner_id`)
 * gilt nie als eigener.
 */
export type LockBesitz = 'fremd' | 'eigener-tab' | 'gleicher-name';

export function bestimmeLockBesitz(
  lock: Pick<BuildLock, 'owner_id' | 'kurator_name'>,
  eigene: string,
  eigenerName?: string,
): LockBesitz {
  if (lock.owner_id && lock.owner_id === eigene) return 'eigener-tab';
  if (eigenerName && lock.kurator_name && lock.kurator_name === eigenerName) return 'gleicher-name';
  return 'fremd';
}

/**
 * Darf ein AKTIVER (nicht-staler) Lock kommentarlos übernommen werden? Nur wenn
 * er dieselbe `owner_id` trägt UND dieses Modul gerade NICHT glaubt, ihn zu
 * halten — also genau dann, wenn er das Überbleibsel eines eigenen, bereits
 * beendeten Laufs ist.
 */
export function darfEigenenLockUebernehmen(
  lock: Pick<BuildLock, 'owner_id'>,
  eigene: string,
  haeltSelbstBereits: boolean,
): boolean {
  if (haeltSelbstBereits) return false;
  return !!lock.owner_id && lock.owner_id === eigene;
}

/**
 * Wie ist der Freigabe-Versuch nach dem Verifikations-Read ausgegangen? Trennt
 * „meine Datei ist wieder da" (Löschen scheiterte oder ein später Heartbeat hat
 * sie neu angelegt) von „jemand anders hat inzwischen acquired" (kein Fehler).
 */
export type FreigabeBefund = 'freigegeben' | 'fremd-uebernommen' | 'noch-eigener';

export function bewerteFreigabe(
  nachRelease: Pick<BuildLock, 'owner_id'> | null,
  eigene: string,
): FreigabeBefund {
  if (!nachRelease) return 'freigegeben';
  if (nachRelease.owner_id && nachRelease.owner_id === eigene) return 'noch-eigener';
  return 'fremd-uebernommen';
}

function hostname(): string {
  return (typeof navigator !== 'undefined' && navigator.platform) || 'unknown-host';
}

function baueLock(stufe: string, kuratorName: string, programmId?: string): BuildLock {
  const now = new Date().toISOString();
  return {
    programm_id: programmId ?? PROGRAMM_DIR_NAME,
    stufe,
    hostname: hostname(),
    kurator_name: kuratorName,
    owner_id: OWNER_ID,
    gestartet: now,
    heartbeat: now,
  };
}

async function writeLock(
  parent: FileSystemDirectoryHandle,
  lock: BuildLock,
): Promise<void> {
  await getInternHandle(parent);
  await atomicWrite(parent, BUILD_LOCK_PATH, JSON.stringify(lock, null, 2), {
    skipBackup: true,
  });
}

export type AcquireResult =
  | { acquired: true; lock: BuildLock; uebernommen?: 'eigener-verwaister' }
  | { acquired: false; existing: BuildLock; ageMinutes: number; besitz: LockBesitz };

/**
 * Versucht den Lock zu übernehmen. Stale-Locks und eigene Überbleibsel werden
 * direkt überschrieben. Fremde aktive Locks blockieren — Caller zeigt Dialog
 * und ruft ggf. forceLock.
 */
export async function acquireBuildLock(
  idb: IDBStore,
  stufe: string,
  opts: { programm_id?: string } = {},
): Promise<AcquireResult> {
  const parent = await getDatenShareHandle(idb);
  if (!parent) throw new Error('SMB-Handle nicht verfügbar');
  // Vor dem Existing-Check: der Blockier-Zweig braucht den eigenen Namen, um
  // „anderes Fenster unter deinem Namen" von „echter Fremd-Lock" zu trennen.
  // resolveSnapshotAuthor liest nur die IDB und wirft nicht.
  const kuratorName = await resolveSnapshotAuthor(idb);
  const existing = await readBuildLock(idb);
  let uebernommen: 'eigener-verwaister' | undefined;

  if (existing && !isStale(existing)) {
    if (!darfEigenenLockUebernehmen(existing, OWNER_ID, haeltLock)) {
      return {
        acquired: false,
        existing,
        ageMinutes: ageMinutes(existing.heartbeat),
        besitz: bestimmeLockBesitz(existing, OWNER_ID, kuratorName),
      };
    }
    uebernommen = 'eigener-verwaister';
    await logAudit(idb, {
      action: 'build_lock_uebernahme_eigen',
      user: kuratorName,
      details: {
        stufe,
        vorher: { stufe: existing.stufe, alterMin: Math.round(ageMinutes(existing.heartbeat)) },
      },
    });
  }

  const lock = baueLock(stufe, kuratorName, opts.programm_id);
  await writeLock(parent, lock);
  haeltLock = true;
  await logAudit(idb, { action: 'build_lock_acquire', user: kuratorName, details: { stufe } });
  return uebernommen ? { acquired: true, lock, uebernommen } : { acquired: true, lock };
}

/** Überschreibt aktiven Lock. Schreibt Audit-Eintrag. */
export async function forceLock(
  idb: IDBStore,
  stufe: string,
  opts: { programm_id?: string } = {},
): Promise<BuildLock> {
  const parent = await getDatenShareHandle(idb);
  if (!parent) throw new Error('SMB-Handle nicht verfügbar');
  const previous = await readBuildLock(idb);
  const kuratorName = await resolveSnapshotAuthor(idb);
  const lock = baueLock(stufe, kuratorName, opts.programm_id);
  await writeLock(parent, lock);
  // Ohne dieses Setzen hielte ein späteres acquireBuildLock im selben Tab den
  // eigenen AKTIVEN Lock für ein verwaistes Überbleibsel.
  haeltLock = true;
  await logAudit(idb, {
    action: 'build_lock_force',
    user: kuratorName,
    details: { stufe, previous: previous ? { kurator: previous.kurator_name, stufe: previous.stufe } : null },
  });
  return lock;
}

/**
 * Hält den eigenen Lock frisch. `darfSchreiben` wird UNMITTELBAR vor dem Write
 * nochmal geprüft, damit ein Schlag, der zwischen Start und Write gestoppt
 * wurde, nichts mehr auf den Share legt.
 */
export async function heartbeat(
  idb: IDBStore,
  darfSchreiben: () => boolean = () => true,
): Promise<void> {
  const parent = await getDatenShareHandle(idb);
  if (!parent) return;
  if (!darfSchreiben()) return;
  const current = await readBuildLock(idb);
  if (!current) return;
  // Nie einen FREMDEN Lock frisch halten: ein verirrter Schlag aus einem
  // beendeten Lauf verlängerte sonst die Lebensdauer eines fremden Schreibers.
  // Locks ohne `owner_id` (ältere Builds) bleiben tolerant, damit ein während
  // der Umstellung laufender Vorgang nicht abgeschnitten wird.
  if (current.owner_id && current.owner_id !== OWNER_ID) return;
  if (!darfSchreiben()) return;
  const next: BuildLock = { ...current, heartbeat: new Date().toISOString() };
  await writeLock(parent, next);
}

export interface HeartbeatRunner {
  /** Stoppt den Takt UND wartet den ggf. laufenden Schlag ab. */
  stop: () => Promise<void>;
}

/**
 * Startet den Heartbeat-Takt für eine gelockte Operation.
 *
 * Warum ein Runner statt `setInterval` + `clearInterval`: `clearInterval`
 * verhindert nur KÜNFTIGE Schläge. Ein bereits gestarteter Schlag läuft weiter
 * — sein erstes `await` ist ein IDB-Read, der unter der Schreiblast eines
 * Imports Sekunden warten kann. Kam er nach dem `releaseLock` durch, legte er
 * die gerade gelöschte Lock-Datei neu an (mit eigenem Namen und frischem
 * Zeitstempel), und der nächste Schritt desselben Laufs lief gegen den eigenen
 * Nachhall. `stop()` wartet den laufenden Schlag deshalb ab.
 */
export function startHeartbeat(
  idb: IDBStore,
  intervalMs: number = HEARTBEAT_INTERVAL_MS,
): HeartbeatRunner {
  let gestoppt = false;
  let laufend: Promise<void> | null = null;

  const timer = setInterval(() => {
    if (gestoppt || laufend) return;
    laufend = heartbeat(idb, () => !gestoppt)
      .catch(() => undefined)
      .finally(() => { laufend = null; });
  }, intervalMs);

  return {
    stop: async () => {
      gestoppt = true;
      clearInterval(timer);
      await laufend?.catch(() => undefined);
    },
  };
}

/** Dev-Helper: Setzt den Heartbeat künstlich zurück (für Stale-Test). */
export async function setHeartbeatAge(idb: IDBStore, minutesAgo: number): Promise<void> {
  const parent = await getDatenShareHandle(idb);
  if (!parent) return;
  const current = await readBuildLock(idb);
  if (!current) return;
  const shifted: BuildLock = {
    ...current,
    heartbeat: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  };
  await writeLock(parent, shifted);
}

export type ReleaseErgebnis = 'war-leer' | 'freigegeben' | 'fremd-uebernommen' | 'fehlgeschlagen';

function warte(ms: number): Promise<void> {
  return new Promise(resolve => { setTimeout(resolve, ms); });
}

async function loescheUndPruefe(
  parent: FileSystemDirectoryHandle,
  idb: IDBStore,
): Promise<FreigabeBefund> {
  await removeFile(parent, BUILD_LOCK_PATH).catch(() => undefined);
  return bewerteFreigabe(await readBuildLock(idb), OWNER_ID);
}

/**
 * Gibt den Lock frei und PRÜFT das nach. Der Lösch-Fehler wird an zwei Stellen
 * geschluckt (`removeIfExists` + `.catch`), der Erfolgs-Audit-Eintrag wurde
 * trotzdem geschrieben — ein liegengebliebener Lock sah im Log wie eine saubere
 * Freigabe aus. Jetzt: einmal nachfassen, und wenn er bleibt, das auch so
 * protokollieren (`build_lock_release_failed`).
 */
export async function releaseLock(idb: IDBStore): Promise<ReleaseErgebnis> {
  try {
    const parent = await getDatenShareHandle(idb);
    if (!parent) return 'war-leer';
    const existing = await readBuildLock(idb);

    let befund = await loescheUndPruefe(parent, idb);
    let versuche = 1;
    if (befund === 'noch-eigener') {
      await warte(RELEASE_RETRY_DELAY_MS);
      befund = await loescheUndPruefe(parent, idb);
      versuche = 2;
    }

    if (!existing) return 'war-leer';

    if (befund === 'noch-eigener') {
      console.warn('[build-lock] Freigabe hat nicht gegriffen — Lock liegt weiter auf dem Share');
      await logAudit(idb, {
        action: 'build_lock_release_failed',
        user: existing.kurator_name,
        details: { stufe: existing.stufe, versuche },
      });
      return 'fehlgeschlagen';
    }

    await logAudit(idb, {
      action: 'build_lock_release',
      user: existing.kurator_name,
      details: {
        stufe: existing.stufe,
        ...(versuche > 1 ? { versuche } : {}),
        ...(befund === 'fremd-uebernommen' ? { nachfolger: 'fremd' } : {}),
      },
    });
    return befund;
  } finally {
    // Auch bei Fehlschlag: das nächste acquireBuildLock soll das Überbleibsel
    // als verwaist erkennen und übernehmen dürfen. Das ist die Selbstheilung —
    // eine durchgerutschte Auferstehung kostet dann einen Audit-Eintrag statt
    // eines abgebrochenen Laufs.
    haeltLock = false;
  }
}
