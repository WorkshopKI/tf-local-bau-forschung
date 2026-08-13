/**
 * `readTextLage` — die Unterscheidung, an der vier Datenverlust-Befunde hingen
 * (Cross-Cutting-Review v4.12).
 *
 * `readText` bildet JEDEN Fehler auf `null` ab. Vier Sidecar-Schreiber machten
 * daraus „also leer", rechneten auf der leeren Basis und schrieben das Ergebnis
 * als vollständige Datei zurück — womit fremder Bestand verschwand. Diese Suite
 * hält die Trennung fest: nur ein `NotFoundError` heißt „gibt es nicht", jeder
 * andere Fehler heißt „da ist etwas, es ließ sich nicht lesen".
 */
import { describe, it, expect } from 'vitest';
import { readText, readTextLage, atomicWrite } from '../atomic-write';
import { memRoot } from './mem-fs';

/**
 * Wurzel, deren ORDNER erreichbar ist, deren Datei-Zugriff aber mit einem
 * NICHT-NotFound-Fehler scheitert — genau die Lage „Datei ist da, laesst sich
 * gerade nicht lesen".
 */
function rootMitLesefehler(fehlerName: string): FileSystemDirectoryHandle {
  const kaputterOrdner = {
    kind: 'directory',
    getFileHandle: async () => { throw new DOMException('kaputt', fehlerName); },
  };
  return {
    kind: 'directory',
    getDirectoryHandle: async () => kaputterOrdner,
    getFileHandle: async () => { throw new DOMException('kaputt', fehlerName); },
  } as unknown as FileSystemDirectoryHandle;
}

describe('readTextLage — fehlend vs. unlesbar', () => {
  it('vorhandene Datei → ok + Inhalt', async () => {
    const root = memRoot();
    await atomicWrite(root, '_intern/x.json', '{"a":1}');
    expect(await readTextLage(root, '_intern/x.json')).toEqual({ status: 'ok', text: '{"a":1}' });
  });

  it('fehlende Datei → leer (legitimer Anfangszustand)', async () => {
    const root = memRoot();
    expect(await readTextLage(root, '_intern/gibtsnicht.json')).toEqual({ status: 'leer' });
  });

  it('fehlender ORDNER → ebenfalls leer', async () => {
    const root = memRoot();
    expect(await readTextLage(root, 'kein/ordner/x.json')).toEqual({ status: 'leer' });
  });

  it('Lesefehler an vorhandener Datei → unlesbar, NICHT leer', async () => {
    // Der Fall, der den Datenverlust ausloeste: SMB-Aussetzer, entzogenes Recht,
    // paralleler Schreiber im Rename-Fenster.
    for (const name of ['NotReadableError', 'NotAllowedError', 'InvalidStateError', 'AbortError']) {
      expect(await readTextLage(rootMitLesefehler(name), '_intern/x.json'), name)
        .toEqual({ status: 'unlesbar' });
    }
  });

  it('readText bleibt tolerant — beide Faelle liefern weiterhin null', async () => {
    // Rein LESENDE Aufrufer duerfen sich nicht aendern (kein Regress).
    const leer = memRoot();
    expect(await readText(leer, '_intern/gibtsnicht.json')).toBeNull();
    expect(await readText(rootMitLesefehler('NotReadableError'), '_intern/x.json')).toBeNull();
  });
});
