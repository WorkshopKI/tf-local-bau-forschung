/**
 * Der eigene Nachhall: Heartbeat-Takt, Freigabe und Selbst-Übernahme (v3.46.1).
 *
 * Belegter Vorfall (Audit-Log, zwei unabhängige Läufe): eine Sekunde NACH dem
 * eigenen `build_lock_release` lag die Lock-Datei wieder da — mit dem eigenen
 * Namen und frischem Zeitstempel. Ursache: `clearInterval` stoppt nur künftige
 * Schläge; ein bereits gestarteter Schlag lief weiter (sein erstes `await` ist
 * ein IDB-Read) und legte die gerade gelöschte Datei über `atomicWrite`
 * (löscht Ziel → benennt `.tmp` um) neu an.
 *
 * SMB/IDB sind hier gemockt (In-Memory-Dateimap); getestet werden die ECHTEN
 * `acquireBuildLock`/`heartbeat`/`startHeartbeat`/`releaseLock`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  dateien: new Map<string, string>(),
  audit: [] as { action: string; details?: unknown }[],
  /** Gate, das ein laufendes `atomicWrite` künstlich anhält. */
  schreibGate: null as Promise<void> | null,
  /** Simuliert ein stilles Scheitern von `removeFile` (SMB-Sharing-Violation). */
  loeschenScheitertNoch: 0,
  eigenerName: 'THü (PL)',
}));

vi.mock('../smb-handle', () => ({
  getDatenShareHandle: async () => ({}) as FileSystemDirectoryHandle,
  getInternHandle: async () => ({}) as FileSystemDirectoryHandle,
}));

vi.mock('../atomic-write', () => ({
  atomicWrite: async (_root: unknown, pfad: string, daten: string) => {
    if (h.schreibGate) await h.schreibGate;
    h.dateien.set(pfad, daten);
  },
  readText: async (_root: unknown, pfad: string) => h.dateien.get(pfad) ?? null,
  removeFile: async (_root: unknown, pfad: string) => {
    // Der echte removeFile schluckt Fehler still — hier als No-op nachgebildet.
    if (h.loeschenScheitertNoch > 0) { h.loeschenScheitertNoch--; return; }
    h.dateien.delete(pfad);
  },
}));

vi.mock('../audit-log', () => ({
  logAudit: async (_idb: unknown, e: { action: string; details?: unknown }) => { h.audit.push(e); },
}));

vi.mock('../update-author', () => ({
  resolveSnapshotAuthor: async () => h.eigenerName,
}));

import {
  acquireBuildLock,
  releaseLock,
  heartbeat,
  startHeartbeat,
  eigeneOwnerId,
  CSV_IMPORT_STALE_HEARTBEAT_MS,
} from '../build-lock';
import { BUILD_LOCK_PATH } from '../types';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { BuildLock } from '../types';

const idb = {} as IDBStore;
const STUFE = 'csv-import';

function gelesenerLock(): BuildLock | null {
  const roh = h.dateien.get(BUILD_LOCK_PATH);
  return roh ? (JSON.parse(roh) as BuildLock) : null;
}

function legeLock(teil: Partial<BuildLock>): void {
  const lock: BuildLock = {
    programm_id: 'programm',
    stufe: STUFE,
    hostname: 'Win32',
    kurator_name: h.eigenerName,
    gestartet: new Date().toISOString(),
    heartbeat: new Date().toISOString(),
    ...teil,
  };
  h.dateien.set(BUILD_LOCK_PATH, JSON.stringify(lock));
}

function aktionen(): string[] {
  return h.audit.map(e => e.action);
}

beforeEach(async () => {
  h.dateien.clear();
  h.audit.length = 0;
  h.schreibGate = null;
  h.loeschenScheitertNoch = 0;
  h.eigenerName = 'THü (PL)';
  // Modul-internen Halte-Zustand zurücksetzen: releaseLock setzt ihn in jedem
  // Fall auf false (auch ohne vorhandenen Lock).
  await releaseLock(idb);
  h.dateien.clear();
  h.audit.length = 0;
});

describe('startHeartbeat — stop() wartet den laufenden Schlag ab', () => {
  it('gibt erst frei, wenn der Schlag durch ist — die Datei bleibt danach weg', async () => {
    await acquireBuildLock(idb, STUFE);
    expect(gelesenerLock()).not.toBeNull();

    // Ein Schlag hängt im Write fest (auf Citrix: SMB-Latenz + IDB unter Last).
    let freigeben = (): void => {};
    h.schreibGate = new Promise<void>(res => { freigeben = () => { res(); }; });

    const hb = startHeartbeat(idb, 1);
    // Warten, bis der Schlag wirklich im gehaltenen Write steht.
    await new Promise(res => setTimeout(res, 20));

    let stopFertig = false;
    const stopLaeuft = hb.stop().then(() => { stopFertig = true; });
    await new Promise(res => setTimeout(res, 20));
    expect(stopFertig).toBe(false); // ← genau das konnte clearInterval nicht

    freigeben();
    h.schreibGate = null;
    await stopLaeuft;
    expect(stopFertig).toBe(true);

    await releaseLock(idb);
    expect(gelesenerLock()).toBeNull();
  });

  it('Gegenprobe: ein ungestoppter Schlag legt die Datei NACH der Freigabe wieder an', async () => {
    await acquireBuildLock(idb, STUFE);

    let freigeben = (): void => {};
    h.schreibGate = new Promise<void>(res => { freigeben = () => { res(); }; });
    // Fire-and-forget wie im alten `setInterval`-Muster: niemand wartet darauf.
    const nachhall = heartbeat(idb);
    await new Promise(res => setTimeout(res, 10));

    const ergebnis = await releaseLock(idb);
    expect(ergebnis).toBe('freigegeben');
    expect(gelesenerLock()).toBeNull();

    freigeben();
    h.schreibGate = null;
    await nachhall;

    // Der Lock ist wieder da — mit der EIGENEN Kennung. Genau dieser Zustand
    // ließ die nächste Quelle des Laufs gegen sich selbst laufen.
    expect(gelesenerLock()?.owner_id).toBe(eigeneOwnerId());
  });
});

