/**
 * Bewertungs-Projektion: der Meilenstein-Stand aller offenen Verbünde eines
 * Programms, vorberechnet und gerätelokal im `kv`-Store gehalten.
 *
 * Warum vorberechnet: die Bewertung braucht die VOLLEN Antrag-Records (die
 * `D_*`-Spalten, auf die eine PL-Konfiguration zeigen kann, stehen nicht in der
 * schlanken Listen-Projektion). Das einmal nach dem Import zu tun ist billig,
 * bei jedem Öffnen des Cockpits wäre es das nicht.
 *
 * Warum nur OFFENE Verbünde: abgeschlossene ändern ihren Meilenstein-Stand nicht
 * mehr, und ihre Bearbeitungsdauer lässt sich vollständig aus der schlanken
 * Listen-Projektion rechnen (`werteDauernAus`). Der gespeicherte Datensatz bleibt
 * damit klein statt über alle ~5.000 Verbünde zu wachsen.
 *
 * Der **Signatur-Guard** ist die Lehre aus der stale List-View: eine Projektion
 * ohne Herkunftsstempel wird irgendwann still falsch. Ändert sich der Plan, das
 * Spalten-Mapping oder der CSV-Stand, passt die Signatur nicht mehr und die
 * Projektion wird verworfen statt weiterverwendet.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import { listAntraegeByVerbund, listVerbuendeByProgramm } from '@/core/services/csv/idb-csv';
import { verbundAntragsdatum } from '@/core/services/csv/frist';
import type { CsvSchema } from '@/core/services/csv/types';
import { isTerminalStatus } from '@/core/utils/status-canonical';
import { getAntragstypBucket } from '@/core/utils/vb-phase-mappings';
import type { MeilensteinPlan, VerbundMeilensteine } from './typen';
import { baueMeilensteinKontext, benoetigteFelder, loeseFelderAuf } from './felder';
import { bewerteVerbund } from './bewertung';

const PROJEKTION_PREFIX = 'meilenstein-stand:';

export interface MeilensteinProjektion {
  /** Herkunftsstempel — passt er nicht, ist die Projektion wertlos. */
  signatur: string;
  erstelltAm: string;
  programmId: string;
  /** Nur nicht-terminale Verbünde. */
  verbuende: VerbundMeilensteine[];
}

export const projektionsKey = (programmId: string): string => `${PROJEKTION_PREFIX}${programmId}`;

/**
 * Stempel aus Plan-Fassung, Mapping-/Datenstand **und Kalendertag**.
 *
 * `file_checksum` deckt den CSV-Inhalt ab, `column_mapping` die Zuordnung —
 * beides kann die Bewertung verändern, ohne dass ein Import läuft (Mapping-
 * Nachzug durch die Kuration). Der Tag muss mit hinein, weil die Bewertung
 * zeitabhängig ist: derselbe Datenstand ist morgen einen Tag näher am
 * Soll-Termin. Ohne Tages-Anteil bliebe „fällig" stehen, während der Meilenstein
 * längst gerissen ist — die Projektion wird deshalb höchstens einmal pro Tag und
 * Programm neu gerechnet.
 */
export function baueSignatur(
  plan: MeilensteinPlan, schemas: readonly CsvSchema[], heute: string,
): string {
  const schemaTeil = [...schemas]
    .map(s => `${s.id}:${s.file_checksum ?? ''}:${Object.keys(s.column_mapping).length}`)
    .sort()
    .join(',');
  return `p${plan.version}@${plan.stand}|${schemaTeil}|${heute.slice(0, 10)}`;
}

/**
 * Berechnet den Stand aller offenen Verbünde eines Programms. Rein lesend;
 * schreibt nichts. `heute` wird hereingereicht (Testbarkeit).
 */
export async function berechneProjektion(
  idb: IDBStore,
  programmId: string,
  plan: MeilensteinPlan,
  schemas: readonly CsvSchema[],
  heute: string,
): Promise<VerbundMeilensteine[]> {
  const aufloesung = loeseFelderAuf(schemas, benoetigteFelder(plan));
  const verbuende = await listVerbuendeByProgramm(idb, programmId);
  const out: VerbundMeilensteine[] = [];

  for (const verbund of verbuende) {
    const antraege = await listAntraegeByVerbund(idb, verbund.verbund_id);
    if (antraege.length === 0) continue;

    // Terminale Verbünde tragen nichts mehr zum Monitoring bei. Maßgeblich ist
    // der Verbund-Status; fehlt er, entscheidet das erste Teilvorhaben.
    const leitStatus = verbund.status ?? antraege[0]?.status;
    if (isTerminalStatus(leitStatus)) continue;

    const records = antraege.map(a => ({
      aktenzeichen: a.aktenzeichen,
      record: a as unknown as Record<string, unknown>,
    }));

    out.push(bewerteVerbund(plan, {
      verbundId: verbund.verbund_id,
      antragsdatum: verbundAntragsdatum(antraege),
      typ: getAntragstypBucket(antraege[0]?.vb_phase),
      kontext: baueMeilensteinKontext(
        aufloesung, verbund as unknown as Record<string, unknown>, records,
      ),
    }, heute));
  }
  return out;
}

/** Liest die gespeicherte Projektion; `null` bei fehlender oder veralteter Signatur. */
export async function ladeProjektion(
  idb: IDBStore, programmId: string, erwarteteSignatur: string,
): Promise<MeilensteinProjektion | null> {
  const gespeichert = await idb.get<MeilensteinProjektion>(projektionsKey(programmId));
  if (!gespeichert || !Array.isArray(gespeichert.verbuende)) return null;
  if (gespeichert.signatur !== erwarteteSignatur) return null;
  return gespeichert;
}

export async function speichereProjektion(
  idb: IDBStore, projektion: MeilensteinProjektion,
): Promise<void> {
  await idb.set(projektionsKey(projektion.programmId), projektion);
}

/**
 * Projektion holen — aus dem Speicher, wenn die Signatur passt, sonst frisch
 * berechnen und ablegen. Der einzige Weg, an den Stand zu kommen; damit gibt es
 * genau eine Stelle, an der die Signatur geprüft wird.
 */
export async function holeProjektion(
  idb: IDBStore,
  programmId: string,
  plan: MeilensteinPlan,
  schemas: readonly CsvSchema[],
  heute: string,
): Promise<MeilensteinProjektion> {
  const signatur = baueSignatur(plan, schemas, heute);
  const vorhanden = await ladeProjektion(idb, programmId, signatur);
  if (vorhanden) return vorhanden;

  const projektion: MeilensteinProjektion = {
    signatur,
    erstelltAm: heute,
    programmId,
    verbuende: await berechneProjektion(idb, programmId, plan, schemas, heute),
  };
  await speichereProjektion(idb, projektion);
  return projektion;
}
