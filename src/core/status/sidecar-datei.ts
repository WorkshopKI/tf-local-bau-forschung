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
import {
  atomicWrite, atomicWriteStream, appendToFile, readText, readTextPrefix,
  listFilesWithBackupInfo, type AtomicWriteSink,
} from '@/core/services/infrastructure/atomic-write';
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

// --- Zwei Primitive für große und für wachsende Sidecars ---------------------
// Das Import-Diff-Journal braucht beides: einen mehrere MB großen Stand, der
// nicht als ein String im Speicher entstehen soll, und eine Monatsdatei, an die
// angehängt wird. Sie stehen HIER, damit es beim „genau ein Weg auf den Share"
// bleibt — die Entscheidung, WANN und WAS geschrieben wird, bleibt beim Aufrufer.

/** Rohtext einer Sidecar (JSONL). `null` wie bei {@link leseSidecar}. */
export async function leseSidecarText(idb: IDBStore, pfad: string): Promise<string | null> {
  const handle = await getDatenShareHandle(idb);
  if (!handle) return null;
  try {
    return await readText(handle, pfad);
  } catch (err) {
    console.warn(`[status] leseSidecarText(${pfad}) failed:`, err);
    return null;
  }
}

/**
 * Nur den ANFANG einer Sidecar — für die eine Angabe, die im Kopf der Datei
 * steht. Der Status-Katalog wiegt Megabyte; wer aus ihm bloß die aktive
 * Fassungsnummer braucht (Frühwarnung beim Fensterfokus, späte Nachprüfung vor
 * dem Schreiben), holt nicht die ganze Datei über SMB. `null` wie bei
 * {@link leseSidecarText}.
 */
export async function leseSidecarKopf(
  idb: IDBStore, pfad: string, bytes: number,
): Promise<string | null> {
  const handle = await getDatenShareHandle(idb);
  if (!handle) return null;
  try {
    return await readTextPrefix(handle, pfad, bytes);
  } catch (err) {
    console.warn(`[status] leseSidecarKopf(${pfad}) failed:`, err);
    return null;
  }
}

/**
 * Schreibt eine Sidecar **gestreamt** — für Dateien, die als ein String zu groß
 * wären. Self-gated wie {@link schreibeSidecar}.
 */
export async function schreibeSidecarGestreamt(
  idb: IDBStore, pfad: string, erzeuge: (sink: AtomicWriteSink) => Promise<void>,
): Promise<boolean> {
  const handle = await getDatenShareHandle(idb);
  if (!handle) return false;
  if ((await queryPermission(handle)) !== 'granted') return false;
  try {
    await atomicWriteStream(handle, pfad, erzeuge);
    return true;
  } catch (err) {
    console.error(`[status] schreibeSidecarGestreamt(${pfad}) failed:`, err);
    return false;
  }
}

/**
 * Listet die Dateinamen in einem Sidecar-Verzeichnis. Leer bei fehlendem Handle
 * oder fehlendem Ordner — ein Verzeichnis, das es noch nicht gibt, ist kein Fehler,
 * sondern der Zustand „hat noch niemand etwas hineingeschrieben".
 *
 * Gebraucht von Ablagen, die eine Datei **je Autor** führen: dort ist die Liste
 * der Dateien die Liste der Beteiligten (siehe `zu-klaeren/pfade.ts`).
 */
export async function listeSidecarDateien(
  idb: IDBStore, verzeichnis: string,
): Promise<string[]> {
  const handle = await getDatenShareHandle(idb);
  if (!handle) return [];
  try {
    return (await listFilesWithBackupInfo(handle, verzeichnis)).map(e => e.name);
  } catch (err) {
    console.warn(`[status] listeSidecarDateien(${verzeichnis}) failed:`, err);
    return [];
  }
}

/**
 * Hängt Zeilen an eine append-only Sidecar an (Profil „append-only",
 * Pitfall #23). Self-gated wie {@link schreibeSidecar}.
 *
 * **Achtung, read-modify-write**: `appendToFile` liest die ganze Datei, hängt an
 * und schreibt sie neu. Auf einer Datei mit MEHREREN gleichzeitigen Schreibern
 * kann dabei eine Zeile verlorengehen, ohne dass dieser Aufruf es merkt. Wer
 * mehrere Schreiber hat, teilt die Ablage auf (eine Datei je Autor), statt sich
 * auf einen Wiederholungsversuch zu verlassen.
 */
export async function haengeAnSidecar(
  idb: IDBStore, pfad: string, zeilen: string,
): Promise<boolean> {
  const handle = await getDatenShareHandle(idb);
  if (!handle) return false;
  if ((await queryPermission(handle)) !== 'granted') return false;
  try {
    await appendToFile(handle, pfad, zeilen);
    return true;
  } catch (err) {
    console.error(`[status] haengeAnSidecar(${pfad}) failed:`, err);
    return false;
  }
}