describe('heartbeat', () => {
  it('hält einen FREMDEN Lock nicht frisch', async () => {
    const alt = new Date(Date.now() - 60_000).toISOString();
    legeLock({ owner_id: 'owner-fremd', kurator_name: 'BIB', heartbeat: alt });

    await heartbeat(idb);

    expect(gelesenerLock()?.heartbeat).toBe(alt);
  });

  it('schreibt nicht, wenn darfSchreiben() false meldet', async () => {
    const alt = new Date(Date.now() - 60_000).toISOString();
    legeLock({ owner_id: eigeneOwnerId(), heartbeat: alt });

    await heartbeat(idb, () => false);

    expect(gelesenerLock()?.heartbeat).toBe(alt);
  });
});

describe('releaseLock — ehrlich statt behauptend', () => {
  it('meldet fehlgeschlagen und protokolliert build_lock_release_failed', async () => {
    await acquireBuildLock(idb, STUFE);
    h.audit.length = 0;
    h.loeschenScheitertNoch = 99; // Löschen greift nie

    const ergebnis = await releaseLock(idb);

    expect(ergebnis).toBe('fehlgeschlagen');
    expect(aktionen()).toContain('build_lock_release_failed');
    expect(aktionen()).not.toContain('build_lock_release');
  });

  it('greift beim zweiten Versuch → freigegeben mit versuche: 2', async () => {
    await acquireBuildLock(idb, STUFE);
    h.audit.length = 0;
    h.loeschenScheitertNoch = 1;

    const ergebnis = await releaseLock(idb);

    expect(ergebnis).toBe('freigegeben');
    const eintrag = h.audit.find(e => e.action === 'build_lock_release');
    expect((eintrag?.details as { versuche?: number })?.versuche).toBe(2);
  });

  it('fremde Übernahme im Mikro-Fenster ist KEIN Fehlschlag', async () => {
    await acquireBuildLock(idb, STUFE);
    h.audit.length = 0;
    // Nach unserem Löschen legt ein anderer Client seinen Lock an.
    h.loeschenScheitertNoch = 1;
    legeLock({ owner_id: 'owner-fremd', kurator_name: 'BIB' });

    const ergebnis = await releaseLock(idb);

    expect(ergebnis).toBe('fremd-uebernommen');
    expect(aktionen()).toContain('build_lock_release');
    expect(aktionen()).not.toContain('build_lock_release_failed');
  });
});

describe('acquireBuildLock — Besitz', () => {
  it('übernimmt das eigene Überbleibsel statt zu blockieren', async () => {
    // Genau der belegte Zustand: eigener Lock, frischer Heartbeat, Lauf beendet.
    await acquireBuildLock(idb, STUFE);
    const meiner = h.dateien.get(BUILD_LOCK_PATH)!;
    await releaseLock(idb);
    h.dateien.set(BUILD_LOCK_PATH, meiner); // der Nachhall
    h.audit.length = 0;

    const res = await acquireBuildLock(idb, STUFE);

    expect(res.acquired).toBe(true);
    expect(res.acquired && res.uebernommen).toBe('eigener-verwaister');
    expect(aktionen()).toContain('build_lock_uebernahme_eigen');
  });

  it('nimmt sich den eigenen AKTIVEN Lock NICHT (zweiter Flow im selben Tab)', async () => {
    await acquireBuildLock(idb, STUFE);

    const res = await acquireBuildLock(idb, STUFE);

    expect(res.acquired).toBe(false);
    expect(!res.acquired && res.besitz).toBe('eigener-tab');
  });

  it('blockiert bei fremdem frischem Lock', async () => {
    legeLock({ owner_id: 'owner-fremd', kurator_name: 'BIB' });

    const res = await acquireBuildLock(idb, STUFE);

    expect(res.acquired).toBe(false);
    expect(!res.acquired && res.besitz).toBe('fremd');
  });

  it('erkennt „anderes Fenster unter deinem Namen"', async () => {
    legeLock({ owner_id: 'owner-fremd', kurator_name: h.eigenerName });

    const res = await acquireBuildLock(idb, STUFE);

    expect(res.acquired).toBe(false);
    expect(!res.acquired && res.besitz).toBe('gleicher-name');
  });

  it('übernimmt einen stalen Fremd-Lock weiterhin automatisch', async () => {
    legeLock({
      owner_id: 'owner-fremd',
      kurator_name: 'BIB',
      heartbeat: new Date(Date.now() - CSV_IMPORT_STALE_HEARTBEAT_MS - 60_000).toISOString(),
    });

    const res = await acquireBuildLock(idb, STUFE);

    expect(res.acquired).toBe(true);
    expect(res.acquired && res.uebernommen).toBeUndefined();
  });
});
