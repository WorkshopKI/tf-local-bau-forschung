/**
 * Fake `FileSystemFileHandle` über die local-fs-Brücke.
 *
 * Implementiert genau das Subset, das der App-Code benutzt — ermittelt aus
 * `atomic-write.ts`, `run-log.ts` und `csv-source-handle.ts`, nicht geraten.
 */

import { LocalFsTransport } from './transport';
import { markiereAlsLokal } from './typen';
import { WritablePuffer, type SchreibChunk } from './writable-puffer';

/** Was `createWritable()` liefern muss (Teilmenge von FileSystemWritableFileStream). */
export interface LokalerWritable {
  write(chunk: SchreibChunk): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

export class LokalerDateiHandle {
  readonly kind = 'file' as const;

  constructor(
    private readonly transport: LocalFsTransport,
    /** Relativer Pfad unterhalb der Slot-Wurzel. */
    readonly pfad: string,
    readonly name: string,
  ) {
    markiereAlsLokal(this);
  }

  async getFile(): Promise<File> {
    return this.transport.lies(this.pfad);
  }

  /**
   * `keepExistingData: true` heisst: Datei NICHT auf 0 kürzen. Einziger Nutzer
   * ist `run-log.ts` (echtes Append via `{type:'write', position: file.size}`).
   * Der Puffer sammelt alles; erst `close()` schickt einen Auftrag los —
   * `abort()` schickt gar nichts.
   */
  async createWritable(opts: { keepExistingData?: boolean } = {}): Promise<LokalerWritable> {
    const puffer = new WritablePuffer(opts.keepExistingData === true);
    const transport = this.transport;
    const pfad = this.pfad;

    return {
      write: (chunk) => puffer.schreibe(chunk),
      seek: (position) => puffer.schreibe({ type: 'seek', position }),
      truncate: (size) => puffer.schreibe({ type: 'truncate', size }),
      abort: async () => { puffer.abbrechen(); },
      close: async () => {
        const auftrag = puffer.abschliessen();
        if (!auftrag) return; // abgebrochen
        await transport.schreibe(pfad, auftrag.bytes, {
          keep: !auftrag.ersetzen,
          position: auftrag.position,
        });
        if (auftrag.truncateAuf !== undefined) {
          await transport.kuerze(pfad, auftrag.truncateAuf);
        }
      },
    };
  }

  /**
   * Natives `move()`. `atomic-write.ts:88` feature-detected `typeof src.move`
   * und benutzt es bevorzugt — hier ist es ein serverseitiges `fs.rename` und
   * damit ECHT atomar, im Gegensatz zum FSAPI-Fallback (read+write+delete).
   */
  async move(ziel: { pfad?: string } | string, neuerName?: string): Promise<void> {
    const zielOrdner = typeof ziel === 'string' ? '' : (ziel.pfad ?? '');
    const zielName = typeof ziel === 'string' ? ziel : (neuerName ?? this.name);
    const nach = zielOrdner ? `${zielOrdner}/${zielName}` : zielName;
    await this.transport.verschiebe(this.pfad, nach);
  }

  async isSameEntry(anderer: unknown): Promise<boolean> {
    return anderer instanceof LokalerDateiHandle
      && anderer.transport.slot === this.transport.slot
      && anderer.pfad === this.pfad;
  }

  /** Die Brücke ist immer freigegeben — es gibt keinen Browser-Dialog. */
  async queryPermission(): Promise<PermissionState> { return 'granted'; }
  async requestPermission(): Promise<PermissionState> { return 'granted'; }
}
