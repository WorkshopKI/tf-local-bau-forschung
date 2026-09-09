/** Das LAYOUT des Daten-Shares (programm/, _intern/, README, Heartbeat) — kennt keine IDB, nur ein DirectoryHandle. */
import { PROGRAMM_SUBDIRS, PROGRAMM_DIR_NAME, LEGACY_PROGRAMM_DIR_NAME, BACKUPS_DIR, INTERN_DIR, INTERN_FEEDBACK_DIR, HEARTBEAT_PROBE_PATH, README_PATH } from '../types';
import { queryPermission } from './daten-share';

/**
 * Liefert das Programm-Handle (auf `programm/` unter dem Daten-Share).
 * Legt es an falls nicht vorhanden. Fällt auf `programm-test/` zurück wenn
 * die Migration noch nicht gelaufen ist.
 */
export async function getProgrammHandle(parent: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  const existingNew = await parent.getDirectoryHandle(PROGRAMM_DIR_NAME).catch(() => null);
  if (existingNew) return existingNew;
  const legacy = await parent.getDirectoryHandle(LEGACY_PROGRAMM_DIR_NAME).catch(() => null);
  if (legacy) return legacy;
  return parent.getDirectoryHandle(PROGRAMM_DIR_NAME, { create: true });
}

/** Liefert das `_intern/`-Handle am Parent-Root (create-on-demand). */
export async function getInternHandle(parent: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  return parent.getDirectoryHandle(INTERN_DIR, { create: true });
}

/** Legt die v1.9-Folder-Struktur unter dem Daten-Share an (idempotent). */
export async function ensureFolderStructure(parent: FileSystemDirectoryHandle): Promise<void> {
  const programm = await parent.getDirectoryHandle(PROGRAMM_DIR_NAME, { create: true });
  for (const sub of PROGRAMM_SUBDIRS) {
    await programm.getDirectoryHandle(sub, { create: true });
  }
  await parent.getDirectoryHandle(BACKUPS_DIR, { create: true });
  const intern = await parent.getDirectoryHandle(INTERN_DIR, { create: true });
  await intern.getDirectoryHandle('feedback', { create: true });
  await ensureReadme(parent);
}

const README_CONTENT = `TeamFlow — Datenspeicher

Dieser Ordner ist der Datenspeicher der TeamFlow-App.

Bitte nichts in diesem Ordner manuell bearbeiten, verschieben oder
löschen. Die App verwaltet den Inhalt selbstständig.

Nutzer starten die App über die Desktop-Verknüpfung, nicht über
diesen Ordner.

Für Fragen: [Kontakt-Info vom Kurator hier eintragen]
`;

export async function ensureReadme(parent: FileSystemDirectoryHandle): Promise<void> {
  const existing = await parent.getFileHandle(README_PATH).catch(() => null);
  if (existing) return;
  const fh = await parent.getFileHandle(README_PATH, { create: true });
  const w = await fh.createWritable();
  await w.write(README_CONTENT);
  await w.close();
}

/**
 * Lightweight-Check: prüft Permission + Existenz von `_intern/` (neue Struktur)
 * ODER `programm-test/admin/` (Legacy vor Migration).
 */
export async function isSmbAvailable(parent: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const perm = await queryPermission(parent);
    if (perm !== 'granted') return false;
    const intern = await parent.getDirectoryHandle(INTERN_DIR).catch(() => null);
    if (intern) return true;
    const legacyProgramm = await parent.getDirectoryHandle(LEGACY_PROGRAMM_DIR_NAME).catch(() => null);
    if (!legacyProgramm) return false;
    await legacyProgramm.getDirectoryHandle('admin').catch(() => null);
    return true;
  } catch {
    return false;
  }
}

/** Optionaler Helper: schreibt eine leere Probe-Datei im _intern/-Ordner. */
export async function writeHeartbeatProbe(parent: FileSystemDirectoryHandle): Promise<void> {
  const intern = await parent.getDirectoryHandle(INTERN_DIR, { create: true });
  const fh = await intern.getFileHandle('heartbeat-probe', { create: true });
  const w = await fh.createWritable();
  await w.write(new Uint8Array(0));
  await w.close();
}

export { HEARTBEAT_PROBE_PATH, INTERN_FEEDBACK_DIR };

/* --------------------------------------------------------------------------
 * v2.0: Persoenlicher Ordner (Home-Laufwerk des Users)
 * -------------------------------------------------------------------------- */
