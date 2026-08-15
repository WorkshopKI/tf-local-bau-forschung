import type { IDBStore } from '../storage/idb-store';
import {
  listProgramme,
  listSchemasByProgramm,
  countAntraegeByProgramm,
  countAntraegeListViewByProgramm,
  forEachAntragChunkByProgramm,
  putAntraegeListView,
  clearAntraegeListView,
} from './idb-csv';
import { toAntragListItem } from './list-view';
import { LIST_VIEW_VERSION_KEY } from './constants';
import {
  resolveStatusDatumGruppen, type ResolvedKategorieSpalten,
} from './status-datum-gruppen';
import { ladeAktiveVersion } from '@/core/status/katalog-store';
import { kategorieSpaltenSignatur, loeseKategorieSpalten } from '@/core/status/kategorie-projektion';
import { freieFelderSignatur } from '@/core/spalten/aufloesung';
import { loeseFreieFelderFuer } from '@/core/spalten/programm';
import { murmurhash3 } from './hash';
import { tfPerfStart } from '@/core/utils/tfPerf';
import type { Programm } from './types';

/**
 * Schema-Version der List-View-Projektion. Bumpen, wenn `toAntragListItem`
 * neue Felder projiziert (v2: + t_hint, d_xtec, d_adv, tib_mail,
 * verbund_titel fuer den Auslastungs-Slim-Cache, v2.63; v3: + fb_status_label,
 * fb_status_datum, v2.121; v4: + precheck_status_label, precheck_status_datum,
 * v2.122; v5: erzwungener Voll-Rebuild — die FB/PC-Datums-Spalten wurden
 * nachträglich in den Programm-Schemas gemappt, aber eine Mapping-Änderung
 * ändert KEINEN Antrag-Record → weder der Count-Backfill unten noch der
 * inkrementelle Snapshot-Diff bauen die Projektion neu, und der Marker blieb
 * gleich ⇒ `fb_/precheck_status_label` blieben für den Altbestand dauerhaft
 * leer, v2.158.2) — der Count-basierte Backfill-Check unten erkennt
 * Feld-Aenderungen NICHT, nur fehlende Records. Marker-Mismatch → einmaliger
 * Voll-Rebuild beim ersten Start nach dem Update (~5 s bei 13k, bestehende
 * Boot-Statuszeile). v7: + `frei_roh`, die Rohwerte der Felder, die selbst
 * angelegte Spalten lesen (v4.55). Der Bump ist hier bewusst gesetzt, obwohl die
 * Schema-Signatur unten die Feldmenge ohnehin führt: eine Bestandsinstallation
 * ohne eigene Spalten hat eine LEERE Feldmenge, ihre Signatur ändert sich also
 * nicht — sie soll trotzdem einmal auf die neue Projektionsform kommen.
 */
export const LIST_VIEW_PROJECTION_VERSION = 7;
/**
 * Signatur der aus ALLEN Programm-Schemas aufgelösten Status-Datum-Felder
 * (FB/PC). Ergänzt den reinen Code-Versions-Marker: Eine Mapping-Änderung (eine
 * FB/PC-Spalte nachträglich gemappt / ge-`ignore`d / Label/Feldkey geändert)
 * bumpt den Code-Marker NICHT und markiert keinen Record als geändert, würde die
 * Projektion also nie neu bauen (Vorfall 2026-07: Spalten leer trotz gemapptem
 * Schema + vorhandenen Rohwerten). Ändert sich die Signatur, erzwingt der
 * Boot-Guard einen Voll-Rebuild — so lösen künftige Mapping-Änderungen den
 * Rebuild automatisch aus, ohne den Code-Marker von Hand bumpen zu müssen.
 */
const LIST_VIEW_SCHEMA_SIG_KEY = 'list-view-projection-schema-sig';

/**
 * Deterministische Signatur der aufgelösten FB/PC-Felder über alle Programme
 * (nach `id` sortiert). Erfasst code→feld→label je Gruppe — also exakt das, was
 * `computeStatusDatum` bei der Projektion liest. Reiner Hash, keine Mutation.
 */
