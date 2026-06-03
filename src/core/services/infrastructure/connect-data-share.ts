/**
 * connectDataShare (v2.18.1).
 *
 * Geteilte Daten-Share-Verbindungs-Sequenz fuer StartupScreen (Initial-Pick),
 * HomeCallToAction (In-App-CTA) und OfflineBanner (Recovery bei fehlendem
 * Handle). Kapselt in EINER User-Gesture-Kette:
 *   Picker (Mode aus canWriteDatenShare — Pitfall #25) → erwarteter Ordner-
 *   Name-Check (dataConfig.expectedFolderName) → Struktur-Validierung
 *   (Unterordner -> Fehler) → ensureReadme bei bestehender Struktur →
 *   refreshAllPermissions.
 *
 * Eigenes Leaf-Modul (nicht in smb-handle.ts), weil `validateSelectedFolder`
 * aus migration.ts kommt und migration.ts seinerseits smb-handle.ts importiert
 * — der Helfer hier konsumiert beide, ohne einen Zyklus zu erzeugen.
 *
 * MUSS aus einem User-Gesture-Handler aufgerufen werden: der Picker ist der
 * erste async-Hop. KEIN await (z.B. IDB-Read) davor — unter file:// verbrennt
 * Chrome sonst die User-Activation und der Picker oeffnet sich silent gar nicht.
 */

import type { IDBStore } from '@/core/services/storage/idb-store';
import { dataConfig, canWriteDatenShare } from '@/config/feature-flags';
import {
  pickAndStoreDatenShareHandle,
  refreshAllPermissions,
  ensureReadme,
  type RefreshAllResult,
} from './smb-handle';
import { validateSelectedFolder } from './migration';

export type ConnectDataShareResult =
  | { ok: true; refresh: RefreshAllResult; handle: FileSystemDirectoryHandle }
  | {
      ok: false;
      reason: 'aborted' | 'name-mismatch' | 'subfolder' | 'unsupported' | 'error';
      message?: string;
    };

export async function connectDataShare(
  idb: IDBStore,
  opts: { isKurator: boolean },
): Promise<ConnectDataShareResult> {
  const mode: 'read' | 'readwrite' = canWriteDatenShare(opts.isKurator) ? 'readwrite' : 'read';
  const res = await pickAndStoreDatenShareHandle(idb, { mode });
  if (!res.ok) {
    if (res.reason === 'aborted') return { ok: false, reason: 'aborted' };
    return {
      ok: false,
      reason: res.reason === 'unsupported' ? 'unsupported' : 'error',
      message: res.message,
    };
  }

  // Name-Check (v2.0): erwarteter Ordner-Name aus dem Build (z.B. "ZAH").
  const expectedName = dataConfig.expectedFolderName;
  if (expectedName && res.handle.name !== expectedName) {
    return {
      ok: false,
      reason: 'name-mismatch',
      message: `Bitte den Ordner "${expectedName}" auswählen (gewählt: "${res.handle.name}").`,
    };
  }

  // Struktur-Validierung: ist es eine existierende TeamFlow-Struktur, leer oder
  // ein versehentlich gewaehlter Unterordner?
  const validation = await validateSelectedFolder(res.handle);
  if (validation.kind === 'subfolder') {
    return {
      ok: false,
      reason: 'subfolder',
      message: 'Sie haben einen Unterordner gewählt. Bitte den übergeordneten Datenordner wählen.',
    };
  }
  if (validation.kind === 'current') {
    await ensureReadme(res.handle);
  }
  // Bei 'empty' / 'legacy' uebernehmen Kuratoren das Setup spaeter — hier nur den
  // Handle persistieren (oben geschehen) und Permissions in einem User-Gesture
  // aushandeln.

  const refresh = await refreshAllPermissions(idb, { isKurator: opts.isKurator });
  return { ok: true, refresh, handle: res.handle };
}
