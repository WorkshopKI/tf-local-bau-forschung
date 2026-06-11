/**
 * Flacher ZIP-Durchlauf für die Aufnahme. Unterordner werden einbezogen;
 * `__MACOSX`/`.DS_Store`/`Thumbs.db` still übersprungen; ZIP-in-ZIP übersprungen
 * + gemeldet; `.doc` (altes Word) abgelehnt mit Meldung — nur `.pdf`/`.docx`
 * werden aufgenommen. KEINE Parallelität, Blobs werden nicht gehalten.
 */

/** Eine flach extrahierte, akzeptierte Datei aus dem ZIP (oder loser Drop). */
export interface ZipDatei {
  name: string;
  file: File;
}

export interface ZipDurchlaufErgebnis {
  dateien: ZipDatei[];
  uebersprungen: string[]; // Müll / ZIP-in-ZIP (still)
  abgelehnt: { name: string; grund: string }[]; // .doc o.ä.
}

const MUELL = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$)/i;
const basename = (p: string): string => p.split('/').pop() ?? p;

function pruefeEndung(name: string): { ok: true } | { ok: false; grund: string } {
  const lower = name.toLowerCase();
  if (lower.endsWith('.doc')) return { ok: false, grund: 'Altes .doc-Format — bitte als .docx oder .pdf' };
  if (!lower.endsWith('.pdf') && !lower.endsWith('.docx')) return { ok: false, grund: 'Nur .pdf und .docx werden aufgenommen' };
  return { ok: true };
}

/** Liest EIN ZIP flach durch. */
export async function zipDurchlauf(input: Blob): Promise<ZipDurchlaufErgebnis> {
  const { default: JSZip } = await import('jszip');
  // Blob → ArrayBuffer selbst lesen: jszip liest Blobs nur per FileReader
  // (browser-only); ArrayBuffer/Uint8Array funktionieren überall (auch Node-Tests).
  const zip = await JSZip.loadAsync(await input.arrayBuffer());
  const res: ZipDurchlaufErgebnis = { dateien: [], uebersprungen: [], abgelehnt: [] };
  const entries: { path: string; entry: import('jszip').JSZipObject }[] = [];
  zip.forEach((path, entry) => { if (!entry.dir) entries.push({ path, entry }); });

  for (const { path, entry } of entries) {
    if (MUELL.test(path)) { res.uebersprungen.push(path); continue; }
    const name = basename(path);
    if (name.toLowerCase().endsWith('.zip')) {
      res.uebersprungen.push(`${path} (ZIP-in-ZIP übersprungen)`);
      continue;
    }
    const check = pruefeEndung(name);
    if (!check.ok) { res.abgelehnt.push({ name, grund: check.grund }); continue; }
    const bytes = await entry.async('uint8array');
    // Frische Kopie → Uint8Array<ArrayBuffer> (BlobPart-kompatibel; jszip liefert
    // den weiteren ArrayBufferLike-Typ, der SharedArrayBuffer einschließt).
    res.dateien.push({ name, file: new File([new Uint8Array(bytes)], name) });
  }
  return res;
}

/** Eine lose abgelegte Datei (kein ZIP) in dieselbe Struktur bringen. */
export function loseDatei(file: File): ZipDurchlaufErgebnis {
  const check = pruefeEndung(file.name);
  if (!check.ok) return { dateien: [], uebersprungen: [], abgelehnt: [{ name: file.name, grund: check.grund }] };
  return { dateien: [{ name: file.name, file }], uebersprungen: [], abgelehnt: [] };
}
