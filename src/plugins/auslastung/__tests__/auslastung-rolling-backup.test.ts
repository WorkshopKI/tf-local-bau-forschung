/**
 * Rolling-Backup fuer auslastung.json (v2.24.5).
 *
 * Ergaenzt die 1-Generation-`.backup`-Rotation von atomicWrite um datierte
 * Snapshots in `_intern/auslastung-backups/`. `pruneAuslastungBackups` haelt die
 * Historie auf KEEP Generationen begrenzt und loescht die AELTESTEN (ISO-Namen
 * → lexikalischer Sort = chronologisch). Schutz gegen unbeschraenktes Wachstum
 * auf dem Share + Recovery-Tiefe nach einem Clobber (Juni-2026-Vorfall).
 */
import { describe, it, expect } from 'vitest';
import { pruneAuslastungBackups } from '../services/auslastung-store';

/** Fake-Verzeichnis-Handle: values()-Iterator + removeEntry-Tracking. */
function fakeDir(names: string[]): FileSystemDirectoryHandle & { present: Set<string> } {
  const present = new Set(names);
  return {
    kind: 'directory',
    name: 'auslastung-backups',
    async *values() {
      for (const n of present) yield { kind: 'file', name: n } as FileSystemHandle;
    },
    removeEntry: async (n: string) => { present.delete(n); },
    present,
  } as unknown as FileSystemDirectoryHandle & { present: Set<string> };
}

function backupNames(n: number): string[] {
  // Aufsteigende, fixed-width ISO-Timestamps (Doppelpunkt/Punkt → '-').
  return Array.from({ length: n }, (_, i) => {
    const min = String(i).padStart(2, '0');
    return `auslastung-2026-06-04T10-${min}-00-000Z.json`;
  });
}

describe('pruneAuslastungBackups', () => {
  it('behaelt die KEEP neuesten und loescht die aeltesten', async () => {
    const dir = fakeDir(backupNames(25));
    const deleted = await pruneAuslastungBackups(dir, 20);

    expect(deleted).toHaveLength(5);
    // Die 5 aeltesten (Minuten 00..04) wurden geloescht.
    expect(deleted).toEqual(backupNames(25).slice(0, 5));
    expect(dir.present.size).toBe(20);
    expect(dir.present.has('auslastung-2026-06-04T10-00-00-000Z.json')).toBe(false);
    expect(dir.present.has('auslastung-2026-06-04T10-24-00-000Z.json')).toBe(true);
  });

  it('loescht nichts, wenn <= KEEP vorhanden sind', async () => {
    const dir = fakeDir(backupNames(20));
    const deleted = await pruneAuslastungBackups(dir, 20);
    expect(deleted).toEqual([]);
    expect(dir.present.size).toBe(20);
  });

  it('ignoriert Fremd-Dateien (nur auslastung-*.json zaehlen)', async () => {
    const dir = fakeDir([...backupNames(22), 'readme.txt', 'auslastung.json.tmp']);
    const deleted = await pruneAuslastungBackups(dir, 20);
    expect(deleted).toEqual(backupNames(22).slice(0, 2));
    expect(dir.present.has('readme.txt')).toBe(true);
    expect(dir.present.has('auslastung.json.tmp')).toBe(true);
  });
});
