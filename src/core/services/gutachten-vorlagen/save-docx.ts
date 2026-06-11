/**
 * Ablage der fertigen Gutachten-DOCX. Bevorzugt der persönliche Ordner
 * (`ZAH/gutachten/<filename>` via atomicWrite, skipBackup — eine Binär-Datei,
 * keine Rotation nötig); fehlt das Personal-Handle, greift der Browser-Download.
 */
import type { IDBStore } from '@/core/services/storage';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import { atomicWrite } from '@/core/services/infrastructure/atomic-write';

export interface SaveResult {
  ort: 'persoenlich' | 'download';
  pfad: string;
}

export async function saveGutachtenDocx(idb: IDBStore, blob: Blob, filename: string): Promise<SaveResult> {
  const persHandle = await getPersoenlichHandle(idb);
  if (persHandle) {
    const pfad = `ZAH/gutachten/${filename}`;
    await atomicWrite(persHandle, pfad, blob, { skipBackup: true });
    return { ort: 'persoenlich', pfad };
  }

  // Fallback: Browser-Download (kein Personal-Handle verbunden).
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { ort: 'download', pfad: filename };
}
