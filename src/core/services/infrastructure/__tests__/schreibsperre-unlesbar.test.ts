/**
 * Schreibsperre bei unlesbarer Quelle + kein Löschen ungesicherter Dateien
 * (Cross-Cutting-Review v4.12).
 *
 * Zwei Bug-Klassen, ein Prinzip: **nichts wegwerfen, was man nicht gelesen hat.**
 *  - `zugang-config`: read-modify-write, das eine unlesbare Datei als leer nahm
 *    und damit die Zugänge aller anderen MAs löschte.
 *  - `migration`: `moveAllInto` sammelt Dateifehler nur ein; das anschließende
 *    rekursive Löschen nahm die nicht kopierten Dateien mit.
 */
import { describe, it, expect, vi } from 'vitest';

const shareHandle = { wert: null as FileSystemDirectoryHandle | null };
vi.mock('../smb-handle', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../smb-handle')>()),
  getDatenShareHandle: () => Promise.resolve(shareHandle.wert),
  queryPermission: () => Promise.resolve('granted'),
}));
vi.mock('../audit-log', () => ({ logAudit: () => Promise.resolve() }));

import { addOrReplaceEintrag, addOrReplaceManyEintraege, removeEintrag } from '../zugang-config';
import { migrateLegacyStructure } from '../migration';
import { readText } from '../atomic-write';
import { MemDir, memRoot } from './mem-fs';

const idb = {} as never;

/** Wurzel mit vorhandenem `_intern/`, dessen Datei-Lesen scheitert (SMB-Aussetzer). */
function shareMitUnlesbarerDatei(): { root: FileSystemDirectoryHandle; schreibversuche: string[] } {
  const schreibversuche: string[] = [];
  const ordner = {
    kind: 'directory',
    getFileHandle: async (name: string, opts?: { create?: boolean }) => {
      if (opts?.create) { schreibversuche.push(name); return neueDatei(); }
      throw new DOMException('SMB weg', 'NotReadableError');
    },
    removeEntry: async () => undefined,
  };
  const neueDatei = (): unknown => ({
    createWritable: async () => ({ write: async () => undefined, close: async () => undefined }),
  });
  return {
    root: {
      kind: 'directory',
      getDirectoryHandle: async () => ordner,
    } as unknown as FileSystemDirectoryHandle,
    schreibversuche,
  };
}

describe('zugang-config — unlesbare Datei sperrt jeden Write (v4.12)', () => {
  const faelle: Array<[string, (idbArg: never) => Promise<unknown>]> = [
    ['addOrReplaceEintrag', i => addOrReplaceEintrag(i, 'MA05', 'MUE', 'pw-test')],
    ['addOrReplaceManyEintraege', i => addOrReplaceManyEintraege(i, [{ anonId: 'MA05', kuerzel: 'MUE', passwort: 'pw' }])],
    ['removeEintrag', i => removeEintrag(i, 'MA05')],
  ];

  for (const [name, aufruf] of faelle) {
    it(`${name} wirft statt die fremden Zugaenge zu ueberschreiben`, async () => {
      const { root, schreibversuche } = shareMitUnlesbarerDatei();
      shareHandle.wert = root;

      await expect(aufruf(idb)).rejects.toThrow(/nicht lesbar/);
      // Entscheidend: es wurde NICHT geschrieben. Sonst stuende danach eine
      // Datei mit genau einem Eintrag da, und alle anderen koennten sich nicht
      // mehr anmelden — die gute Fassung waere von derselben Rotation weg.
      expect(schreibversuche.filter(n => !n.endsWith('.tmp'))).toHaveLength(0);
      expect(schreibversuche).toHaveLength(0);
    });
  }

  it('FEHLENDE Datei bleibt ein legitimer Anfangszustand (kein Regress)', async () => {
    // Der erste Zugang ueberhaupt muss weiterhin anlegbar sein.
    const root = memRoot();
    shareHandle.wert = root;
    const datei = await addOrReplaceEintrag(idb, 'MA01', 'MUE', 'pw-test');
    expect(datei.eintraege).toHaveLength(1);
    expect(await readText(root, '_intern/auslastung-zugang.enc')).toContain('MA01');
  });
});

describe('migration — Quellordner bleibt, wenn nicht alles umzog (v4.12)', () => {
  /** Legacy-Share mit einer Datei, deren Kopie scheitert. */
  function legacyShare(): FileSystemDirectoryHandle {
    const root = new MemDir();
    const legacy = new MemDir('programm-test');
    const quelle = new MemDir('csv-sources');
    // Eine gute und eine kaputte Datei — `moveAllInto` laeuft ueber beide.
    quelle.files.set('gut.csv', { name: 'gut.csv' } as never);
    quelle.files.set('kaputt.csv', { name: 'kaputt.csv' } as never);
    const echtesGetFile = quelle.getFileHandle.bind(quelle);
    quelle.getFileHandle = async (n: string, o?: { create?: boolean }) => {
      if (n === 'kaputt.csv') throw new DOMException('gesperrt', 'NotReadableError');
      return echtesGetFile(n, o);
    };
    legacy.dirs.set('csv-sources', quelle);
    root.dirs.set('programm-test', legacy);
    return root as unknown as FileSystemDirectoryHandle;
  }

  it('scheitert eine Datei, wird csv-sources NICHT rekursiv geloescht', async () => {
    const root = legacyShare();
    const res = await migrateLegacyStructure(idb, root);

    // Der Ordner steht noch da — die nicht kopierte Datei ist nicht an BEIDEN
    // Orten weg, sondern noch an ihrem.
    const legacy = await root.getDirectoryHandle('programm-test');
    await expect(legacy.getDirectoryHandle('csv-sources')).resolves.toBeDefined();
    expect(res.foldersRemoved).not.toContain('programm-test/csv-sources');
    expect(res.errors.join('\n')).toMatch(/nicht verschiebbar/);
  });

  it('programm-test/ selbst bleibt ebenfalls stehen, solange Fehler offen sind', async () => {
    const root = legacyShare();
    const res = await migrateLegacyStructure(idb, root);
    await expect(root.getDirectoryHandle('programm-test')).resolves.toBeDefined();
    expect(res.foldersRemoved).not.toContain('programm-test/');
  });
});
