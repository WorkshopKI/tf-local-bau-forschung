/**
 * FS-API-Datei-Picker für CSV-Quellen (Konsolidierung 2026-07 aus CsvSourcesPage.tsx
 * extrahiert). WICHTIG (Bug-Klasse 2, recurring-bug-classes.md): `pickCsvFile` MUSS
 * synchron aus einer User-Geste (Klick-Handler) aufgerufen werden — der erste `await`
 * ist `showOpenFilePicker`. Kein zusätzlicher `await` davor, sonst verwirft der Browser
 * die Geste und der Datei-Dialog öffnet nicht. Die Auslagerung in dieses Modul ändert
 * die Geste NICHT (der Handler ruft die Funktion weiterhin direkt).
 */

export interface PickedFile {
  file: File;
  handle: FileSystemFileHandle | null;
}

export function isFsApiSupported(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

export interface PickedTextFile {
  file: File;
  text: string;
}

/**
 * Wählt eine `.jsonl`/`.json`-Datei und liest ihren Text. Wie {@link pickCsvFile}
 * MUSS synchron aus der Klick-Geste aufgerufen werden (erster `await` =
 * `showOpenFilePicker`) — kein zusätzliches `await` davor. Für die Schema-Recovery
 * (Wiederherstellen aus einer guten `csv_schemas.jsonl`).
 */
export async function pickSchemaSnapshotFile(): Promise<PickedTextFile | null> {
  if (!isFsApiSupported()) {
    return await new Promise<PickedTextFile | null>(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.jsonl,.json,application/json';
      input.onchange = () => {
        const f = input.files?.[0];
        if (!f) { resolve(null); return; }
        void f.text().then(text => resolve({ file: f, text }));
      };
      input.click();
    });
  }
  try {
    const handles = await (window as typeof window & {
      showOpenFilePicker(opts?: {
        types?: { description?: string; accept: Record<string, string[]> }[];
        multiple?: boolean;
        excludeAcceptAllOption?: boolean;
      }): Promise<FileSystemFileHandle[]>;
    }).showOpenFilePicker({
      types: [{ description: 'Schema-Snapshot (JSONL)', accept: { 'application/json': ['.jsonl', '.json'] } }],
      multiple: false,
    });
    const handle = handles[0];
    if (!handle) return null;
    const file = await handle.getFile();
    return { file, text: await file.text() };
  } catch (err) {
    if ((err as DOMException).name === 'AbortError') return null;
    throw err;
  }
}

/**
 * Wählt eine `.xlsx`/`.xls`-Datei für die Referenz-Importe des Vorgangssystems
 * (Status-Katalog, Trigger-Tabelle). Wie {@link pickCsvFile} MUSS die Funktion
 * synchron aus der Klick-Geste gerufen werden — kein `await` davor.
 *
 * Liefert nur die `File`, kein Handle: die Referenz-Zuarbeiten kommen alle paar
 * Monate von Hand, ein Auto-Update über ein gespeichertes Handle wäre für sie
 * weder nötig noch gewollt.
 */
export async function pickXlsxFile(): Promise<File | null> {
  if (!isFsApiSupported()) {
    return await new Promise<File | null>(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      input.onchange = () => resolve(input.files?.[0] ?? null);
      input.click();
    });
  }
  try {
    const handles = await (window as typeof window & {
      showOpenFilePicker(opts?: {
        types?: { description?: string; accept: Record<string, string[]> }[];
        multiple?: boolean;
        excludeAcceptAllOption?: boolean;
      }): Promise<FileSystemFileHandle[]>;
    }).showOpenFilePicker({
      types: [{
        description: 'Excel-Datei',
        accept: {
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
          'application/vnd.ms-excel': ['.xls'],
        },
      }],
      multiple: false,
    });
    const handle = handles[0];
    return handle ? await handle.getFile() : null;
  } catch (err) {
    if ((err as DOMException).name === 'AbortError') return null;
    throw err;
  }
}

export async function pickCsvFile(): Promise<PickedFile | null> {
  if (!isFsApiSupported()) {
    // Fallback: lege ein verstecktes Input-Element an. Liefert kein
    // persistierbares Handle (Auto-Update bleibt für diese Source aus).
    return await new Promise<PickedFile | null>(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv,text/csv';
      input.onchange = () => {
        const f = input.files?.[0];
        resolve(f ? { file: f, handle: null } : null);
      };
      input.click();
    });
  }
  try {
    const handles = await (window as typeof window & {
      showOpenFilePicker(opts?: {
        types?: { description?: string; accept: Record<string, string[]> }[];
        multiple?: boolean;
        excludeAcceptAllOption?: boolean;
      }): Promise<FileSystemFileHandle[]>;
    }).showOpenFilePicker({
      types: [{ description: 'CSV-Datei', accept: { 'text/csv': ['.csv'] } }],
      multiple: false,
    });
    const handle = handles[0];
    if (!handle) return null;
    const file = await handle.getFile();
    return { file, handle };
  } catch (err) {
    if ((err as DOMException).name === 'AbortError') return null;
    throw err;
  }
}
