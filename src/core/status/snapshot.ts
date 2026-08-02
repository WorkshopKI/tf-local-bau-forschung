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
 *
 * **Die Varianten kommen mit** (`indexNachSchreibweise`). Ließe der Snapshot sie
 * weg, löste „techn. geprüft" über die eingebaute Map auf, über den Snapshot
 * aber nicht — die App verhielte sich mit Flag anders als ohne, in derselben
 * Version. Genau das misst `byte-identitaet`.
 *
 * **Die Kategorie wird abgeleitet, nicht aus der Fassung übernommen** — siehe
 * `kategorieAusFassung`. Sonst trüge eine ältere Fassung die Kategorien ihres
 * Seed-Standes weiter, obwohl der Code-Katalog längst etwas anderes sagt.
 */
import { setStatusKatalogSnapshotMap } from '@/core/utils/status-canonical';
import type { MappingVersion, StatusCategory, StatusWertEintrag } from './typen';
import { indexNachSchreibweise } from './wert-index';
import { kategorieFuerCode, kategorieFuerPhase } from './kategorie-ableitung';

let aktiveVersion: MappingVersion | null = null;

/** Setzt (oder löscht mit `null`) den aktiven Katalog-Snapshot. Nach jedem
 *  Aktivieren im Cockpit und einmalig beim App-Start aufgerufen. */
export function setStatusKatalogSnapshot(version: MappingVersion | null): void {
  aktiveVersion = version;
  if (!version) {
    setStatusKatalogSnapshotMap(null);
    return;
  }
  const idx = indexNachSchreibweise(version.werte.filter(w => !w.unkuratiert));
  const m = new Map<string, StatusCategory>();
  for (const [key, w] of idx) m.set(key, kategorieAusFassung(w));
  setStatusKatalogSnapshotMap(m);
}

/**
 * Die Kategorie eines Eintrags **aus der Fassung**: für Werte mit amtlichem Code
 * abgeleitet aus (kuratierter) ZAH-Phase + Code, sonst das gepflegte Feld.
 *
 * Warum nicht einfach `w.kategorie`: das Feld stammt aus dem Seed-Stand, unter
 * dem die Fassung angelegt wurde. Eine Fassung von gestern trüge damit die
 * Kategorien von gestern und überschriebe die Ableitung — beobachtet an Fassung
 * v7, die `NL eingegangen` noch als `offen` führte, während die eingebaute Map
 * schon `nachforderung` sagte. Ergebnis: Zähler, die auf derselben Seite
 * verschiedene Zahlen zeigten, je nachdem ob sie beim Modul-Laden oder beim
 * Rendern fragten.
 *
 * `zahPhaseId` ist dreiwertig und wird auch so gelesen: gesetzt = kuratiert,
 * `null` = bewusst Marker, `undefined` = noch nicht zugeordnet ⇒ Auslieferungs-
 * Schnitt (dieselbe Regel wie in `baueHerleitung`).
 */
function kategorieAusFassung(w: StatusWertEintrag): StatusCategory {
  if (w.code === undefined) return w.kategorie;   // Bauantrag-Domäne, kein Code
  if (w.zahPhaseId !== undefined) return kategorieFuerPhase(w.zahPhaseId, w.code);
  return kategorieFuerCode(w.code);
}

/** Die aktuell aktive Version (oder `null`, wenn kein Snapshot gesetzt ist).
 *  Synchroner Zugriff für Engine/Timeline/Cockpit, die die volle Version brauchen. */
export function getAktiveVersion(): MappingVersion | null {
  return aktiveVersion;
}
