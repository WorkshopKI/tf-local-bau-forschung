/**
 * Fake `FileSystemDirectoryHandle` über die local-fs-Brücke.
 *
 * Drei Iterationsprotokolle sind Pflicht, nicht Kür — alle drei sind im
 * App-Code in Gebrauch:
 *   - `values()`   → `atomic-write.ts`, `backup.ts`, `migration.ts`,
 *                    `feedbackOutboxCollect.ts`, `vorlagen-quelle.ts`, …
 *   - `keys()`     → `snapshot.ts` (Backup-Dedup + `removeStaleDeltaFiles`),
 *                    beide `typeof dir.keys === 'function'`-gegated. Fehlt es,
 *                    degradiert es STILL zu verwaisten `antraege.delta.*`-Dateien.
 *   - `entries()` / `[Symbol.asyncIterator]` → `csv-source-handle.ts`,
 *                    `phase2/scanner/scan-roots.ts`
 *
 * Und die Einträge müssen VOLLE Handles sein: `vorlagen-quelle.ts` ruft
 * `entry.getFile()` direkt auf dem Listen-Eintrag, `migration.ts` castet auf
 * `FileSystemDirectoryHandle` und rekursiert.
 */

import { LocalFsTransport } from './transport';
import { LokalerDateiHandle } from './datei-handle';
import { markiereAlsLokal } from './typen';
import { istGueltigesSegment, kindPfad, normalisiereName } from './pfad-segmente';

/** FSAPI: `getFileHandle`/`getDirectoryHandle` nehmen NAMEN, keine Pfade. */
function pruefeName(name: string): void {
  if (!istGueltigesSegment(name)) {
    throw new TypeError(`local-fs: "${name}" ist kein gültiger Eintragsname`);
  }
}

export class LokalerVerzeichnisHandle {
  readonly kind = 'directory' as const;

  constructor(
    private readonly transport: LocalFsTransport,
    /** Relativer Pfad unterhalb der Slot-Wurzel. Leer = Wurzel. */
    readonly pfad: string,
    readonly name: string,
  ) {
    markiereAlsLokal(this);
  }

  /**
   * `create: true` legt den Ordner an (rekursiv, idempotent — ein Round-Trip).
   * Ohne `create` muss ein fehlender Ordner WERFEN: `atomic-write.ts`
   * `navigateToDir(..., false)` baut sein Verhalten darauf auf.
   */
  async getDirectoryHandle(name: string, opts: { create?: boolean } = {}): Promise<LokalerVerzeichnisHandle> {
    pruefeName(name);
    const kind = normalisiereName(name);
    const pfad = kindPfad(this.pfad, kind);

    if (opts.create) {
      await this.transport.legeOrdnerAn(pfad);
      return new LokalerVerzeichnisHandle(this.transport, pfad, kind);
    }

    const info = await this.transport.stat(pfad); // wirft NotFoundError, wenn weg
    if (info.kind !== 'directory') {
      throw new DOMException(`local-fs: "${pfad}" ist eine Datei`, 'TypeMismatchError');
    }
    return new LokalerVerzeichnisHandle(this.transport, pfad, kind);
  }

  /**
   * `create: true` darf eine BESTEHENDE Datei nicht kürzen (FSAPI-Semantik) —
   * deshalb erst `stat`, und nur bei `NotFoundError` eine leere Datei anlegen.
   * Ohne `create` wirft ein fehlender Eintrag `NotFoundError`; genau daraus
   * baut `atomic-write.ts` seinen `exists()`-Test.
   */
  async getFileHandle(name: string, opts: { create?: boolean } = {}): Promise<LokalerDateiHandle> {
    pruefeName(name);
    const kind = normalisiereName(name);
    const pfad = kindPfad(this.pfad, kind);

    const info = await this.transport.existiert(pfad);
    if (info) {
      if (info.kind !== 'file') {
        throw new DOMException(`local-fs: "${pfad}" ist ein Verzeichnis`, 'TypeMismatchError');
      }
      return new LokalerDateiHandle(this.transport, pfad, kind);
    }
    if (!opts.create) {
      throw new DOMException(`local-fs: "${pfad}" nicht gefunden`, 'NotFoundError');
    }
    await this.transport.schreibe(pfad, new Uint8Array(0));
    return new LokalerDateiHandle(this.transport, pfad, kind);
  }

  async removeEntry(name: string, opts: { recursive?: boolean } = {}): Promise<void> {
    pruefeName(name);
    await this.transport.entferne(kindPfad(this.pfad, normalisiereName(name)), opts.recursive === true);
  }

  /** Baut aus einem Listen-Eintrag den passenden vollen Handle. */
  private zuHandle(name: string, art: 'file' | 'directory'): LokalerDateiHandle | LokalerVerzeichnisHandle {
    const pfad = kindPfad(this.pfad, name);
    return art === 'directory'
      ? new LokalerVerzeichnisHandle(this.transport, pfad, name)
      : new LokalerDateiHandle(this.transport, pfad, name);
  }

  async *entries(): AsyncIterableIterator<[string, LokalerDateiHandle | LokalerVerzeichnisHandle]> {
    for (const eintrag of await this.transport.liste(this.pfad)) {
      yield [eintrag.name, this.zuHandle(eintrag.name, eintrag.kind)];
    }
  }

  async *values(): AsyncIterableIterator<LokalerDateiHandle | LokalerVerzeichnisHandle> {
    for (const eintrag of await this.transport.liste(this.pfad)) {
      yield this.zuHandle(eintrag.name, eintrag.kind);
    }
  }

  async *keys(): AsyncIterableIterator<string> {
    for (const eintrag of await this.transport.liste(this.pfad)) {
      yield eintrag.name;
    }
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<[string, LokalerDateiHandle | LokalerVerzeichnisHandle]> {
    return this.entries();
  }

  async isSameEntry(anderer: unknown): Promise<boolean> {
    return anderer instanceof LokalerVerzeichnisHandle
      && anderer.transport.slot === this.transport.slot
      && anderer.pfad === this.pfad;
  }

  /**
   * Relativer Pfad von hier zu `nachkomme`, als Segmente — oder `null`, wenn
   * der Handle kein Nachkomme ist (FSAPI-Semantik).
   */
  async resolve(nachkomme: unknown): Promise<string[] | null> {
    const anderer = nachkomme as { pfad?: string; transport?: LocalFsTransport } | null;
    if (typeof anderer?.pfad !== 'string') return null;
    if (anderer.transport?.slot !== this.transport.slot) return null;
    if (this.pfad && !anderer.pfad.startsWith(`${this.pfad}/`)) return null;
    const rest = this.pfad ? anderer.pfad.slice(this.pfad.length + 1) : anderer.pfad;
    return rest ? rest.split('/') : [];
  }

  /**
   * Die Brücke ist immer freigegeben — es gibt keinen Browser-Dialog.
   *
   * Das ist der Hebel, der den ganzen Startup-Stepper auflöst:
   * `listPendingGrants` findet nichts Offenes, `needsDatenShareDowngrade`
   * liefert `false`, und der StartupScreen fährt sich selbst weiter.
   */
  async queryPermission(): Promise<PermissionState> { return 'granted'; }
  async requestPermission(): Promise<PermissionState> { return 'granted'; }
}

/** Wurzel-Handle eines Slots. */
export function wurzelHandle(slot: string, anzeigeName: string): LokalerVerzeichnisHandle {
  return new LokalerVerzeichnisHandle(new LocalFsTransport(slot), '', anzeigeName);
}
