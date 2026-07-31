/**
 * Der Gate-Test der Variante „local": die ECHTEN `atomic-write.ts`-Pfade laufen
 * gegen den Fake-Handle, dessen Brücke auf ein echtes Temp-Verzeichnis zeigt.
 *
 * Bewusst end-to-end (echter HTTP-Server, echter Handler, echtes `fs`) statt
 * gegen einen zweiten Fake: der ganze Sinn der Variante ist, dass der
 * unveränderte Infrastructure-Layer darauf läuft. Besteht dieser Test, tragen
 * `backup.ts`, `audit-log.ts`, `snapshot*.ts`, `personal-storage/*` und
 * `presence/*` mit — sie sprechen dasselbe Subset.
 *
 * Zusätzlich abgedeckt: die vier Iterations-/Zugriffs-Protokolle, die im
 * App-Code tatsächlich vorkommen (values / keys / entries / getFile am
 * Listen-Eintrag). `keys()` ist der subtilste — `snapshot.ts` gated es mit
 * `typeof dir.keys === 'function'` und degradiert sonst STILL.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdtemp, rm, readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AddressInfo } from 'node:net';

import {
  atomicWrite,
  atomicWriteStream,
  appendToFile,
  readText,
  readBinary,
  fileExists,
  removeFile,
  listFilesWithBackupInfo,
} from '../../atomic-write';
import { setzeBasis } from '../transport';
import { wurzelHandle, LokalerVerzeichnisHandle } from '../verzeichnis-handle';
import { LokalerDateiHandle } from '../datei-handle';
import { bearbeite } from '../../../../../../scripts/local-fs/handler';
import { baueSlotTabelle } from '../../../../../../scripts/local-fs/pfad-guard';

const SLOT = 'daten-share';

let wurzelOrdner: string;
let server: Server;
let root: FileSystemDirectoryHandle;

/** Liest eine Datei direkt von der Platte — die unabhängige Gegenprobe. */
const aufPlatte = (rel: string): Promise<string> => readFile(join(wurzelOrdner, rel), 'utf-8');

beforeAll(async () => {
  wurzelOrdner = await mkdtemp(join(tmpdir(), 'tf-local-fs-'));
  const slots = baueSlotTabelle({ [SLOT]: wurzelOrdner });

  server = createServer((req, res) => {
    void bearbeite(req, res, slots, 'http://localhost').then(bearbeitet => {
      if (!bearbeitet) { res.writeHead(404); res.end(); }
    });
  });
  await new Promise<void>(fertig => server.listen(0, '127.0.0.1', fertig));
  setzeBasis(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);

  root = wurzelHandle(SLOT, 'ZAH') as unknown as FileSystemDirectoryHandle;
});

afterAll(async () => {
  await new Promise<void>(fertig => server.close(() => fertig()));
  await rm(wurzelOrdner, { recursive: true, force: true });
});

describe('atomicWrite', () => {
  it('schreibt, legt Zwischenordner an und landet wirklich auf der Platte', async () => {
    await atomicWrite(root, '_intern/skills/registry.json', '{"a":1}');
    expect(await aufPlatte('_intern/skills/registry.json')).toBe('{"a":1}');
  });

  it('rotiert eine .backup-Generation und hinterlässt kein .tmp', async () => {
    await atomicWrite(root, 'daten.json', 'erste');
    await atomicWrite(root, 'daten.json', 'zweite');
    expect(await aufPlatte('daten.json')).toBe('zweite');
    expect(await aufPlatte('daten.json.backup')).toBe('erste');
    expect(await readdir(wurzelOrdner)).not.toContain('daten.json.tmp');
  });

  it('schreibt mit skipBackup ohne .backup und räumt ein altes weg', async () => {
    await atomicWrite(root, 'log.jsonl', 'a');
    await atomicWrite(root, 'log.jsonl', 'b'); // erzeugt log.jsonl.backup
    await atomicWrite(root, 'log.jsonl', 'c', { skipBackup: true });
    expect(await aufPlatte('log.jsonl')).toBe('c');
    expect(await readdir(wurzelOrdner)).not.toContain('log.jsonl.backup');
  });

  it('schreibt Binärdaten unverfälscht', async () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 255]);
    await atomicWrite(root, 'bin.dat', bytes);
    const gelesen = await readBinary(root, 'bin.dat');
    expect(Array.from(gelesen!)).toEqual(Array.from(bytes));
  });

  it('schreibt Umlaute UTF-8-korrekt (Share-Kopie enthält „Hübsch")', async () => {
    await atomicWrite(root, 'umlaut.json', JSON.stringify({ name: 'Hübsch', ort: 'Grün' }));
    expect(JSON.parse(await aufPlatte('umlaut.json')).name).toBe('Hübsch');
    expect(JSON.parse((await readText(root, 'umlaut.json'))!).ort).toBe('Grün');
  });
});

