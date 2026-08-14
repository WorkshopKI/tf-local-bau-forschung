/**
 * Geteilter Lade-Hook der QS-Freigaben (offene Artefakt-Entwürfe).
 *
 * Kapselt den IDB-Bulk-Read (`workflow-run:` + Legacy `gutachten-workflow:`) plus
 * den Anträge-/Verbund-Join inkl. Bearbeiter-Filter und liefert die fertigen
 * `QsFreigabeZeile[]` (reine Transformation in qsFreigaben.ts). GEMEINSAME Quelle
 * für das `QsFreigabenWidget` (Hauptspalte) UND den Hero-Alert-Chip „QS-Freigaben
 * offen" (HomeHero) — so kann die Zahl nicht driften.
 *
 * `aktiv=false` überspringt den Bulk-Read (Lazy: das Widget lädt erst ausgeklappt).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useBearbeiterSicht } from '@/core/hooks/useBearbeiterSicht';
import { useAntraegeStore } from '@/plugins/antraege/store';
import {
  antragMatchesBearbeiter,
  type BearbeiterFilterMode,
} from '@/plugins/antraege/bearbeiterFilter';
import type { AntragListItem } from '@/core/services/csv/types';
import type { WorkflowRun } from '@/plugins/antraege/gutachten/types';
import {
  baueQsFreigabenZeilen,
  type QsFreigabeZeile,
  type QsRunEintrag,
  type QsScopeInfo,
} from './qsFreigaben';

const RUN_PREFIX = 'workflow-run:';
const LEGACY_PREFIX = 'gutachten-workflow:';

export interface QsFreigabenDaten {
  zeilen: QsFreigabeZeile[];
  /** Bearbeiter-Modus (für „Kürzel THÜ"-Scope-Label). */
  mode: BearbeiterFilterMode;
}

export function useQsFreigaben(aktiv: boolean): QsFreigabenDaten {
  const storage = useStorage();
  // Kürzel + Meine/Alle-Sicht (der Umschalter im Seitenkopf wirkt hier mit).
  const { mode } = useBearbeiterSicht();
  const antraege = useAntraegeStore(s => s.antraege);
  const verbundById = useAntraegeStore(s => s.verbundById);

  const [runs, setRuns] = useState<QsRunEintrag[]>([]);
  useEffect(() => {
    if (!aktiv) return;
    let cancelled = false;
    void (async () => {
      const eintraege: QsRunEintrag[] = [];
      const gesehen = new Set<string>();
      for (const [key, value] of await storage.idb.entries(RUN_PREFIX)) {
        const rest = key.slice(RUN_PREFIX.length);
        const sep = rest.indexOf(':');
        if (sep < 0) continue;
        const typ = rest.slice(0, sep);
        const scopeId = rest.slice(sep + 1);
        gesehen.add(`${typ}:${scopeId}`);
        eintraege.push({ typ, scopeId, run: value as WorkflowRun });
      }
      // Legacy-GA-Runs (noch nicht promoted) mitlesen — außer schon als workflow-run:ga vorhanden.
      for (const [key, value] of await storage.idb.entries(LEGACY_PREFIX)) {
        const scopeId = key.slice(LEGACY_PREFIX.length);
        if (gesehen.has(`ga:${scopeId}`)) continue;
        eintraege.push({ typ: 'ga', scopeId, run: value as WorkflowRun });
      }
      if (!cancelled) setRuns(eintraege);
    })();
    return () => { cancelled = true; };
  }, [aktiv, storage.idb]);

  const scopeIndex = useMemo(() => {
    const byAz = new Map<string, AntragListItem>();
    const byVb = new Map<string, AntragListItem[]>();
    for (const a of antraege) {
      byAz.set(a.aktenzeichen, a);
      const vb = a.verbund_id?.trim();
      if (vb) { const arr = byVb.get(vb); if (arr) arr.push(a); else byVb.set(vb, [a]); }
    }
    return { byAz, byVb };
  }, [antraege]);

  const scopeInfo = useCallback((scopeId: string): QsScopeInfo => {
    const gruppe = scopeIndex.byVb.get(scopeId) ?? (scopeIndex.byAz.has(scopeId) ? [scopeIndex.byAz.get(scopeId)!] : []);
    const verbund = verbundById.get(scopeId);
    const rep = gruppe[0];
    return {
      akronym: verbund?.akronym ?? rep?.akronym,
      titel: verbund?.titel ?? rep?.titel,
      sichtbar: !mode.active || gruppe.some(a => antragMatchesBearbeiter(a, mode)),
    };
  }, [scopeIndex, verbundById, mode]);

  const zeilen = useMemo(
    () => (aktiv ? baueQsFreigabenZeilen(runs, scopeInfo, Date.now()) : []),
    [aktiv, runs, scopeInfo],
  );

  return { zeilen, mode };
}
