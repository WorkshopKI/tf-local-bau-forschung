# Status-System neu — Historie (Schicht 2)

Append-only Log aller Statusfeld-Änderungen, katalog-getrieben. Speist die
Timeline (Phase 5) und macht die vom Legacy-Export zerstörte Historie
rekonstruierbar. Gerätelokal, gated hinter `statusCockpit`.

## Datenmodell

`StatusEvent` ([event-typen.ts](../../src/core/status/event-typen.ts)):
`{ id, verbundId, tvId?, feldId, wert, wertVorher?, datumFachlich?, erfasstAm, importId, quelle }`.
`quelle` = `initial` (erstes beobachtetes Vorkommen, Bestands-Backfill) | `import`
(spätere Änderung). Store `status_event` (IDBStore v11, KeyPath `id`, Index
`verbundId`/`feldId`). Strikt **append-only**: nach außen nur `appendEvents` +
Lese-Zugriffe, KEINE Update-/Delete-API (auch kein „Aufräumen" ignorierter Felder).

## Erfassung — Reconcile statt In-Merge-Diff (bewusste Abweichung)

Der Prompt/Plan sah den Emissions-Hook am Merger-Diff (`batched.ts:263`) vor.
Umgesetzt ist stattdessen ein **idempotenter Post-Import-Reconcile**
([reconcile.ts](../../src/core/status/reconcile.ts)):

- Nach jedem Import werden die **aktuellen** Feldwerte gegen den **zuletzt
  aufgezeichneten Event-Stand** gehalten (`baueLetzteWerte`). Weicht ein Wert ab
  → neues Event (`initial` beim ersten Vorkommen, sonst `import`).
- **Warum nicht im Merger:** das Event-Log speichert selbst den letzten bekannten
  Wert, deshalb wird der Pre-Merge-Altwert nicht gebraucht. Der Reconcile erfasst
  **dieselben Snapshot-zu-Snapshot-Übergänge** wie ein In-Merge-Diff (CSV-Importe
  sind Tages-Snapshots — Zwischenzustände sind ohnehin nicht beobachtbar), ist
  aber **idempotent** (kein Wert läuft auseinander → keine Events) und greift
  **nicht** in den heißen, gut getesteten Merge-Pfad ein.
- **Ebene-Routing:** `StatusFeldEintrag.ebene` (`verbund`|`tv`) + `quelleKey`
  ([feld-zugriff.ts](../../src/core/status/feld-zugriff.ts)) — insb. `verbund_status`,
  das der Verbund-Record unter `status` führt (`VB_FIELD_MAP` im Merger).
- **Kosten:** regulär nur betroffene Verbünde (Antraege in `changedAktenzeichen`);
  der **erste** Lauf pro Programm backfillt einmalig alle Verbünde
  (`status-event:seeded:<programmId>`).

## Grenze „ab hier lückenlose Aufzeichnung"

`aufzeichnungsGrenze` ([event-sort.ts](../../src/core/status/event-sort.ts)) =
frühestes `erfasstAm` mit `quelle: 'import'` (dort begann echtes Änderungs-
Tracking; Fallback: frühestes Event überhaupt). Wird in der Timeline (Phase 5)
als dezente Linie markiert.

## Verhältnis zur bestehenden Feld-Historie

Unberührt: `antrag_historie`/`verbund_historie` + das „↻ N Änderungen"-Modal
(trackHistory-gated, per Feld). Die Status-Events sind ein **zusätzliches**,
katalog-getriebenes Log mit reicherem Modell (Ebene, datumFachlich, Quelle) für
die Timeline.