describe('atomicWriteStream', () => {
  it('fügt Chunks in der richtigen Reihenfolge zusammen', async () => {
    await atomicWriteStream(root, 'snapshot.jsonl', async sink => {
      for (let i = 0; i < 200; i++) await sink.write(`{"i":${i}}\n`);
    });
    const zeilen = (await aufPlatte('snapshot.jsonl')).trim().split('\n');
    expect(zeilen).toHaveLength(200);
    expect(JSON.parse(zeilen[0]!).i).toBe(0);
    expect(JSON.parse(zeilen[199]!).i).toBe(199);
  });

  it('lässt das Ziel unberührt, wenn produce wirft, und räumt das .tmp weg', async () => {
    await atomicWrite(root, 'heikel.json', 'unversehrt', { skipBackup: true });
    await expect(atomicWriteStream(root, 'heikel.json', async sink => {
      await sink.write('kaputt');
      throw new Error('Abbruch mitten im Schreiben');
    }, { skipBackup: true })).rejects.toThrow('Abbruch');

    expect(await aufPlatte('heikel.json')).toBe('unversehrt');
    expect(await readdir(wurzelOrdner)).not.toContain('heikel.json.tmp');
  });
});

describe('appendToFile', () => {
  it('hängt zeilenweise an und legt die Datei bei Bedarf an', async () => {
    await appendToFile(root, '_intern/audit-log.jsonl', '{"e":1}');
    await appendToFile(root, '_intern/audit-log.jsonl', '{"e":2}');
    expect((await aufPlatte('_intern/audit-log.jsonl')).trim().split('\n')).toEqual(['{"e":1}', '{"e":2}']);
  });
});

describe('Lese-Helfer', () => {
  it('readText/readBinary liefern null statt zu werfen, wenn nichts da ist', async () => {
    expect(await readText(root, 'gibtsnicht.json')).toBeNull();
    expect(await readBinary(root, 'tief/gibtsnicht.bin')).toBeNull();
  });

  it('fileExists unterscheidet vorhanden und fehlend', async () => {
    await atomicWrite(root, 'da.json', '{}', { skipBackup: true });
    expect(await fileExists(root, 'da.json')).toBe(true);
    expect(await fileExists(root, 'weg.json')).toBe(false);
    expect(await fileExists(root, 'kein/ordner/weg.json')).toBe(false);
  });

  it('removeFile entfernt und ist auf Fehlendes tolerant', async () => {
    await atomicWrite(root, 'weg.json', '{}', { skipBackup: true });
    await removeFile(root, 'weg.json');
    expect(await fileExists(root, 'weg.json')).toBe(false);
    await expect(removeFile(root, 'weg.json')).resolves.toBeUndefined();
  });

  it('listFilesWithBackupInfo blendet .tmp aus und markiert .backup', async () => {
    const ordner = 'liste';
    await atomicWrite(root, `${ordner}/a.json`, '1');
    await atomicWrite(root, `${ordner}/a.json`, '2'); // erzeugt a.json.backup
    await atomicWrite(root, `${ordner}/b.json`, '1', { skipBackup: true });
    await writeFile(join(wurzelOrdner, ordner, 'c.json.tmp'), 'muell');

    const liste = await listFilesWithBackupInfo(root, ordner);
    expect(liste).toEqual([
      { name: 'a.json', hasBackup: true },
      { name: 'b.json', hasBackup: false },
    ]);
  });

  it('listFilesWithBackupInfo liefert [] für einen fehlenden Ordner', async () => {
    expect(await listFilesWithBackupInfo(root, 'gibt/es/nicht')).toEqual([]);
  });
});

