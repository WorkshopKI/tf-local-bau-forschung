/**
 * Der **Bestand als Folge auswertbarer Vorgänge** — einmal geschrieben, von
 * allen benutzt.
 *
 * Board, Regel-Erhebung und Export brauchen dieselbe Vorarbeit: je Programm die
 * Schemas auflösen (dieselbe Spalte liegt in verschiedenen Programmen unter
 * verschiedenen Record-Keys, Bug-Klasse 5), die Verbund-Records greifbar machen
 * und je Antrag die gesetzten Statuseinträge sammeln. Dreimal geschrieben liefe
 * das beim ersten Sonderfall auseinander — und der Vergleich „Board sagt X, der
 * Export sagt Y" wäre nicht mehr aufzuklären.
 *
 * **Die Einheit ist das Teilvorhaben, nicht der Verbund.** Der Kontext eines
 * Antrags besteht aus den Verbund-Feldern PLUS seinen eigenen; würfe man alle
 * Teilvorhaben eines Verbunds in einen Topf, bekäme ein fertiges TV das To-do
 * seines Nachbarn.
 *
 * **Kein Betrachtungsbereich hier drin** (Pitfall #46): dies ist der Daten-Layer.
 * Wer filtert, tut es sichtbar im Aufrufer.
 */
import {
  listProgramme, listVerbuendeByProgramm, listAntraegeByProgramm, listSchemasByProgramm,
} from '@/core/services/csv/idb-csv';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { baueFeldAufloesung, sammleVorkommen, type FeldVorkommen } from './feld-aufloesung';
import type { MappingVersion } from './typen';

/** Ein Vorgang aus dem Bestand, fertig für die Regel-Auswertung. */
export interface VorgangsRohsatz {
  aktenzeichen: string;
  /** Für den Betrachtungsbereich — der Aufrufer entscheidet, nicht dieses Modul. */
  unterprogrammId: unknown;
  verbundId: string | null;
  /** Der volle Antrags-Record (Listen-Projektion des Stores). */
  record: Record<string, unknown>;
  /** Die gesetzten Statuseinträge aus Verbund- UND TV-Record. */
  vorkommen: FeldVorkommen[];
}

/**
 * Ruft `besuche` für jeden Antrag des Bestands auf. Reihenfolge: Programme in
 * Store-Ordnung, darin die Anträge.
 *
 * Callback statt Rückgabe-Array: über 14 000 Vorgänge käme sonst der ganze
 * Bestand samt Vorkommen gleichzeitig in den Speicher, und jeder Aufrufer
 * braucht ohnehin nur das, was er daraus rechnet.
 */
export async function jederVorgang(
  idb: IDBStore,
  version: MappingVersion,
  besuche: (v: VorgangsRohsatz) => void,
): Promise<void> {
  for (const p of await listProgramme(idb)) {
    const [verbuende, antraege, schemas] = await Promise.all([
      listVerbuendeByProgramm(idb, p.id),
      listAntraegeByProgramm(idb, p.id),
      listSchemasByProgramm(idb, p.id),
    ]);
    const aufloesung = baueFeldAufloesung(schemas, version.felder);
    const vbRecords = new Map(
      verbuende.map(x => [x.verbund_id, x as unknown as Record<string, unknown>]),
    );

    for (const a of antraege) {
      const record = a as unknown as Record<string, unknown>;
      const verbundId = typeof a.verbund_id === 'string' && a.verbund_id ? a.verbund_id : null;
      besuche({
        aktenzeichen: a.aktenzeichen,
        unterprogrammId: a.unterprogramm_id,
        verbundId,
        record,
        vorkommen: sammleVorkommen(
          version.felder,
          (verbundId ? vbRecords.get(verbundId) : undefined) ?? {},
          [{ aktenzeichen: a.aktenzeichen, record }],
          aufloesung,
        ),
      });
    }
  }
}