async function computeStatusDatumSchemaSig(
  idb: IDBStore,
  programme: readonly Programm[],
): Promise<string> {
  const sorted = [...programme].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  // Der Statuskatalog geht mit in die Signatur: hängt die PL ein Feld um oder
  // benennt einen Ordner, ändert sich kein einziger Antrag-Record — die
  // Ordner-Spalten blieben sonst auf dem alten Stand stehen.
  const version = await ladeAktiveVersion(idb);
  const parts: string[] = [];
  for (const p of sorted) {
    const schemas = await listSchemasByProgramm(idb, p.id);
    const gruppen = resolveStatusDatumGruppen(schemas);
    const g = gruppen
      .map(gr => `${gr.labelKey}=${gr.felder.map(f => `${f.code}>${f.feld}#${f.label}`).join('|')}`)
      .join(';');
    const k = kategorieSpaltenSignatur(loeseKategorieSpalten(version, schemas));
    // Die Felder der selbst angelegten Spalten gehören dazu — sie sind das
    // Einzige an ihnen, was projiziert wird. Beschriftungen, Regeltexte und
    // Farben stehen bewusst NICHT drin: sie ändern die Anzeige, nicht die
    // Rohwerte, und dürfen deshalb keinen Neuaufbau auslösen.
    const f = freieFelderSignatur(await loeseFreieFelderFuer(idb, schemas));
    parts.push(`${p.id}{${g}}[${k}]<${f}>`);
  }
  return murmurhash3(parts.join('~'));
}

/**
 * Ordner-Spalten eines Programms — einmal je Programm auflösen, dann je Record
 * anwenden. Exportiert, weil die MERGE-Pfade dieselbe Auflösung brauchen: ihre
 * `putAntraegeListView`-Schreibvorgänge sind Vollersatz, ein Slim-Item ohne
 * `kat_status` löschte die Ordner-Spalte des Antrags wieder.
 */
export async function loeseKategorieSpaltenFuer(
  idb: IDBStore, programmId: string,
): Promise<ResolvedKategorieSpalten[]> {
  const [version, schemas] = await Promise.all([
    ladeAktiveVersion(idb), listSchemasByProgramm(idb, programmId),
  ]);
  return loeseKategorieSpalten(version, schemas);
}

/**
 * Liegt die Slim-Projektion auf der aktuellen Schema-Version? Nur dann darf ein
 * Snapshot-Sync die List-View INKREMENTELL (nur geänderte Records) pflegen —
 * sonst mischte er neue mit alt-projizierten Feldern. Bei Mismatch ist ein
 * Voll-Rebuild nötig (den `ensureListViewProjection` beim App-Start ohnehin
 * fährt, bevor der Sync-Orchestrator läuft).
 */
export async function isListViewProjectionCurrent(idb: IDBStore): Promise<boolean> {
  const marker = (await idb.get<number>(LIST_VIEW_VERSION_KEY).catch(() => null)) ?? null;
  if (marker !== LIST_VIEW_PROJECTION_VERSION) return false;
  // Die Schema-Signatur gehört mit: sie existiert genau deshalb, WEIL der
  // Code-Marker Mapping- und Katalog-Änderungen nicht sieht. Ohne sie hier
  // projizierte ein inkrementeller Sync die Delta-Anträge mit dem NEUEN Label,
  // während der Rest der Tabelle das alte behielt — dieselbe Spalte zeigte
  // denselben Sachverhalt in zwei Beschriftungen, bis zum nächsten App-Start.
  const gespeichert = (await idb.get<string>(LIST_VIEW_SCHEMA_SIG_KEY).catch(() => null)) ?? null;
  if (gespeichert === null) return false;
  const programme = await listProgramme(idb);
  return gespeichert === await computeStatusDatumSchemaSig(idb, programme);
}

/**
 * Schreibt Marker + Signatur auf den aktuellen Stand — für Aufrufer, die die
 * Projektion SELBST neu gebaut haben (z.B. nach dem Anlegen einer eigenen
 * Spalte).
 *
 * Ohne diesen Schritt bliebe die gespeicherte Signatur auf dem alten Stand, und
 * der Boot-Guard baute beim nächsten Start ein zweites Mal neu — dieselbe Arbeit
 * ein zweites Mal, nur diesmal im Startfenster, wo sie am meisten stört.
 */
export async function stempleProjektionsStand(idb: IDBStore): Promise<void> {
  const programme = await listProgramme(idb);
  await idb.set(LIST_VIEW_VERSION_KEY, LIST_VIEW_PROJECTION_VERSION);
  await idb.set(LIST_VIEW_SCHEMA_SIG_KEY, await computeStatusDatumSchemaSig(idb, programme));
}

export interface MigrationProgress {
  /** Programm aktuell in Bearbeitung. */
  programmId: string;
  /** Bereits projizierte Antraege im aktuellen Programm. */
  done: number;
  /** Gesamt-Antraege im aktuellen Programm. */
  total: number;
}

/**
 * Projiziert ALLE Antraege eines Programms in den Slim-Store — per gechunkten
 * Bulk-Reads (v2.63.1: `forEachAntragChunkByProgramm` statt per-Record-Cursor;
 * der Cursor kostete pro Record einen IDB-Roundtrip, ~10+ s bei 14k). Haelt
 * nie alle vollen Records gleichzeitig (Chunk-Peak ~18 MB statt ~470 MB,
 * OOM-Klasse v2.61.5); pro gelesenem Chunk wird direkt projiziert + geschrieben.
 */
async function projectProgrammStreamed(
  idb: IDBStore,
  programmId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const total = await countAntraegeByProgramm(idb, programmId);
  // Datums-Status-Gruppen einmal pro Programm aus dem Schema auflösen (Custom-/
  // Standard-Mapping-robust), dann je Record berechnen.
  const schemas = await listSchemasByProgramm(idb, programmId);
  const gruppen = resolveStatusDatumGruppen(schemas);
  const kategorieSpalten = await loeseKategorieSpaltenFuer(idb, programmId);
  const freieFelder = await loeseFreieFelderFuer(idb, schemas);
  let done = 0;
  await forEachAntragChunkByProgramm(idb, programmId, async records => {
    await putAntraegeListView(
      idb, records.map(r => toAntragListItem(r, gruppen, kategorieSpalten, freieFelder)),
    );
    done += records.length;
    onProgress?.(done, total);
  });
  return done;
}

/**
 * Idempotente Bulk-Migration: stellt sicher, dass fuer jedes Programm der
 * `ANTRAEGE_LIST_VIEW`-Store eine Slim-Projektion aller Antraege haelt UND
 * die Projektion dem aktuellen Schema (`LIST_VIEW_PROJECTION_VERSION`)
 * entspricht.
 *
 * Zwei Trigger:
 *  - **Versions-Marker weicht ab** (Update mit neuen Projektion-Feldern oder
 *    Bestand ohne Marker) → Voll-Rebuild; Marker wird erst NACH Erfolg
 *    geschrieben (Crash → naechster Start versucht erneut, crash-safe).
 *  - **Count-Mismatch** (Slim-Spiegel kleiner als der volle Store, z.B. nach
 *    abgebrochenem Erstlauf) → Backfill via Voll-Projektion des Programms.
 *
 * v2.63: Der Check laeuft per billigem Index-`count()` — bis dahin lud dieser
 * Pfad bei JEDEM App-Start alle vollen Records nur fuer den Laengen-Vergleich
 * (Sekunden Deserialize im Boot-Fenster, Teil des Citrix-Cold-Start-Budgets).
 */
export async function ensureListViewProjection(
  idb: IDBStore,
  onProgress?: (p: MigrationProgress) => void,
): Promise<void> {
  const end = tfPerfStart('ensureListViewProjection');

  const programme = await listProgramme(idb);
  const marker = (await idb.get<number>(LIST_VIEW_VERSION_KEY).catch(() => null)) ?? null;
  const currentSig = await computeStatusDatumSchemaSig(idb, programme);
  const storedSig = (await idb.get<string>(LIST_VIEW_SCHEMA_SIG_KEY).catch(() => null)) ?? null;
  // Voll-Rebuild bei (a) Code-Versions-Wechsel ODER (b) GEÄNDERTER Schema-
  // Signatur (FB/PC-Mapping nachgezogen). Eine FEHLENDE Signatur (Bestand vor
  // v2.158.2) erzwingt KEINEN Rebuild — das übernimmt bereits der v4→v5-Bump;
  // sie wird unten lazy nachgetragen, damit der „Marker aktuell → No-op"-Pfad
  // (Backfill/Stale-Erhalt) unangetastet bleibt.
  const sigChanged = storedSig !== null && storedSig !== currentSig;
  if (marker !== LIST_VIEW_PROJECTION_VERSION || sigChanged) {
    await rebuildAntraegeListView(idb, (done, total, programmId) => {
      onProgress?.({ programmId, done, total });
    });
    await idb.set(LIST_VIEW_VERSION_KEY, LIST_VIEW_PROJECTION_VERSION);
    await idb.set(LIST_VIEW_SCHEMA_SIG_KEY, currentSig);
    end(`full rebuild (v${marker ?? '∅'}→v${LIST_VIEW_PROJECTION_VERSION}${sigChanged ? ', schema-sig changed' : ''})`);
    return;
  }
  // Signatur erstmalig hinterlegen (kein Rebuild) — ab jetzt lösen künftige
  // Mapping-Änderungen den Guard oben aus.
  if (storedSig === null) await idb.set(LIST_VIEW_SCHEMA_SIG_KEY, currentSig);

  let totalProjected = 0;
  for (const p of programme) {
    const [fullCount, listViewCount] = await Promise.all([
      countAntraegeByProgramm(idb, p.id),
      countAntraegeListViewByProgramm(idb, p.id),
    ]);
    if (fullCount === 0 || listViewCount >= fullCount) continue;
    onProgress?.({ programmId: p.id, done: 0, total: fullCount });
    totalProjected += await projectProgrammStreamed(idb, p.id, (done, total) => {
      onProgress?.({ programmId: p.id, done, total });
    });
  }
  end(`projected=${totalProjected}`);
}

/**
 * VOLLSTÄNDIGER Neuaufbau der List-View-Projektion: leert den Slim-Store und
 * projiziert ALLE Antraege neu. Anders als `ensureListViewProjection` (nur
 * Backfill, wenn der Spiegel zu KLEIN ist) ist das zwingend nach einem
 * Snapshot-Sync, der den `ANTRAEGE`-Store via `replaceStore` komplett ersetzt
 * (clear + put), die List-View aber nicht berührt. Ohne diesen Rebuild liest
 * die Home die alte/leere Projektion und bleibt bis zum nächsten App-Start
 * (= manueller Reload, der `ensureListViewProjection` neu laufen lässt) leer.
 *
 * `onProgress` bekommt zusaetzlich die programmId (3. Arg) — bestehende
 * Zwei-Arg-Caller (snapshot-sync) bleiben kompatibel.
 */
export async function rebuildAntraegeListView(
  idb: IDBStore,
  onProgress?: (done: number, total: number, programmId: string) => void,
): Promise<void> {
  const end = tfPerfStart('rebuildAntraegeListView');
  await clearAntraegeListView(idb);
  const programme = await listProgramme(idb);
  let total = 0;
  for (const p of programme) {
    total += await projectProgrammStreamed(idb, p.id, (done, t) => onProgress?.(done, t, p.id));
  }
  end(`reprojected=${total}`);
}
