/**
 * Daten-Schicht der Verbund-Detailseite (aus `VerbundDetail` herausgelöst,
 * Journey-Paket 2 Phase 7). Lädt Verbund + Teilvorhaben + Historie + CSV-Schemas
 * (bzw. den synthetischen Pseudo-Verbund für Standalone-Anträge) und liefert die
 * Lead-First-sortierten TVs. Reine IO-/State-Schicht — die Präsentation
 * (`VerbundDetail`) bleibt schlank.
 */
import { useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import {
  getAntrag,
  getVerbund,
  listAntraegeByVerbund,
  getVerbundHistoryByVerbund,
  loadSchema,
  listSchemas,
} from '@/core/services/csv';
import type { Antrag, Verbund, VerbundHistorieEntry, CsvSchema } from '@/core/services/csv/types';
import { isNetzwerkLead } from './netzwerk';
import { aktenzeichenFromPseudoVerbundId, buildPseudoVerbund, buildVerbundFromTeilantraege } from './pseudoVerbund';

export interface VerbundDetailData {
  verbund: Verbund | null;
  antraege: Antrag[];
  history: VerbundHistorieEntry[];
  schemas: CsvSchema[];
  sourceNames: Record<string, string>;
}

export function useVerbundDetailData(verbundId: string, isPseudo: boolean): VerbundDetailData {
  const storage = useStorage();
  const [verbund, setVerbund] = useState<Verbund | null>(null);
  const [antraege, setAntraege] = useState<Antrag[]>([]);
  const [history, setHistory] = useState<VerbundHistorieEntry[]>([]);
  const [schemas, setSchemas] = useState<CsvSchema[]>([]);
  const [sourceNames, setSourceNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadSchemasFor(tvs: Antrag[]): Promise<void> {
      if (tvs.length === 0 || cancelled) return;
      const lead = tvs[0]!;
      const ids = new Set<string>();
      for (const tv of tvs) {
        for (const sid of Object.values(tv._field_sources ?? {})) ids.add(sid);
      }
      const names: Record<string, string> = {};
      const loaded: CsvSchema[] = [];
      for (const id of ids) {
        const s = await loadSchema(storage.idb, id);
        if (s) {
          names[id] = s.csv_source_name;
          loaded.push(s);
        }
      }
      const all = await listSchemas(storage.idb, lead.programm_id);
      if (cancelled) return;
      const byId = new Map<string, CsvSchema>();
      for (const s of all) byId.set(s.id, s);
      for (const s of loaded) byId.set(s.id, s);
      setSourceNames(names);
      setSchemas([...byId.values()]);
    }

    (async () => {
      if (isPseudo) {
        // Standalone-Antrag: synthetischer Verbund, einziger TV expandiert.
        const az = aktenzeichenFromPseudoVerbundId(verbundId);
        const a = await getAntrag(storage.idb, az);
        if (cancelled) return;
        if (!a) {
          setVerbund(null);
          setAntraege([]);
          setHistory([]);
          return;
        }
        setVerbund(buildPseudoVerbund(a));
        setAntraege([a]);
        setHistory([]);
        await loadSchemasFor([a]);
        return;
      }

      const v = await getVerbund(storage.idb, verbundId);
      const a = await listAntraegeByVerbund(storage.idb, verbundId);
      const h = await getVerbundHistoryByVerbund(storage.idb, verbundId);
      if (cancelled) return;
      // Lead-First-Sort: Netzwerk-Lead-TVs (Suffix 01/02 + vb_phase 1/2) zuerst,
      // dann nach Aktenzeichen aufsteigend.
      const sorted = [...a].sort((x, y) => {
        const xLead = isNetzwerkLead(x);
        const yLead = isNetzwerkLead(y);
        if (xLead !== yLead) return xLead ? -1 : 1;
        return x.aktenzeichen.localeCompare(y.aktenzeichen);
      });
      // Der `verbuende`-Store ist nur ein abgeleiteter Aggregat-Cache der Anträge.
      // Fehlt der Cache-Record (leerer/veralteter Store, Bug-Klasse Cold-Start-
      // Refresh), die TVs sind aber da → Header aus den TVs synthetisieren statt
      // „nicht gefunden". `dominantStatus`/Lead-Fallbacks füllen Status/Akronym/Titel.
      if (!v && sorted.length > 0) {
        console.warn(
          `[verbund-detail] verbuende-Cache-Record für ${verbundId} fehlt — Header aus ${sorted.length} TV(s) abgeleitet (Cache leer/veraltet)`,
        );
      }
      setVerbund(v ?? (sorted.length > 0 ? buildVerbundFromTeilantraege(verbundId, sorted) : null));
      setAntraege(sorted);
      setHistory(h.sort((x, y) => y.geaendert_am.localeCompare(x.geaendert_am)));
      await loadSchemasFor(sorted);
    })();
    return () => { cancelled = true; };
  }, [verbundId, storage.idb, isPseudo]);

  return { verbund, antraege, history, schemas, sourceNames };
}
