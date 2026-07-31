/**
 * HTTP-Transport der local-fs-Brücke (Client-Seite).
 *
 * Einzige Stelle, die `fetch` gegen die Brücke aufruft — und einzige Stelle, die
 * Server-Fehler in DOMExceptions übersetzt. Das ist load-bearing: der gesamte
 * Infrastructure-Layer steuert über den WURF, nicht über Rückgabewerte
 * (`atomic-write.ts` `exists()` ist ein `try { getFileHandle } catch { false }`).
 * Ein verschlucktes Werfen äussert sich als stilles Fehlverhalten, nicht als
 * Fehlermeldung.
 */

import {
  baueUrl,
  domNameFuerAntwort,
  HEADER_FEHLER,
  HEADER_NAME,
  HEADER_LAST_MODIFIED,
  type AnfrageParameter,
  type LocalFsOperation,
  type ListenEintrag,
  type StatAntwort,
} from './protokoll';

/**
 * Basis-URL der Brücke. Im Browser leer (same-origin, relative Pfade). Der
 * Konformitäts-Test setzt sie auf einen echten HTTP-Server über einem
 * Temp-Verzeichnis — nur so laufen die echten `atomic-write`-Pfade gegen den
 * echten Handler statt gegen einen zweiten, mitgepflegten Fake.
 */
let basis = '';

export function setzeBasis(url: string): void {
  basis = url.replace(/\/$/, '');
}

/** Baut die DOMException, die der App-Code an dieser Stelle erwartet. */
async function fehlerAus(antwort: Response, op: LocalFsOperation, pfad: string): Promise<DOMException> {
  const name = domNameFuerAntwort(antwort.status, antwort.headers.get(HEADER_FEHLER));
  let detail = '';
  try {
    detail = (await antwort.text()).slice(0, 300);
  } catch {
    /* Body evtl. schon konsumiert oder Stream kaputt — Name reicht. */
  }
  return new DOMException(`local-fs ${op} "${pfad}": ${detail || antwort.statusText}`, name);
}

/**
 * Netzwerkfehler (Server weg, Vite neu gestartet) als `NotReadableError`.
 *
 * Bewusst NICHT `NotFoundError`: sonst läse `atomic-write.ts` einen abgestürzten
 * Dev-Server als „die Datei gibt es halt nicht" und die App zeigte kommentarlos
 * leere Daten an.
 */
function transportFehler(op: LocalFsOperation, pfad: string, ursache: unknown): DOMException {
  return new DOMException(`local-fs ${op} "${pfad}": Brücke nicht erreichbar (${String(ursache)})`, 'NotReadableError');
}

async function hole(
  op: LocalFsOperation,
  params: AnfrageParameter,
  init?: RequestInit,
): Promise<Response> {
  const pfad = params.path ?? params.from ?? '';
  let antwort: Response;
  try {
    antwort = await fetch(basis + baueUrl(op, params), init);
  } catch (err) {
    throw transportFehler(op, pfad, err);
  }
  if (!antwort.ok) throw await fehlerAus(antwort, op, pfad);
  return antwort;
}

/** Ein Slot-gebundener Zugriff auf die Brücke — der Adapter hält einen davon. */
export class LocalFsTransport {
  constructor(public readonly slot: string) {}

  async stat(pfad: string): Promise<StatAntwort> {
    const antwort = await hole('stat', { root: this.slot, path: pfad });
    return antwort.json() as Promise<StatAntwort>;
  }

  /** Existiert der Pfad? Schluckt NUR `NotFoundError`, nie echte Fehler. */
  async existiert(pfad: string): Promise<StatAntwort | null> {
    try {
      return await this.stat(pfad);
    } catch (err) {
      if ((err as DOMException).name === 'NotFoundError') return null;
      throw err;
    }
  }

  async liste(pfad: string): Promise<ListenEintrag[]> {
    const antwort = await hole('list', { root: this.slot, path: pfad });
    const daten = await antwort.json() as { entries: ListenEintrag[] };
    return daten.entries;
  }

  /**
   * Datei-Inhalt als `File`.
   *
   * Bewusst eager: der App-Code reicht das Ergebnis an Papa Parse, `JSZip` und
   * `new Blob([...])` weiter — ein Lazy-Duck-Type bräche dort. Der Preis ist ein
   * voller Transfer auch dann, wenn nur `size`/`lastModified` gebraucht werden
   * (`csv-source-handle.ts` `decideSourceUpdateState`). Bei den grossen CSVs der
   * Share-Kopie (60–160 MB) ist das messbar; falls es stört, ist die
   * `/stat`-Fassung über `existiert()` bereits da.
   */
  async lies(pfad: string): Promise<File> {
    const antwort = await hole('read', { root: this.slot, path: pfad });
    const puffer = await antwort.arrayBuffer();
    const name = decodeURIComponent(antwort.headers.get(HEADER_NAME) ?? pfad.split('/').pop() ?? '');
    const lastModified = Number(antwort.headers.get(HEADER_LAST_MODIFIED) ?? 0);
    return new File([puffer], name, { lastModified });
  }

  async schreibe(pfad: string, bytes: Uint8Array, opts: { keep?: boolean; position?: number } = {}): Promise<void> {
    // Uint8Array → eigener ArrayBuffer-Ausschnitt, sonst schickt fetch bei einem
    // View auf einen grösseren Buffer versehentlich den ganzen Buffer mit.
    const koerper = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
      ? bytes.buffer
      : bytes.slice().buffer;
    await hole('write', { root: this.slot, path: pfad, keep: opts.keep, position: opts.position }, {
      method: 'POST',
      body: koerper as ArrayBuffer,
    });
  }

  async kuerze(pfad: string, groesse: number): Promise<void> {
    await hole('truncate', { root: this.slot, path: pfad, size: groesse }, { method: 'POST' });
  }

  async legeOrdnerAn(pfad: string): Promise<void> {
    await hole('mkdir', { root: this.slot, path: pfad }, { method: 'POST' });
  }

  async entferne(pfad: string, rekursiv: boolean): Promise<void> {
    await hole('remove', { root: this.slot, path: pfad, recursive: rekursiv }, { method: 'POST' });
  }

  async verschiebe(von: string, nach: string): Promise<void> {
    await hole('move', { root: this.slot, from: von, to: nach }, { method: 'POST' });
  }
}

/** Slot-Liste der Brücke — beim Start einmal abgefragt. */
export async function ladeSlots(): Promise<{ slots: Record<string, { name: string }>; fehlend: string[] }> {
  const antwort = await hole('roots', {});
  return antwort.json() as Promise<{ slots: Record<string, { name: string }>; fehlend: string[] }>;
}
