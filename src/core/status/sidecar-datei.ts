/**
 * Die **eine** Lese-/Schreib-Mechanik für die Sidecar-Dateien des Status-Systems
 * auf dem Daten-Share.
 *
 * Herausgelöst aus `katalog-share.ts`, als die Trigger-Tabelle eine eigene Datei
 * bekam. Zwei Dateien, aber genau eine Mechanik: dasselbe Schreib-Profil
 * (idempotent-overwrite via `atomicWrite`, Pitfall #10/#23), dieselbe
 * Selbst-Gatung über `queryPermission` (ohne Schreibrecht ein No-op statt eines
 * `NotAllowedError`, Pitfall #25), dieselbe Fehler-Toleranz beim Lesen (fehlend,
 * offline oder kaputt ⇒ `null`, nie ein Wurf).
 *
 * **Warum die Trigger-Tabelle nicht in der Katalog-Datei bleibt** (gemessen am
 * 01.08.2026): eine Katalog-Fassung wiegt ~209 KB, mit 900 Trigger-Zeilen ~594 KB.
 * Da die Datei ALLE Fassungen führt, wären das bei zehn Fassungen 6,8 MB statt
 * 2,4 MB — und die werden bei jedem Speichern komplett über SMB neu geschrieben.
 * Die Trigger sind zudem reine Fremddaten ohne Kuration: sie je Fassung
 * mitzuschleppen speicherte zehnmal dasselbe.
 *
 * Rein bis auf den Share-Zugriff; kein Wissen über Katalog oder Trigger.
 */
import type { IDBStore } from '@/core/services/storage';
import { atomicWrite, readText } from '@/core/services/infrastructure/atomic-write';
import { getDatenShareHandle, queryPermission } from '@/core/services/infrastructure/smb-handle';

/**
 * Liest eine JSON-Sidecar vom Share. `null` bei fehlendem Handle, fehlender
 * Datei, kaputtem JSON oder verfehlter Strukturprüfung — der Aufrufer arbeitet
 * dann mit seinem lokalen Stand weiter, statt zu scheitern.
 */
export async function leseSidecar<T>(
  idb: IDBStore, pfad: string, istGueltig: (raw: unknown) => raw is T,
): Promise<T | null> {
  const handle = await getDatenShareHandle(idb);
  if (!handle) return null;
  const text = await readText(handle, pfad);
  if (text == null) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return istGueltig(parsed) ? parsed : null;
  } catch (err) {
    console.warn(`[status] leseSidecar(${pfad}) parse failed:`, err);
    return null;
  }
}

/**
 * Schreibt eine JSON-Sidecar auf den Share. Self-gated: ohne
 * readwrite-Berechtigung ein No-op (`false`) — der Aufrufer sagt dem Nutzer dann,
 * dass die Fassung nur lokal gilt.
 */
export async function schreibeSidecar(
  idb: IDBStore, pfad: string, daten: unknown,
): Promise<boolean> {
  const handle = await getDatenShareHandle(idb);
  if (!handle) return false;
  if ((await queryPermission(handle)) !== 'granted') return false;
  try {
    await atomicWrite(handle, pfad, JSON.stringify(daten, null, 2));
    return true;
  } catch (err) {
    console.error(`[status] schreibeSidecar(${pfad}) failed:`, err);
    return false;
  }
}
