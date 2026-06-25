/**
 * Laufzeit-Persistenz des geglätteten Nutzer-Changelogs auf dem Daten-Share
 * (`_intern/changelog-user.md`).
 *
 * Zweck: Der mit „Mit KI glätten" erzeugte nutzerfreundliche Changelog wird NICHT
 * mehr in die committed Quelldatei geschrieben (Rebuild nötig), sondern auf den
 * Share — so sehen ihn ALLE Build-Varianten (prod/pl/as/kurator) zur Laufzeit ohne
 * Rebuild. Geschrieben wird nur aus dem Entwickler-Build (Panel ist `isDevContext()`-
 * gegated); gelesen von allen.
 *
 * Schreib-Profil (Pitfall #23): Idempotent-overwrite (Single-Source-of-Truth) via
 * `atomicWrite` mit Backup-Rotation. Lesen ist best-effort (offline/kein Share → null,
 * Modal fällt auf die eingebettete/abgeleitete Fassung zurück).
 */

import type { IDBStore } from '@/core/services/storage/idb-store';
import { getDatenShareHandle } from '@/core/services/infrastructure/smb-handle';
import { atomicWrite, readText } from '@/core/services/infrastructure/atomic-write';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import { hasUserChangelogContent } from './deriveChangelog';

export const USER_CHANGELOG_SHARE_PATH = '_intern/changelog-user.md';

/**
 * Liest den geglätteten Nutzer-Changelog vom Daten-Share. Gibt null zurück, wenn
 * kein Share verbunden, die Datei fehlt/leer ist oder keinen `## vX.Y`-Abschnitt
 * enthält (→ Aufrufer nutzt den eingebetteten/abgeleiteten Fallback).
 */
export async function readUserChangelogFromShare(idb: IDBStore): Promise<string | null> {
  const handle = await getDatenShareHandle(idb);
  if (!handle) return null;
  try {
    const text = await readText(handle, USER_CHANGELOG_SHARE_PATH);
    if (!text) return null;
    const trimmed = text.trim();
    return hasUserChangelogContent(trimmed) ? trimmed : null;
  } catch {
    return null;
  }
}

/**
 * Schreibt den geglätteten Nutzer-Changelog auf den Daten-Share. Wirft mit klarer
 * Meldung, wenn kein Share verbunden ist oder der Write fehlschlägt (z.B. kein
 * Schreibrecht) — die UI (`useAsyncAction`) zeigt den Fehler an.
 */
export async function writeUserChangelogToShare(idb: IDBStore, md: string, user?: string): Promise<void> {
  const handle = await getDatenShareHandle(idb);
  if (!handle) throw new Error('Kein Daten-Share verbunden — Glätten kann nicht gespeichert werden.');
  const content = md.endsWith('\n') ? md : `${md}\n`;
  await atomicWrite(handle, USER_CHANGELOG_SHARE_PATH, content);
  await logAudit(idb, { action: 'changelog_user_updated', user });
}
