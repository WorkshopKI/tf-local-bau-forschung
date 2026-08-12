/**
 * Lädt die Feld-Vorkommen eines Verbunds für die Status-Detailansicht (Chronik,
 * Band, Navigator, Ordner-Liste). Gerätelokal, read-only — und ohne jede
 * Ableitung: der Status kommt aus dem Export.
 *
 * **Ohne das Ereignis-Protokoll.** Bis v3.48 lud der Hook zusätzlich die
 * `StatusEvent`s samt Aufzeichnungsgrenze; beide gingen ausschließlich an die
 * waagerechte Zeitstrahl-Ansicht. Mit ihr sind sie entfallen — der Store und
 * `getStatusEvents` bleiben, sie speisen Reconcile und das Home-Widget.
 */
import { useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { getVerbund, listAntraegeByVerbund, listSchemasByProgramm } from '@/core/services/csv/idb-csv';
import {
  getAktiveVersion, ladeAktiveVersion, baueFeldAufloesung,
  sammleVorkommen, ladeTrigger,
  type MappingVersion, type FeldVorkommen, type TriggerZeile,
} from '@/core/status';
import { programmNummer } from './programmNummer';

export interface StatusVerlauf {
  laden: boolean;
  version: MappingVersion | null;
  /** Alle gesetzten Statuseinträge des Verbunds — Grundlage der Ordner-Ansicht. */
  vorkommen: FeldVorkommen[];
  /**
   * Dieselben Einträge, aber **je Teilvorhaben getrennt** (Verbund-Felder plus
   * die eigenen des TV).
   *
   * `vorkommen` wirft alle Teilvorhaben in einen Topf, was für Chronik und
   * Ordner-Liste richtig ist — dort geht es um den Verbund. Für die To-do-Regeln
   * wäre es falsch: sie lesen überwiegend TV-Spalten, und ein fertiges
   * Teilvorhaben bekäme das To-do seines Nachbarn.
   */
  jeTeilvorhaben: {
    aktenzeichen: string; titel: string; vorkommen: FeldVorkommen[];
    /** Roher `STATUS_TV`, wie importiert — die Verlaufsableitung braucht ihn
     *  ungefiltert, und geraten wird er nirgends (Pitfall #44). */
    statusTvRoh: unknown;
    /** `vb_phase` des Teilvorhabens; Grundlage der Projektform. */
    vbPhaseRoh: unknown;
  }[];
  /** Roher `STATUS_VB` aus dem Verbund-Record. */
  statusVbRoh: unknown;
  /** `vb_phase` des Verbunds; Rückfall, wo das TV keine eigene führt. */
  vbPhaseRoh: unknown;
  /**
   * Programm-/Richtlinien-Nummer des Vorhabens (`FM_NUMMER` →
   * `unterprogramm_id`). Wählt die Trigger-Menge des Navigators aus; `null`,
   * wenn die Spalte im Schema nicht gemappt ist — dann sagt die Anzeige das.
   */
  programm: string | null;
  /**
   * Die importierte C16-Trigger-Tabelle, **ungefiltert**. Seit v3.23 die
   * Regelquelle der Verlaufsableitung; die Auswahl auf das Programm macht
   * `baueVerlauf`, damit sie an einer Stelle liegt.
   */
  trigger: readonly TriggerZeile[];
  /** Import-Zähler des Trigger-Stands; `null` = keine Tabelle geladen. Geht in
   *  den Memo-Schlüssel, sonst überlebt ein Neu-Import den Cache. */
  triggerVersion: number | null;
}

const LEER: StatusVerlauf = {
  laden: true, version: null, vorkommen: [],
  jeTeilvorhaben: [], statusVbRoh: undefined, vbPhaseRoh: undefined, programm: null,
  trigger: [], triggerVersion: null,
};

export function useStatusVerlauf(verbundId: string | null): StatusVerlauf {
  const storage = useStorage();
  const idb = storage.idb;
  const [state, setState] = useState<StatusVerlauf>(LEER);

  useEffect(() => {
    if (!verbundId) { setState({ ...LEER, laden: false }); return; }
    let abgebrochen = false;
    setState(s => ({ ...s, laden: true }));
    void (async () => {
      try {
        const version = getAktiveVersion() ?? await ladeAktiveVersion(idb);
        const [verbund, antraege, triggerStand] = await Promise.all([
          getVerbund(idb, verbundId),
          listAntraegeByVerbund(idb, verbundId),
          ladeTrigger(idb),
        ]);
        if (abgebrochen) return;
        // Die Code-Felder tragen den rohen Spaltennamen; wo die Spalte im Record
        // liegt, sagt erst das Programm-Schema.
        const programmId = verbund?.programm_id ?? antraege[0]?.programm_id ?? null;
        const schemas = programmId ? await listSchemasByProgramm(idb, programmId) : [];
        if (abgebrochen) return;
        const aufloesung = baueFeldAufloesung(schemas, version.felder);
        const vbRecord = (verbund ?? {}) as unknown as Record<string, unknown>;
        const tvs = antraege.map(a => ({
          aktenzeichen: a.aktenzeichen, record: a as unknown as Record<string, unknown>,
        }));
        setState({
          laden: false, version,
          vorkommen: sammleVorkommen(version.felder, vbRecord, tvs, aufloesung),
          jeTeilvorhaben: antraege.map((a, i) => ({
            aktenzeichen: a.aktenzeichen,
            titel: typeof a.titel === 'string' && a.titel ? a.titel : (a.akronym ?? ''),
            vorkommen: sammleVorkommen(version.felder, vbRecord, [tvs[i]!], aufloesung),
            statusTvRoh: a.status,
            vbPhaseRoh: a.vb_phase,
          })),
          statusVbRoh: verbund?.status,
          vbPhaseRoh: (verbund as unknown as Record<string, unknown> | undefined)?.vb_phase
            ?? antraege[0]?.vb_phase,
          programm: programmNummer(antraege, verbundId),
          trigger: triggerStand.datei?.trigger ?? [],
          triggerVersion: triggerStand.datei?.version ?? null,
        });
      } catch {
        if (!abgebrochen) setState({ ...LEER, laden: false });
      }
    })();
    return () => { abgebrochen = true; };
  }, [idb, verbundId]);

  return state;
}
