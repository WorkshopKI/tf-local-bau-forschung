/**
 * SHA-256 als Hex — die eine Stelle.
 *
 * `crypto.subtle` ist unter `file://` verfügbar (secure context, Pitfall #6).
 *
 * Geschwister von `sha1.ts`, das den CSV-Checksum-Skip bedient. Getrennt
 * gelassen, weil beide Verfahren verschiedene Aufgaben haben und ein Wechsel
 * des einen den anderen nicht anfassen soll.
 */

/** Roh-Hex ohne Präfix — für Stempel und Kurz-Ids. */
export async function sha256Hex(data: Blob | ArrayBuffer | Uint8Array | string): Promise<string> {
  let buf: ArrayBuffer;
  if (typeof data === 'string') {
    const enc = new TextEncoder().encode(data);
    buf = enc.buffer.slice(enc.byteOffset, enc.byteOffset + enc.byteLength) as ArrayBuffer;
  } else if (data instanceof Blob) {
    buf = await data.arrayBuffer();
  } else if (data instanceof Uint8Array) {
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    buf = copy.buffer;
  } else {
    buf = data;
  }
  const digest = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  return hex;
}

/**
 * Mit `sha256-`-Präfix — das Format, in dem die Snapshot-Manifeste ihre Hashes
 * führen. Bestandsdateien tragen es, deshalb bleibt es.
 */
export async function sha256Praefixiert(
  data: Blob | ArrayBuffer | Uint8Array | string,
): Promise<string> {
  return 'sha256-' + await sha256Hex(data);
}

/**
 * SHA-256 über bereits UTF-8-kodierte Chunks (gestreamtes JSONL) — ohne den
 * vollständigen String im RAM neu aufzubauen. Liefert exakt denselben Hash wie
 * `sha256Praefixiert(chunks.map(decode).join(''))`. Leere Chunk-Liste → Hash des
 * leeren Inputs.
 */
export async function sha256PraefixiertAusChunks(chunks: readonly Uint8Array[]): Promise<string> {
  let total = 0;
  for (const c of chunks) total += c.length;
  const all = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { all.set(c, off); off += c.length; }
  return sha256Praefixiert(all);
}
