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
import type { MapEinreichung, MapImportReport } from './types';

const EINREICHUNG_PRAEFIX = 'map-einreichung:';
const REPORT_PRAEFIX = 'map-report:';

const einreichungKey = (id: string): string => `${EINREICHUNG_PRAEFIX}${id}`;
const reportKey = (id: string): string => `${REPORT_PRAEFIX}${id}`;

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
