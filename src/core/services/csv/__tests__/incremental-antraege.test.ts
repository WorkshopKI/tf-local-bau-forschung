/**
 * Sichert die inkrementelle antraege-Snapshot-Sync ab (v2.96): nur geaenderte
 * Records werden geschrieben, entfernte geloescht — der Store + die Slim-
 * Projektion muessen danach EXAKT dem neuen Snapshot entsprechen (keine
 * verlorenen/stale Records, Korrektheit vor Tempo auf dem Cold-Start-Pfad).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '../../storage/idb-store';
import {
  putProgramm,
  putAntraege,
  putAntraegeListView,
  listAntraegeByProgramm,
  listAntraegeListViewByProgramm,
} from '../idb-csv';
import { toAntragListItem } from '../list-view';
import {
  diffAntraegeLines,
  buildAntraegeHashes,
  applyAntraegeDiff,
  applyListViewDiff,
} from '../incremental-antraege';
import type { Antrag, Programm } from '../types';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

const PROG = 'p1';
function az(n: number, titel: string): Antrag {
  return { aktenzeichen: `AZ${n}`, programm_id: PROG, titel } as unknown as Antrag;
}
function line(a: Antrag): string {
  return JSON.stringify(a);
}

describe('diffAntraegeLines', () => {
  it('leere Hash-Map → alle Zeilen changed, nichts removed', () => {
    const lines = [az(1, 'a'), az(2, 'b')].map(line);
    const diff = diffAntraegeLines(lines, {});
    expect(diff.changed.map(c => c.aktenzeichen)).toEqual(['AZ1', 'AZ2']);
    expect(diff.removedKeys).toEqual([]);
    expect(diff.unchanged).toBe(0);
    expect(Object.keys(diff.newHashes).sort()).toEqual(['AZ1', 'AZ2']);
  });

  it('erkennt changed / new / removed / unchanged korrekt', () => {
    const oldLines = [az(1, 'a'), az(2, 'b'), az(3, 'c')].map(line);
    const stored = buildAntraegeHashes(oldLines);

    // AZ1 unverändert, AZ2 geändert, AZ3 entfernt, AZ4 neu
    const newLines = [az(1, 'a'), az(2, 'b-neu'), az(4, 'd')].map(line);
    const diff = diffAntraegeLines(newLines, stored);

    expect(diff.changed.map(c => c.aktenzeichen).sort()).toEqual(['AZ2', 'AZ4']);
    expect(diff.removedKeys).toEqual(['AZ3']);
    expect(diff.unchanged).toBe(1);
    expect(Object.keys(diff.newHashes).sort()).toEqual(['AZ1', 'AZ2', 'AZ4']);
  });
});

describe('applyAntraegeDiff + applyListViewDiff', () => {
  it('Store und List-View entsprechen nach dem Diff exakt dem neuen Snapshot', async () => {
    const idb = new IDBStore();
    await idb.open();
    await putProgramm(idb, { id: PROG, name: 'P1' } as unknown as Programm);

    const initial = [az(1, 'a'), az(2, 'b'), az(3, 'c')];
    await putAntraege(idb, initial);
    await putAntraegeListView(idb, initial.map(a => toAntragListItem(a)));
    const stored = buildAntraegeHashes(initial.map(line));

    // AZ2 geändert, AZ3 entfernt, AZ4 neu, AZ1 unverändert
    const next = [az(1, 'a'), az(2, 'b-neu'), az(4, 'd')];
    const diff = diffAntraegeLines(next.map(line), stored);
    await applyAntraegeDiff(idb, diff);
    await applyListViewDiff(idb, diff);

    const store = (await listAntraegeByProgramm(idb, PROG)).sort((x, y) => x.aktenzeichen.localeCompare(y.aktenzeichen));
    expect(store.map(a => a.aktenzeichen)).toEqual(['AZ1', 'AZ2', 'AZ4']);
    expect(store.find(a => a.aktenzeichen === 'AZ2')?.titel).toBe('b-neu');

    const lv = (await listAntraegeListViewByProgramm(idb, PROG)).sort((x, y) => x.aktenzeichen.localeCompare(y.aktenzeichen));
    expect(lv.map(a => a.aktenzeichen)).toEqual(['AZ1', 'AZ2', 'AZ4']);
  });

  it('kein Delta → keine Schreibungen, Store unverändert', async () => {
    const idb = new IDBStore();
    await idb.open();
    await putProgramm(idb, { id: PROG, name: 'P1' } as unknown as Programm);
    const initial = [az(1, 'a'), az(2, 'b')];
    await putAntraege(idb, initial);
    const stored = buildAntraegeHashes(initial.map(line));

    const diff = diffAntraegeLines(initial.map(line), stored);
    expect(diff.changed).toEqual([]);
    expect(diff.removedKeys).toEqual([]);
    await applyAntraegeDiff(idb, diff);

    const store = await listAntraegeByProgramm(idb, PROG);
    expect(store.map(a => a.aktenzeichen).sort()).toEqual(['AZ1', 'AZ2']);
  });
});
