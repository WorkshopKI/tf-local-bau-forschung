/**
 * Zustand + IO des Meilenstein-Plans für die Konfigurations-Oberfläche.
 *
 * Ein Entwurf lebt im Speicher, bis die PL ihn bewusst speichert — genau wie im
 * Status-Cockpit. Der Unterschied: hier geht die Fassung auf den Daten-Share und
 * gilt danach für das ganze Team, deshalb sind Speichern und Freigeben zwei
 * getrennte Schritte.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { useProfile } from '@/core/hooks/useProfile';
import { canWriteDatenShare } from '@/config/feature-flags';
import { listProgramme, listSchemasByProgramm } from '@/core/services/csv/idb-csv';
import type { CsvSchema } from '@/core/services/csv/types';
import {
  baueSpaltenKatalog, freigeben, ladePlan, neueFassung, schreibePlanAufShare,
  uebernimmFassung, zurueckInEntwurf,
  type MeilensteinKnoten, type MeilensteinPlan, type SpaltenEintrag,
} from '@/core/meilensteine';

export interface MeilensteinPlanApi {
  laden: boolean;
  fehler: string | null;
  /** Zuletzt gespeicherter Stand (Share/Cache/Seed). */
  gespeichert: MeilensteinPlan | null;
  /** Arbeitskopie. */
  entwurf: MeilensteinPlan | null;
  /** Der gespeicherte Stand kommt aus dem lokalen Cache (Share nicht erreichbar). */
  stale: boolean;
  /** Noch nie jemand gepflegt — der Auslieferungs-Plan ist in Arbeit. */
  ausSeed: boolean;
  geaendert: boolean;
  /** Darf dieser Build/Nutzer den Team-Plan schreiben? */
  darfSchreiben: boolean;
  /** Alle in den Programm-Schemas gemappten Spalten (Auswahl im Editor). */
  spalten: SpaltenEintrag[];
  schemas: CsvSchema[];

  setKnoten: (knoten: MeilensteinKnoten[]) => void;
  setGesamtfrist: (tage: number) => void;
  verwerfen: () => void;
  speichern: (kommentar?: string) => Promise<void>;
  freigebenJetzt: (kommentar?: string) => Promise<void>;
  zurueckziehen: (kommentar?: string) => Promise<void>;
  fassungUebernehmen: (version: number) => void;
  neuLaden: () => Promise<void>;
}

export function useMeilensteinPlan(): MeilensteinPlanApi {
  const idb = useStorage().idb;
  const kuerzel = useMeinKuerzel();
  const { profile } = useProfile();
  const isKurator = profile?.is_kurator === true || profile?.is_admin === true;

  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState<MeilensteinPlan | null>(null);
  const [entwurf, setEntwurf] = useState<MeilensteinPlan | null>(null);
  const [stale, setStale] = useState(false);
  const [ausSeed, setAusSeed] = useState(false);
  const [schemas, setSchemas] = useState<CsvSchema[]>([]);

  const laden0 = useCallback(async () => {
    setLaden(true);
    setFehler(null);
    try {
      // Der Spalten-Vorrat des Editors soll ALLE Programme abdecken — ein
      // Meilenstein kann auf eine Spalte zeigen, die nur ein Programm mappt.
      const [geladen, programme] = await Promise.all([ladePlan(idb), listProgramme(idb)]);
      const proProgramm = await Promise.all(
        programme.map(p => listSchemasByProgramm(idb, p.id)),
      );
      const alleSchemas = proProgramm.flat();
      setGespeichert(geladen.plan);
      setEntwurf(geladen.plan);
      setStale(geladen.stale);
      setAusSeed(geladen.quelle === 'seed');
      setSchemas(alleSchemas);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : String(err));
    } finally {
      setLaden(false);
    }
  }, [idb]);

  useEffect(() => { void laden0(); }, [laden0]);

  const spalten = useMemo(() => baueSpaltenKatalog(schemas), [schemas]);

  const geaendert = useMemo(() => {
    if (!gespeichert || !entwurf) return false;
    return JSON.stringify(entwurf.knoten) !== JSON.stringify(gespeichert.knoten)
      || entwurf.gesamtfristTage !== gespeichert.gesamtfristTage;
  }, [gespeichert, entwurf]);

  /** Eine Fassung schreiben und beide Stände nachziehen. Wirft bei Ablehnung —
   *  der Aufrufer (useAsyncAction) zeigt die Meldung. */
  const schreibe = useCallback(async (naechster: MeilensteinPlan) => {
    const ok = await schreibePlanAufShare(idb, naechster);
    if (!ok) {
      throw new Error(
        'Der Plan konnte nicht auf den Daten-Share geschrieben werden. '
        + 'Fehlt die Schreibberechtigung oder ist der Share nicht verbunden?',
      );
    }
    setGespeichert(naechster);
    setEntwurf(naechster);
    setStale(false);
    setAusSeed(false);
  }, [idb]);

  return {
    laden, fehler, gespeichert, entwurf, stale, ausSeed, geaendert,
    darfSchreiben: canWriteDatenShare(isKurator),
    spalten, schemas,

    setKnoten: knoten => setEntwurf(p => (p ? { ...p, knoten } : p)),
    setGesamtfrist: tage => setEntwurf(p => (p ? { ...p, gesamtfristTage: tage } : p)),
    verwerfen: () => setEntwurf(gespeichert),

    speichern: async (kommentar?: string) => {
      if (!gespeichert || !entwurf) return;
      await schreibe(neueFassung(gespeichert, {
        knoten: entwurf.knoten,
        gesamtfristTage: entwurf.gesamtfristTage,
        autor: kuerzel || null,
        ...(kommentar ? { kommentar } : {}),
        jetzt: new Date().toISOString(),
      }));
    },

    freigebenJetzt: async (kommentar?: string) => {
      if (!gespeichert) return;
      await schreibe(freigeben(gespeichert, kuerzel || null, new Date().toISOString(), kommentar));
    },

    zurueckziehen: async (kommentar?: string) => {
      if (!gespeichert) return;
      await schreibe(zurueckInEntwurf(gespeichert, kuerzel || null, new Date().toISOString(), kommentar));
    },

    fassungUebernehmen: version => {
      if (!gespeichert) return;
      const uebernommen = uebernimmFassung(gespeichert, version, kuerzel || null, new Date().toISOString());
      setEntwurf({ ...uebernommen, historie: gespeichert.historie });
    },

    neuLaden: laden0,
  };
}
