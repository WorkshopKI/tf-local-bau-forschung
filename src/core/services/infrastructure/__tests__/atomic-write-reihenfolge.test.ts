/**
 * Die Reihenfolge in `atomicWrite`/`atomicWriteStream` ist die ganze Sicherheit,
 * die der Name verspricht — und sie war falsch: das Ziel wurde zur `.backup`
 * umbenannt, BEVOR der neue Inhalt geschrieben war. Zwischen diesen beiden
 * Schritten existierte die Zieldatei nicht; bei `atomicWriteStream` umfasste
 * dieses Fenster den ganzen `produce`-Lauf (Snapshot: 13k+ Anträge über SMB).
 * Scheiterte der Write, blieb nur `<datei>.backup` zurück.
 *
 * Belegt am 24.08.2026 auf der FIKTIV-Share-Kopie: `_intern/skills/registry.json`
 * fehlte vollständig, daneben lag ein valides `registry.json.backup`.
 *
 * **Warum die bestehende Suite das nicht fing**: der einzige Fehlerfall-Test
 * (`atomic-write-konformitaet.test.ts`, „lässt das Ziel unberührt, wenn produce
 * wirft") lief mit `skipBackup: true` — und genau dieser Zweig benennt das Ziel
 * nie weg. Der Test prüfte den einen Pfad, der nicht kaputt war.
 *
 * Hier steht deshalb der ORDNUNGS-Nachweis (was passiert wann) neben dem
 * ERGEBNIS-Nachweis (was liegt danach auf der Platte).
 */
import { describe, it, expect } from 'vitest';
import { atomicWrite, atomicWriteStream } from '../atomic-write';

interface FehlerPlan {
  /** Der Schreibvorgang auf DIESE Datei scheitert. */
  datei: string;
  /** Nur beim ersten Versuch — ein Aussetzer, kein Dauerproblem. */
  nurEinmal?: boolean;
}

/**
 * Minimaler Verzeichnis-Handle, der zwei Dinge kann, die `mem-fs.ts` nicht kann:
 * die Operationen **protokollieren** und einen Write **scheitern** lassen.
 *
 * `mitMove: false` schaltet das native `move()` ab und erzwingt damit den
 * `fallbackRename`-Polyfill — nötig für den Rollback-Nachweis, denn `rename()`
 * FÄNGT einen Fehler des nativen `move()` ab und degradiert still zum Polyfill.
 * Ein harter Fehlschlag der letzten Umbenennung kommt nur über den Polyfill oben an.
 */
class FakeOrdner {
  readonly kind = 'directory';
  readonly dateien = new Map<string, string>();
  readonly log: string[] = [];
  private gescheitert = 0;

  constructor(
    readonly name = 'root',
    private readonly plan: FehlerPlan | null = null,
    private readonly mitMove = true,
  ) {}

  /** Als FSAPI-Handle getarnt — `atomic-write.ts` spricht nur dieses Subset. */
  get alsHandle(): FileSystemDirectoryHandle {
    return this as unknown as FileSystemDirectoryHandle;
  }

  private sollScheitern(datei: string): boolean {
    if (this.plan?.datei !== datei) return false;
    if (this.plan.nurEinmal && this.gescheitert > 0) return false;
    this.gescheitert++;
    return true;
  }

  async getDirectoryHandle(): Promise<FakeOrdner> {
    return this;
  }

  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<unknown> {
    if (!this.dateien.has(name)) {
      if (!opts?.create) throw new DOMException(`file ${name} not found`, 'NotFoundError');
      this.dateien.set(name, ''); // FSAPI legt mit create:true wirklich an
    }
    const move = async (_ziel: unknown, nach: string): Promise<void> => {
      this.log.push(`benenne:${name}→${nach}`);
      this.dateien.set(nach, this.dateien.get(name) ?? '');
      this.dateien.delete(name);
    };
    return {
      kind: 'file',
      name,
      getFile: async () => new Blob([this.dateien.get(name) ?? '']),
      createWritable: async () => {
        this.log.push(`schreibe:${name}`);
        const teile: string[] = [];
        return {
          write: async (c: unknown) => {
            teile.push(c instanceof Blob ? await c.text() : String(c));
          },
          close: async () => {
            if (this.sollScheitern(name)) throw new Error(`Schreiben von ${name} gescheitert`);
            this.dateien.set(name, teile.join(''));
          },
          abort: async () => { teile.length = 0; },
        };
      },
      ...(this.mitMove ? { move } : {}),
    };
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.dateien.has(name)) throw new DOMException(`no ${name}`, 'NotFoundError');
    this.log.push(`entferne:${name}`);
    this.dateien.delete(name);
  }
}

