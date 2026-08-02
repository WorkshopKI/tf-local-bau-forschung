/**
 * Lädt Status-Historie und Feld-Vorkommen eines Verbunds für die Status-
 * Detailansicht (Chronik, Zeitstrahl, Navigator, Ordner-Liste). Gerätelokal,
 * read-only — und ohne jede Ableitung: der Status kommt aus dem Export.
 */
import { useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { getVerbund, listAntraegeByVerbund, listSchemasByProgramm } from '@/core/services/csv/idb-csv';
import {
  getAktiveVersion, ladeAktiveVersion, getStatusEvents, baueFeldAufloesung,
  sammleVorkommen, aufzeichnungsGrenze,
  type MappingVersion, type StatusEvent, type FeldVorkommen,
} from '@/core/status';
import { programmNummer } from './programmNummer';

export interface StatusVerlauf {
  laden: boolean;
  version: MappingVersion | null;
  events: StatusEvent[];
  /** „ab hier lückenlose Aufzeichnung" (ISO) oder null. */
  grenze: string | null;
  /** Alle gesetzten Statuseinträge des Verbunds — Grundlage der Ordner-Ansicht. */
  vorkommen: FeldVorkommen[];
  /**
   * Programm-/Richtlinien-Nummer des Vorhabens (`FM_NUMMER` →
   * `unterprogramm_id`). Wählt die Trigger-Menge des Navigators aus; `null`,
   * wenn die Spalte im Schema nicht gemappt ist — dann sagt die Anzeige das.
   */
  programm: string | null;
}

const LEER: StatusVerlauf = {
  laden: true, version: null, events: [], grenze: null, vorkommen: [],
  programm: null,
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
        const [verbund, antraege, events] = await Promise.all([
          getVerbund(idb, verbundId),
          listAntraegeByVerbund(idb, verbundId),
          getStatusEvents(idb, verbundId),
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
          laden: false, version, events,
          grenze: aufzeichnungsGrenze(events),
          vorkommen: sammleVorkommen(version.felder, vbRecord, tvs, aufloesung),
          programm: programmNummer(antraege),
        });
      } catch {
        if (!abgebrochen) setState({ ...LEER, laden: false });
      }
    })();
    return () => { abgebrochen = true; };
  }, [idb, verbundId]);

  return state;
}
