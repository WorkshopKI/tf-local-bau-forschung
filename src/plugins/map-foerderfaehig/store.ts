/**
 * Persistenz des MAP-Moduls im generischen `kv`-Store.
 *
 * Drei Präfixe, alle mit Exact-Key-Lookup bzw. Präfix-Scan:
 *   `map-einreichung:<id>`         eine importierte Einreichung
 *   `map-report:<id>`              der zugehörige Import-Report
 *   `map-pruefung:<einreichungId>` der Prüfstand (Phase 2)
 *
 * Bewusst KEIN dedizierter Object-Store: der IDBStore steht auf v10, und ein
 * Version-Bump löst unter `file://` mit parallel offenen Build-Varianten ein
 * `onblocked`-Upgrade aus (siehe recurring-bug-classes.md §3). Dasselbe Muster
 * nutzen `gutachten-kurzfassung:`, `workflow-run:` und `aufbereitung:`.
 *
 * Bewusst auch KEIN Spiegel in den persönlichen Ordner und kein Snapshot-
 * Anteil: MAP-Daten sind gerätelokale Prüfstände, keine geteilten Stammdaten.
 * Sie gehören damit nicht auf den Daten-Share.
 *
 * Report und Einreichung liegen getrennt, weil die Liste nur die Einreichungen
 * braucht — der Report ist gross (alle Feldbefunde, alle verworfenen Pfade) und
 * wird erst beim Öffnen der Detailansicht geladen.
 */
import type { IDBStore } from '@/core/services/storage';
import { CHECKLISTE_SEED } from './checkliste/seed';
import type { MapChecklistenDefinition, MapPruefung } from './checkliste/typen';
import type { MapEinreichung, MapImportReport } from './types';

const EINREICHUNG_PRAEFIX = 'map-einreichung:';
const REPORT_PRAEFIX = 'map-report:';
const CHECKLISTE_KEY = 'map-checkliste:aktuell';
const PRUEFUNG_PRAEFIX = 'map-pruefung:';
const VB_PRAEFIX = 'map-vb:';

const einreichungKey = (id: string): string => `${EINREICHUNG_PRAEFIX}${id}`;
const reportKey = (id: string): string => `${REPORT_PRAEFIX}${id}`;
const pruefungKey = (id: string): string => `${PRUEFUNG_PRAEFIX}${id}`;

/** Alle Einreichungen, jüngste zuerst. */
export async function listeEinreichungen(idb: IDBStore): Promise<MapEinreichung[]> {
  const eintraege = await idb.entries(EINREICHUNG_PRAEFIX);
  return eintraege
    .map(([, wert]) => wert as MapEinreichung)
    .filter(e => e && typeof e === 'object')
    .sort((a, b) => (b.importiertAm ?? '').localeCompare(a.importiertAm ?? ''));
}

export async function getEinreichung(idb: IDBStore, id: string): Promise<MapEinreichung | null> {
  return idb.get<MapEinreichung>(einreichungKey(id));
}

export async function getReport(idb: IDBStore, id: string): Promise<MapImportReport | null> {
  return idb.get<MapImportReport>(reportKey(id));
}

/** Schreibt Einreichung und Report gemeinsam — sie gehören zusammen. */
export async function putEinreichung(
  idb: IDBStore, einreichung: MapEinreichung, report: MapImportReport,
): Promise<void> {
  await idb.set(einreichungKey(einreichung.id), einreichung);
  await idb.set(reportKey(einreichung.id), report);
}

export async function deleteEinreichung(idb: IDBStore, id: string): Promise<void> {
  await idb.delete(einreichungKey(id));
  await idb.delete(reportKey(id));
  await idb.delete(pruefungKey(id));
  await idb.delete(`${VB_PRAEFIX}${id}`);
}

/**
 * Sucht eine bereits importierte Einreichung mit demselben Quell-Hash.
 * Grundlage der Idempotenz: dieselbe Datei zweimal fallen lassen soll die
 * bestehende Einreichung aktualisieren, nicht eine zweite anlegen.
 */
export async function findeNachQuellHash(
  idb: IDBStore, quellHash: string,
): Promise<MapEinreichung | null> {
  const alle = await listeEinreichungen(idb);
  return alle.find(e => e.quellHash === quellHash) ?? null;
}

// --- Checkliste -------------------------------------------------------------

/**
 * Aktuelle Checklisten-Fassung. Beim ersten Aufruf wird der Seed geschrieben —
 * ab dann ist die gespeicherte Fassung massgeblich, damit Änderungen aus dem
 * Editor einen Neustart überleben und nicht vom Seed überschrieben werden.
 */
export async function ladeCheckliste(idb: IDBStore): Promise<MapChecklistenDefinition> {
  const gespeichert = await idb.get<MapChecklistenDefinition>(CHECKLISTE_KEY);
  if (gespeichert && Array.isArray(gespeichert.items) && gespeichert.items.length > 0) {
    return gespeichert;
  }
  await idb.set(CHECKLISTE_KEY, CHECKLISTE_SEED);
  return CHECKLISTE_SEED;
}

export async function speichereCheckliste(
  idb: IDBStore, definition: MapChecklistenDefinition,
): Promise<void> {
  await idb.set(CHECKLISTE_KEY, definition);
}

/** Setzt die Checkliste auf die Auslieferungsfassung zurück. */
export async function setzeChecklisteZurueck(idb: IDBStore): Promise<MapChecklistenDefinition> {
  await idb.set(CHECKLISTE_KEY, CHECKLISTE_SEED);
  return CHECKLISTE_SEED;
}

// --- Prüfstand --------------------------------------------------------------

export async function getPruefung(idb: IDBStore, einreichungId: string): Promise<MapPruefung | null> {
  return idb.get<MapPruefung>(pruefungKey(einreichungId));
}

export async function putPruefung(idb: IDBStore, pruefung: MapPruefung): Promise<void> {
  await idb.set(pruefungKey(pruefung.einreichungId), pruefung);
}

// --- Zuordnung der Vorhabensbeschreibung -----------------------------------

export interface VbDokRef {
  docId: string;
  docName: string;
}

/**
 * Die Vorhabensbeschreibung ist in der Praxis oft auf mehrere Dateien verteilt —
 * Hauptdokument plus Marktkonzept, Verwertung, Wirkung als eigene PDFs. Deshalb
 * ein Hauptdokument (Korpus-Präfix) und beliebig viele Zusatzdokumente.
 *
 * `zusatz` ist **optional**: Zuordnungen aus der Zeit vor v2.272 tragen das Feld
 * nicht und laden unverändert als Ein-Dokument-Fall.
 */
export interface VbZuordnung extends VbDokRef {
  /** Zusatzdokumente in Korpus-Reihenfolge. */
  zusatz?: VbDokRef[];
}

export async function getVbZuordnung(
  idb: IDBStore, einreichungId: string,
): Promise<VbZuordnung | null> {
  return idb.get<VbZuordnung>(`${VB_PRAEFIX}${einreichungId}`);
}

export async function setzeVbZuordnung(
  idb: IDBStore, einreichungId: string, zuordnung: VbZuordnung | null,
): Promise<void> {
  const key = `${VB_PRAEFIX}${einreichungId}`;
  if (zuordnung === null) await idb.delete(key);
  else await idb.set(key, zuordnung);
}
