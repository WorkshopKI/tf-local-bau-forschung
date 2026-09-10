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
import type { IDBStore } from '@/core/services/storage/idb-store';
import { jedesProgrammRoh } from './roh-halter';
import {
  baueFeldAufloesung, baueVorkommenPlan, sammleVorkommenGeplant, type FeldVorkommen,
} from './feld-aufloesung';
import type { MappingVersion } from './typen';

/** Ein Vorgang aus dem Bestand, fertig für die Regel-Auswertung. */
export interface VorgangsRohsatz {
  aktenzeichen: string;
  /** Für den Betrachtungsbereich — der Aufrufer entscheidet, nicht dieses Modul. */
  unterprogrammId: unknown;
  verbundId: string | null;
  /** Der VOLLE Antrags-Record aus dem `ANTRAEGE`-Store — nicht die
   *  Listen-Projektion: die Regeln lesen `D_`/`T_`-Spalten, die dort fehlen. */
  record: Record<string, unknown>;
  /** Die gesetzten Statuseinträge aus Verbund- UND TV-Record. */
  vorkommen: FeldVorkommen[];
}

/** Was ein Durchlauf je Programm gekostet hat — für die Messung, nicht für die Fachlichkeit. */
export interface VorgangsTakt {
  programmId: string;
  /** Lesen aus IDB (Verbünde, Anträge, Schemas). */
  ioMs: number;
  /** `sammleVorkommen` über alle Anträge dieses Programms. */
  sammelMs: number;
  /** Die Callback-Zeit des Aufrufers — sein eigenes Rechnen. */
  besucheMs: number;
  n: number;
}

/**
 * Ruft `besuche` für jeden Antrag des Bestands auf. Reihenfolge: Programme in
 * Store-Ordnung, darin die Anträge (`aktenzeichen` aufsteigend).
 *
 * Callback statt Rückgabe-Array: über 14 000 Vorgänge käme sonst der ganze
 * Bestand samt VORKOMMEN gleichzeitig in den Speicher, und jeder Aufrufer
 * braucht ohnehin nur das, was er daraus rechnet.
 *
 * **Ein `getAll` je Programm, bewusst nicht gechunkt.** `forEachAntragChunkByProgramm`
 * sieht hier passend aus (beschränkter Speicher-Ausschlag) und wurde v4.103
 * probiert — gemessen kostete es **~7 s mehr**: 28 einzelne Transaktionen statt
 * einer, und die Pausen dazwischen liegen ausserhalb jeder Chunk-Messung. Der
 * Speicher-Ausschlag ist mit der schlanken `filterRecord`-Projektion ohnehin
 * kein Problem mehr, weil die fetten Records nach dem Lauf nicht mehr gehalten
 * werden.
 *
 * **Und seit v6.48 nur einmal, auch wenn zwei Durchgänge es gleichzeitig
 * wollen**: das Lesen liegt im [roh-halter](./roh-halter.ts), der die Arrays
 * eines Programms unter allen laufenden Durchgängen teilt. `takt.ioMs` ist für
 * einen Mitfahrer entsprechend die Wartezeit auf den Leser, nicht ein zweiter
 * `getAll`.
 *
 * `takt` ist **opt-in**: die Zeitnahme kostet zwei `performance.now()` je Antrag
 * und hat im ungemessenen Betrieb nichts im heißen Pfad verloren.
 */
export async function jederVorgang(
  idb: IDBStore,
  version: MappingVersion,
  besuche: (v: VorgangsRohsatz) => void,
  takt?: (t: VorgangsTakt) => void,
): Promise<void> {
  for await (const { roh, takt: rohTakt } of jedesProgrammRoh(idb)) {
    const { programmId, verbuende, antraege, schemas } = roh;
    const ioMs = takt ? rohTakt.ioMs : 0;
    // EINMAL je Programm kompiliert statt je Antrag aufgelöst: der Plan hängt
    // nur an Schemas und Fassung, nicht am einzelnen Satz.
    const plan = baueVorkommenPlan(version.felder, baueFeldAufloesung(schemas, version.felder));
    const vbRecords = new Map(
      verbuende.map(x => [x.verbund_id, x as unknown as Record<string, unknown>]),
    );
    let sammelMs = 0;
    let besucheMs = 0;

    for (const a of antraege) {
      const record = a as unknown as Record<string, unknown>;
      const verbundId = typeof a.verbund_id === 'string' && a.verbund_id ? a.verbund_id : null;
      const tS = takt ? performance.now() : 0;
      const vorkommen = sammleVorkommenGeplant(
        plan,
        (verbundId ? vbRecords.get(verbundId) : undefined) ?? {},
        [{ aktenzeichen: a.aktenzeichen, record }],
      );
      const tB = takt ? performance.now() : 0;
      besuche({
        aktenzeichen: a.aktenzeichen,
        unterprogrammId: a.unterprogramm_id,
        verbundId,
        record,
        vorkommen,
      });
      if (takt) {
        sammelMs += tB - tS;
        besucheMs += performance.now() - tB;
      }
    }

    takt?.({ programmId, ioMs, sammelMs, besucheMs, n: antraege.length });
  }
}
