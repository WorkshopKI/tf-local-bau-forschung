/**
 * Historie-Reconcile: nach jedem Import werden die aktuellen Feldwerte gegen den
 * **zuletzt aufgezeichneten Event-Stand** gehalten und Änderungen als neue
 * `StatusEvent`s angehängt.
 *
 * Bewusst NICHT im Merger (kein Eingriff in den heißen, gut getesteten Merge-
 * Pfad): das Event-Log speichert selbst den letzten bekannten Wert, deshalb wird
 * der Pre-Merge-Altwert nicht gebraucht. Erfasst dieselben Snapshot-zu-Snapshot-
 * Übergänge wie ein In-Merge-Diff, ist aber **idempotent** (läuft kein Wert
 * auseinander → keine neuen Events) und additiv.
 */
import type { IDBStore } from '@/core/services/storage';
import { listAntraegeByVerbund, listSchemasByProgramm, listVerbuendeByProgramm } from '@/core/services/csv/idb-csv';
import { parseGermanDate } from '@/core/services/csv/dateParse';
import { uuid } from '@/core/services/id-generator';
import type { MappingVersion } from './typen';
import type { StatusEvent } from './event-typen';
import { baueFeldAufloesung, sammleVorkommen, type FeldAufloesung } from './feld-aufloesung';
import { sortiereEvents } from './event-sort';
import { appendEvents, getStatusEvents } from './event-store';
import { ladeAktiveVersion } from './katalog-store';

const SEEDED_PREFIX = 'status-event:seeded:';

function latestKey(feldId: string, tvId: string | undefined): string {
  return `${feldId}::${tvId ?? ''}`;
}

/** Letzter aufgezeichneter Wert je (feldId, tvId) aus den bestehenden Events. */
export function baueLetzteWerte(events: readonly StatusEvent[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of sortiereEvents(events)) m.set(latestKey(e.feldId, e.tvId), e.wert);
  return m;
}

export interface ReconcileEingabe {
  verbundId: string;
  verbundRecord: Record<string, unknown>;
  antraege: { aktenzeichen: string; record: Record<string, unknown> }[];
  bestehendeEvents: readonly StatusEvent[];
}

/**
 * Reine Kernfunktion: liefert die anzufügenden Events. Idempotent (unveränderte
 * Werte → leer). `quelle: 'initial'` beim ersten Vorkommen, sonst `'import'`.
 * `neueId` injiziert (Testbarkeit).
 */
export function ermittleReconcileEvents(
  version: MappingVersion,
  eingabe: ReconcileEingabe,
  importId: string,
  jetztIso: string,
  neueId: () => string,
  aufloesung?: FeldAufloesung,
): StatusEvent[] {
  const latest = baueLetzteWerte(eingabe.bestehendeEvents);
  const out: StatusEvent[] = [];

  // Ein auf „Ignoriert" gesetztes Feld wird nirgends gerendert — es dann trotzdem
  // aufzuzeichnen bläht das Log ohne Gegenwert. Mit dem Code-Katalog stehen ~180
  // Felder zur Auswahl; das Stilllegen muss auch das Schreiben stoppen.
  const relevant = version.felder.filter(f => f.aktiv && f.prominenzDefault !== 'ignoriert');

  for (const v of sammleVorkommen(relevant, eingabe.verbundRecord, eingabe.antraege, aufloesung)) {
    const key = latestKey(v.feld.feldId, v.tvId);
    const vorher = latest.get(key);
    if (vorher === v.wert) continue;
    const datumFachlich = v.feld.typ === 'datum' ? (parseGermanDate(v.wert) ?? v.wert) : undefined;
    out.push({
      id: neueId(),
      verbundId: eingabe.verbundId,
      ...(v.tvId ? { tvId: v.tvId } : {}),
      feldId: v.feld.feldId,
      wert: v.wert,
      ...(vorher !== undefined ? { wertVorher: vorher } : {}),
      ...(datumFachlich ? { datumFachlich } : {}),
      erfasstAm: jetztIso,
      importId,
      quelle: vorher === undefined ? 'initial' : 'import',
    });
    latest.set(key, v.wert);
  }
  return out;
}

/**
 * Reconcile-Pass nach dem Import. Betrachtet die betroffenen Verbünde (Antraege
 * in `touchedAktenzeichen`); beim allerersten Lauf pro Programm werden ALLE
 * Verbünde einmal gebackfilled (`quelle: 'initial'`). Idempotent, best-effort,
 * gerätelokal. Gibt die Anzahl neu angehängter Events zurück.
 */
export async function reconcileStatusEvents(
  idb: IDBStore, programmId: string, touchedAktenzeichen: readonly string[], jetztIso: string,
): Promise<number> {
  const version = await ladeAktiveVersion(idb);
  // Die Code-Felder tragen den rohen Spalten-Code; wo die Spalte im Record
  // landet, sagt erst das Programm-Schema. Einmal je Lauf auflösen.
  const aufloesung = baueFeldAufloesung(await listSchemasByProgramm(idb, programmId), version.felder);
  const alleVerbuende = await listVerbuendeByProgramm(idb, programmId);
  const seededKey = `${SEEDED_PREFIX}${programmId}`;
  const seeded = (await idb.get<boolean>(seededKey)) === true;
  const touched = new Set(touchedAktenzeichen);
  const zu = seeded
    ? alleVerbuende.filter(v => (v.teilantrags_ids ?? []).some(az => touched.has(az)))
    : alleVerbuende;

  const importId = uuid();
  let gesamt = 0;
  for (const verbund of zu) {
    const antraege = await listAntraegeByVerbund(idb, verbund.verbund_id);
    const bestehende = await getStatusEvents(idb, verbund.verbund_id);
    const neue = ermittleReconcileEvents(
      version,
      {
        verbundId: verbund.verbund_id,
        verbundRecord: verbund as unknown as Record<string, unknown>,
        antraege: antraege.map(a => ({
          aktenzeichen: a.aktenzeichen,
          record: a as unknown as Record<string, unknown>,
        })),
        bestehendeEvents: bestehende,
      },
      importId, jetztIso, uuid, aufloesung,
    );
    if (neue.length > 0) {
      await appendEvents(idb, neue);
      gesamt += neue.length;
    }
  }
  if (!seeded) await idb.set(seededKey, true);
  return gesamt;
}
