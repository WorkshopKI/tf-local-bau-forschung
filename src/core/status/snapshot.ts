/**
 * In-Memory-Snapshot der aktiven Katalog-Version.
 *
 * `getStatusCategory` (in `status-canonical.ts`) bleibt synchron — sie liest den
 * flachen Wert→Kategorie-Snapshot, den diese Datei setzt. Ohne gesetzten
 * Snapshot (Tests, früher Boot, Flag aus) greift dort der eingebaute
 * `CATEGORY_MAP`-Fallback; das Ergebnis ist bei identischem Mapping bitweise
 * gleich.
 *
 * Der Snapshot kollabiert die feld-skopierten Wert-Einträge auf eine flache
 * `normalisiert(wert) → Kategorie`-Map — `getStatusCategory` kennt kein Feld.
 * Der Seed führt jeden Wert unter allen Feldern mit derselben Kategorie, daher
 * ist die Kollabierung eindeutig. `unkuratiert`-Einträge speisen die Laufzeit-
 * Kategorie **nicht** (sie sind ein Kurations-Todo, kein Kategorien-Fakt).
 */
import { setStatusKatalogSnapshotMap } from '@/core/utils/status-canonical';
import type { MappingVersion, StatusCategory } from './typen';
import { normalisiereWert } from './typen';

let aktiveVersion: MappingVersion | null = null;

/** Setzt (oder löscht mit `null`) den aktiven Katalog-Snapshot. Nach jedem
 *  Aktivieren im Cockpit und einmalig beim App-Start aufgerufen. */
export function setStatusKatalogSnapshot(version: MappingVersion | null): void {
  aktiveVersion = version;
  if (!version) {
    setStatusKatalogSnapshotMap(null);
    return;
  }
  const m = new Map<string, StatusCategory>();
  for (const w of version.werte) {
    if (w.unkuratiert) continue;
    m.set(normalisiereWert(w.wert), w.kategorie);
  }
  setStatusKatalogSnapshotMap(m);
}

/** Die aktuell aktive Version (oder `null`, wenn kein Snapshot gesetzt ist).
 *  Synchroner Zugriff für Engine/Timeline/Cockpit, die die volle Version brauchen. */
export function getAktiveVersion(): MappingVersion | null {
  return aktiveVersion;
}