const ZIEL = 'daten.json';
const TMP = `${ZIEL}.tmp`;
const BACKUP = `${ZIEL}.backup`;

/**
 * Ordner mit einem bereits vorhandenen Ziel — nur dann rotiert überhaupt etwas.
 * Der Bestand wird direkt gesetzt, nicht über `atomicWrite`: die Vorbereitung
 * darf nicht von dem Code abhängen, der hier geprüft wird.
 */
function mitBestand(plan: FehlerPlan | null = null, mitMove = true): FakeOrdner {
  const ordner = new FakeOrdner('root', plan, mitMove);
  ordner.dateien.set(ZIEL, 'alter Inhalt');
  return ordner;
}

describe('atomicWrite — der Inhalt ist geschrieben, bevor das Ziel wegbenannt wird', () => {
  it('schreibt das .tmp VOR der Backup-Rotation', async () => {
    const ordner = mitBestand();
    await atomicWrite(ordner.alsHandle, ZIEL, 'neuer Inhalt');

    expect(ordner.log).toEqual([
      `schreibe:${TMP}`,
      `benenne:${ZIEL}→${BACKUP}`,
      `benenne:${TMP}→${ZIEL}`,
    ]);
  });

  it('lässt das Ziel mit ALTEM Inhalt stehen, wenn der Inhalt-Write scheitert', async () => {
    const ordner = mitBestand({ datei: TMP });

    await expect(atomicWrite(ordner.alsHandle, ZIEL, 'neuer Inhalt'))
      .rejects.toThrow('Schreiben von');

    expect(ordner.dateien.get(ZIEL)).toBe('alter Inhalt');
    // Rotiert wurde nie — es gibt also auch keine .backup, die man suchen müsste.
    expect(ordner.dateien.has(BACKUP)).toBe(false);
  });

  it('dreht die Rotation zurück, wenn die letzte Umbenennung scheitert', async () => {
    // Ohne natives move(): nur über den Polyfill kommt ein Fehlschlag der
    // letzten Umbenennung überhaupt bis nach oben. `nurEinmal` = ein Aussetzer,
    // damit das Zurückdrehen (schreibt dieselbe Datei) gelingen kann.
    const ordner = mitBestand({ datei: ZIEL, nurEinmal: true }, false);

    await expect(atomicWrite(ordner.alsHandle, ZIEL, 'neuer Inhalt'))
      .rejects.toThrow('Schreiben von');

    expect(ordner.dateien.get(ZIEL)).toBe('alter Inhalt');
  });

  it('schreibt im Erfolgsfall neu und rotiert den alten Stand nach .backup', async () => {
    for (const mitMove of [true, false]) {
      const ordner = mitBestand(null, mitMove);
      await atomicWrite(ordner.alsHandle, ZIEL, 'neuer Inhalt');

      expect(ordner.dateien.get(ZIEL)).toBe('neuer Inhalt');
      expect(ordner.dateien.get(BACKUP)).toBe('alter Inhalt');
      expect(ordner.dateien.has(TMP)).toBe(false);
    }
  });

  it('lässt das Ziel auch mit skipBackup stehen, wenn der Write scheitert', async () => {
    // Dieser Zweig war schon vorher heil — er benennt das Ziel nie weg. Genau
    // deshalb konnte der bestehende Fehlerfall-Test nichts finden.
    const ordner = mitBestand({ datei: TMP });

    await expect(atomicWrite(ordner.alsHandle, ZIEL, 'neu', { skipBackup: true }))
      .rejects.toThrow('Schreiben von');

    expect(ordner.dateien.get(ZIEL)).toBe('alter Inhalt');
  });
});

describe('atomicWriteStream — das Fenster umfasste den ganzen produce-Lauf', () => {
  it('lässt das Ziel mit ALTEM Inhalt stehen, wenn produce wirft (mit .backup-Profil)', async () => {
    const ordner = mitBestand();

    await expect(atomicWriteStream(ordner.alsHandle, ZIEL, async sink => {
      await sink.write('halb geschrieben');
      throw new Error('Abbruch mitten im Schreiben');
    })).rejects.toThrow('Abbruch');

    expect(ordner.dateien.get(ZIEL)).toBe('alter Inhalt');
    expect(ordner.dateien.has(BACKUP)).toBe(false);
    expect(ordner.dateien.has(TMP)).toBe(false);
  });

  it('schreibt Chunks im Erfolgsfall zusammen und rotiert', async () => {
    const ordner = mitBestand();
    await atomicWriteStream(ordner.alsHandle, ZIEL, async sink => {
      await sink.write('eins ');
      await sink.write('zwei');
    });

    expect(ordner.dateien.get(ZIEL)).toBe('eins zwei');
    expect(ordner.dateien.get(BACKUP)).toBe('alter Inhalt');
  });
});
