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
