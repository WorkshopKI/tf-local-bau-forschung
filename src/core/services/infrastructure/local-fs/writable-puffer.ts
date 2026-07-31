/**
 * Puffer-Logik für `createWritable()` — PURE, ohne `fetch`.
 *
 * Die FSAPI-Writable-Semantik ist reicher als „Bytes anhängen": Chunks können
 * Strings, Buffer, Blobs oder Kommando-Objekte (`{type:'write'|'seek'|'truncate'}`)
 * sein, und mit `keepExistingData` schreibt man an eine Byte-Position in eine
 * bestehende Datei. Diese Datei bildet das vollständig ab und liefert am Ende
 * genau EINEN Schreibauftrag — der Transport ist dumm.
 *
 * Warum gepuffert und nicht gestreamt: `atomicWrite` schreibt ohnehin erst in
 * eine `.tmp` und benennt danach um. Ein abgebrochener Puffer (`abort()`)
 * hinterlässt so gar nichts, statt eine halb geschriebene Datei.
 */

/**
 * Kommando-Objekte der FSAPI.
 *
 * Bewusst ein EIGENER Typ und nicht via `Extract<SchreibChunk, {type: string}>`
 * hergeleitet: `Blob` hat selbst eine `.type`-Property, `Extract` zöge ihn also
 * mit hinein — und die Narrowing-Zusage wäre gelogen.
 */
export type SchreibKommando =
  | { type: 'write'; position?: number; data: string | BufferSource | Blob }
  | { type: 'seek'; position: number }
  | { type: 'truncate'; size: number };

/** Was der Aufrufer in `write()` stecken darf (FSAPI `FileSystemWriteChunkType`). */
export type SchreibChunk = string | BufferSource | Blob | SchreibKommando;

/** Ergebnis eines abgeschlossenen Puffers — das, was der Transport senden muss. */
export interface SchreibAuftrag {
  /** Die zusammengesetzten Bytes. */
  bytes: Uint8Array;
  /**
   * Byte-Offset in der Zieldatei. Nur relevant, wenn `ersetzen === false`;
   * sonst beginnt die Datei ohnehin bei 0.
   */
  position: number;
  /**
   * `true` = Datei komplett ersetzen (Normalfall, entspricht `createWritable()`
   * ohne `keepExistingData` — die FSAPI kürzt die Datei dabei auf 0).
   * `false` = bestehenden Inhalt behalten und an `position` schreiben.
   */
  ersetzen: boolean;
  /** Gesetzt, wenn ein `{type:'truncate'}`-Kommando kam. */
  truncateAuf?: number;
}

async function zuBytes(daten: string | BufferSource | Blob): Promise<Uint8Array> {
  if (typeof daten === 'string') return new TextEncoder().encode(daten);
  if (daten instanceof Uint8Array) return daten;
  if (daten instanceof ArrayBuffer) return new Uint8Array(daten);
  if (typeof Blob !== 'undefined' && daten instanceof Blob) {
    return new Uint8Array(await daten.arrayBuffer());
  }
  if (ArrayBuffer.isView(daten)) {
    const v = daten as ArrayBufferView;
    return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  }
  throw new TypeError(`local-fs: nicht unterstützter Chunk-Typ ${typeof daten}`);
}

/** Die einzigen drei Kommando-Typen der FSAPI. */
const KOMMANDOS = new Set(['write', 'seek', 'truncate']);

/**
 * Kommando-Objekt oder Nutzdaten?
 *
 * ACHTUNG, subtile Falle: `Blob` hat selbst eine `.type`-Property (den
 * MIME-Typ). Ein naives `'type' in chunk` hält deshalb JEDEN Blob für ein
 * Kommando und greift dann auf das nicht existierende `.data` zu. Genau das
 * passiert im echten Code — `atomic-write.ts` `fallbackRename` und `writeData`
 * reichen Blobs durch. Deshalb: Blobs explizit ausschliessen UND den
 * `type`-Wert gegen die drei bekannten Kommandos prüfen.
 */
function istKommando(chunk: SchreibChunk): chunk is SchreibKommando {
  if (typeof chunk !== 'object' || chunk === null) return false;
  if (typeof Blob !== 'undefined' && chunk instanceof Blob) return false;
  if (ArrayBuffer.isView(chunk) || chunk instanceof ArrayBuffer) return false;
  const typ = (chunk as { type?: unknown }).type;
  return typeof typ === 'string' && KOMMANDOS.has(typ);
}

/**
 * Sammelt Chunks und setzt sie beim Abschluss zu einem Schreibauftrag zusammen.
 *
 * Der Cursor verhält sich wie in der FSAPI: jeder Write rückt ihn um die
 * geschriebene Länge vor, `seek` setzt ihn absolut, und ein `write` mit
 * expliziter `position` schreibt dort (und setzt den Cursor dahinter).
 */
export class WritablePuffer {
  /** Schreibvorgänge als (Position, Bytes) — erst beim Abschluss zusammengefügt. */
  private readonly stuecke: Array<{ position: number; bytes: Uint8Array }> = [];
  private cursor = 0;
  private truncateAuf: number | undefined;
  private abgebrochen = false;

  constructor(private readonly behalteBestand: boolean, startPosition = 0) {
    this.cursor = startPosition;
  }

  async schreibe(chunk: SchreibChunk): Promise<void> {
    if (this.abgebrochen) throw new TypeError('local-fs: Writable wurde bereits abgebrochen');

    if (istKommando(chunk)) {
      if (chunk.type === 'seek') {
        this.cursor = chunk.position;
        return;
      }
      if (chunk.type === 'truncate') {
        this.truncateAuf = chunk.size;
        // FSAPI: liegt der Cursor hinter der neuen Länge, rückt er nach vorn.
        if (this.cursor > chunk.size) this.cursor = chunk.size;
        return;
      }
      const bytes = await zuBytes(chunk.data);
      const position = chunk.position ?? this.cursor;
      this.stuecke.push({ position, bytes });
      this.cursor = position + bytes.length;
      return;
    }

    const bytes = await zuBytes(chunk);
    this.stuecke.push({ position: this.cursor, bytes });
    this.cursor += bytes.length;
  }

  abbrechen(): void {
    this.abgebrochen = true;
    this.stuecke.length = 0;
  }

  /**
   * Setzt die Stücke zum Auftrag zusammen.
   *
   * Der Normalfall ist EIN Stück ab Position 0 (so schreibt `atomic-write.ts`);
   * mehrere Stücke entstehen bei `atomicWriteStream` (Snapshot-JSONL in Chunks).
   * Lücken zwischen Stücken werden mit Nullbytes gefüllt — dieselbe Semantik wie
   * ein Sparse-Write in der FSAPI.
   */
  abschliessen(): SchreibAuftrag | null {
    if (this.abgebrochen) return null;

    if (this.stuecke.length === 0) {
      // Kein Write, aber evtl. ein truncate — oder ein leerer `close()`, der die
      // Datei anlegen/leeren soll.
      return {
        bytes: new Uint8Array(0),
        position: 0,
        ersetzen: !this.behalteBestand,
        truncateAuf: this.truncateAuf,
      };
    }

    const start = Math.min(...this.stuecke.map(s => s.position));
    const ende = Math.max(...this.stuecke.map(s => s.position + s.bytes.length));
    const puffer = new Uint8Array(ende - start);
    for (const stueck of this.stuecke) {
      puffer.set(stueck.bytes, stueck.position - start);
    }

    return {
      bytes: puffer,
      position: start,
      ersetzen: !this.behalteBestand,
      truncateAuf: this.truncateAuf,
    };
  }
}