describe('Fehler-Semantik (der App-Code steuert über den WURF)', () => {
  it('getFileHandle ohne create wirft NotFoundError', async () => {
    await expect(root.getFileHandle('fehlt.json')).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('getDirectoryHandle ohne create wirft NotFoundError', async () => {
    await expect(root.getDirectoryHandle('fehlt')).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('getFileHandle auf ein Verzeichnis wirft TypeMismatchError', async () => {
    await mkdir(join(wurzelOrdner, 'einordner'), { recursive: true });
    await expect(root.getFileHandle('einordner')).rejects.toMatchObject({ name: 'TypeMismatchError' });
  });

  it('getFileHandle mit create kürzt eine bestehende Datei NICHT', async () => {
    await atomicWrite(root, 'behalten.json', 'inhalt', { skipBackup: true });
    await root.getFileHandle('behalten.json', { create: true });
    expect(await aufPlatte('behalten.json')).toBe('inhalt');
  });

  it('removeEntry auf nicht-leerem Ordner wirft InvalidModificationError', async () => {
    await atomicWrite(root, 'voll/drin.json', '{}', { skipBackup: true });
    await expect(root.removeEntry('voll')).rejects.toMatchObject({ name: 'InvalidModificationError' });
    await expect(root.removeEntry('voll', { recursive: true })).resolves.toBeUndefined();
  });

  it('lehnt Pfade als Eintragsnamen ab (FSAPI erlaubt dort nur NAMEN)', async () => {
    await expect(root.getFileHandle('a/b.json')).rejects.toBeInstanceOf(TypeError);
    await expect(root.getDirectoryHandle('../raus')).rejects.toBeInstanceOf(TypeError);
  });
});

describe('Iterationsprotokolle — alle drei sind im App-Code in Gebrauch', () => {
  const anlegen = async (): Promise<LokalerVerzeichnisHandle> => {
    await atomicWrite(root, 'iter/eins.json', '1', { skipBackup: true });
    await atomicWrite(root, 'iter/zwei.json', '2', { skipBackup: true });
    await atomicWrite(root, 'iter/unter/drei.json', '3', { skipBackup: true });
    return root.getDirectoryHandle('iter') as unknown as Promise<LokalerVerzeichnisHandle>;
  };

  it('values() liefert VOLLE Handles — vorlagen-quelle.ts ruft entry.getFile()', async () => {
    const dir = await anlegen();
    const namen: string[] = [];
    for await (const eintrag of dir.values()) {
      namen.push(eintrag.name);
      if (eintrag.kind === 'file') {
        // Genau das tut vorlagen-quelle.ts am Listen-Eintrag.
        const datei = await (eintrag as LokalerDateiHandle).getFile();
        expect(datei.size).toBeGreaterThan(0);
        expect(typeof datei.lastModified).toBe('number');
      }
    }
    expect(namen.sort()).toEqual(['eins.json', 'unter', 'zwei.json']);
  });

  it('keys() existiert — snapshot.ts gated darauf und degradiert sonst still', async () => {
    const dir = await anlegen();
    expect(typeof dir.keys).toBe('function');
    const namen: string[] = [];
    for await (const name of dir.keys()) namen.push(name);
    expect(namen.sort()).toEqual(['eins.json', 'unter', 'zwei.json']);
  });

  it('entries() und der Default-Iterator liefern [name, handle]', async () => {
    const dir = await anlegen();
    const ausEntries: string[] = [];
    for await (const [name, handle] of dir.entries()) {
      expect(handle.name).toBe(name);
      ausEntries.push(name);
    }
    const ausDefault: string[] = [];
    for await (const [name] of dir) ausDefault.push(name);
    expect(ausEntries.sort()).toEqual(ausDefault.sort());
  });

  it('Verzeichnis-Einträge sind rekursions-fähig — migration.ts steigt hinab', async () => {
    const dir = await anlegen();
    let gefunden = false;
    for await (const eintrag of dir.values()) {
      if (eintrag.kind !== 'directory') continue;
      for await (const kind of (eintrag as LokalerVerzeichnisHandle).values()) {
        if (kind.name === 'drei.json') gefunden = true;
      }
    }
    expect(gefunden).toBe(true);
  });
});

describe('createWritable-Semantik', () => {
  it('keepExistingData + position hängt an, ohne zu kürzen (run-log.ts-Muster)', async () => {
    await atomicWrite(root, 'run.jsonl', '{"e":1}\n', { skipBackup: true });

    // Wortgleich zu run-log.ts appendEvent().
    const fh = await root.getFileHandle('run.jsonl');
    const datei = await fh.getFile();
    const w = await fh.createWritable({ keepExistingData: true }) as unknown as {
      write(c: unknown): Promise<void>; close(): Promise<void>;
    };
    await w.write({ type: 'write', position: datei.size, data: '{"e":2}\n' });
    await w.close();

    expect(await aufPlatte('run.jsonl')).toBe('{"e":1}\n{"e":2}\n');
  });

  it('ohne keepExistingData wird die Datei ersetzt, nicht überlagert', async () => {
    await atomicWrite(root, 'ersetz.txt', 'sehr langer alter Inhalt', { skipBackup: true });
    const fh = await root.getFileHandle('ersetz.txt');
    const w = await fh.createWritable();
    await w.write('kurz');
    await w.close();
    expect(await aufPlatte('ersetz.txt')).toBe('kurz');
  });

  it('abort() schreibt gar nichts', async () => {
    await atomicWrite(root, 'abbruch.txt', 'original', { skipBackup: true });
    const fh = await root.getFileHandle('abbruch.txt');
    const w = await fh.createWritable();
    await w.write('sollte verschwinden');
    await (w as unknown as { abort(): Promise<void> }).abort();
    expect(await aufPlatte('abbruch.txt')).toBe('original');
  });
});

describe('Blob-Pfad — atomic-write.ts fallbackRename schreibt einen Blob', () => {
  it('schreibt einen Blob als Nutzdaten (nicht als Kommando-Objekt)', async () => {
    // `fallbackRename` liest die Quelle als Blob und schreibt sie ins Ziel.
    // Weil `Blob` selbst eine `.type`-Property hat, wurde er von einer frühen
    // Fassung für ein `{type:…}`-Kommando gehalten — der Inhalt verschwand.
    const fh = await root.getFileHandle('blob.bin', { create: true });
    const w = await fh.createWritable();
    await w.write(new Blob(['inhalt aus einem Blob']));
    await w.close();
    expect(await aufPlatte('blob.bin')).toBe('inhalt aus einem Blob');
  });
});

describe('move() — atomic-write.ts bevorzugt es per Feature-Detection', () => {
  it('ist vorhanden und benennt wirklich um', async () => {
    await atomicWrite(root, 'mv/quelle.json', '{"x":1}', { skipBackup: true });
    const dir = await root.getDirectoryHandle('mv');
    const fh = await dir.getFileHandle('quelle.json');
    expect(typeof (fh as unknown as { move?: unknown }).move).toBe('function');

    await (fh as unknown as { move(d: unknown, n: string): Promise<void> }).move(dir, 'ziel.json');
    expect(await aufPlatte('mv/ziel.json')).toBe('{"x":1}');
    expect(await fileExists(root, 'mv/quelle.json')).toBe(false);
  });
});

describe('Permission-Fassade', () => {
  it('meldet immer granted — genau das löst den Startup-Stepper auf', async () => {
    const dir = root as unknown as {
      queryPermission(o: unknown): Promise<string>;
      requestPermission(o: unknown): Promise<string>;
    };
    expect(await dir.queryPermission({ mode: 'readwrite' })).toBe('granted');
    expect(await dir.requestPermission({ mode: 'readwrite' })).toBe('granted');
    expect(await dir.queryPermission({ mode: 'read' })).toBe('granted');
  });
});
