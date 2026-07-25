/**
 * Meilenstein-Stand EINES Verbunds für die Detailseite.
 *
 * Rechnet bewusst direkt statt aus der Projektion zu lesen: die Projektion deckt
 * nur offene Verbünde ab, die Detailseite zeigt aber auch abgeschlossene. Für
 * einen einzelnen Verbund ist die Rechnung ohnehin billig.
 */
import { useCallback, useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { getVerbund, listAntraegeByVerbund, listSchemasByProgramm } from '@/core/services/csv/idb-csv';
import { verbundAntragsdatum } from '@/core/services/csv/frist';
import { isTerminalStatus } from '@/core/utils/status-canonical';
import { getAntragstypBucket } from '@/core/utils/vb-phase-mappings';
import {
  baueMeilensteinKontext, benoetigteFelder, bewerteVerbund, ergaenzeRisiko, erledigeRisiko,
  freigegebeneFassung, ladePlan, leseEigeneRisiken, loeseFelderAuf, offeneRisiken,
  schreibeEigeneRisiken,
  type MeilensteinPlan, type MeilensteinRisiko, type VerbundMeilensteine,
} from '@/core/meilensteine';
import { uuid } from '@/core/services/id-generator';

export interface VerbundMeilensteinApi {
  laden: boolean;
  plan: MeilensteinPlan | null;
  bewertung: VerbundMeilensteine | null;
  /** Offene Risiko-Meldungen dieses Verbunds, je Meilenstein höchstens eine. */
  risiken: Map<string, MeilensteinRisiko>;
  /** Konnte die letzte Meldung in den persönlichen Ordner geschrieben werden? */
  nurLokal: boolean;
  melden: (knotenId: string, text: string, verzoegerungTage?: number) => Promise<void>;
  erledigen: (id: string) => Promise<void>;
}

export function useVerbundMeilensteine(verbundId: string): VerbundMeilensteinApi {
  const idb = useStorage().idb;
  const kuerzel = (useMeinKuerzel() ?? '').trim();

  const [laden, setLaden] = useState(true);
  const [plan, setPlan] = useState<MeilensteinPlan | null>(null);
  const [bewertung, setBewertung] = useState<VerbundMeilensteine | null>(null);
  const [alleRisiken, setAlleRisiken] = useState<MeilensteinRisiko[]>([]);
  const [nurLokal, setNurLokal] = useState(false);

  useEffect(() => {
    let abgebrochen = false;
    setLaden(true);
    void (async () => {
      try {
        const geladen = await ladePlan(idb);
        const gueltig = freigegebeneFassung(geladen.plan);
        const [verbund, antraege, risiken] = await Promise.all([
          getVerbund(idb, verbundId),
          listAntraegeByVerbund(idb, verbundId),
          leseEigeneRisiken(idb).catch(() => [] as MeilensteinRisiko[]),
        ]);
        if (abgebrochen) return;
        setAlleRisiken(risiken);
        setPlan(gueltig);
        if (!gueltig || antraege.length === 0) {
          setBewertung(null);
          return;
        }

        const programmId = antraege[0]?.programm_id ?? verbund?.programm_id ?? '';
        const schemas = programmId ? await listSchemasByProgramm(idb, programmId) : [];
        if (abgebrochen) return;

        const aufloesung = loeseFelderAuf(schemas, benoetigteFelder(gueltig));
        const records = antraege.map(a => ({
          aktenzeichen: a.aktenzeichen,
          record: a as unknown as Record<string, unknown>,
        }));
        setBewertung(bewerteVerbund(gueltig, {
          verbundId,
          antragsdatum: verbundAntragsdatum(antraege),
          typ: getAntragstypBucket(antraege[0]?.vb_phase),
          kontext: baueMeilensteinKontext(
            aufloesung, (verbund ?? {}) as unknown as Record<string, unknown>, records,
          ),
          terminal: isTerminalStatus(verbund?.status ?? antraege[0]?.status),
        }, new Date().toISOString()));
      } catch {
        if (!abgebrochen) { setPlan(null); setBewertung(null); }
      } finally {
        if (!abgebrochen) setLaden(false);
      }
    })();
    return () => { abgebrochen = true; };
  }, [idb, verbundId]);

  const speichern = useCallback(async (naechste: MeilensteinRisiko[]) => {
    setAlleRisiken(naechste);
    const ergebnis = await schreibeEigeneRisiken(idb, kuerzel, naechste, new Date().toISOString());
    setNurLokal(!ergebnis.imOrdner);
  }, [idb, kuerzel]);

  return {
    laden,
    plan,
    bewertung,
    risiken: offeneRisiken(alleRisiken.filter(r => r.verbundId === verbundId)),
    nurLokal,

    melden: async (knotenId, text, verzoegerungTage) => {
      const neu: MeilensteinRisiko = {
        id: uuid(),
        verbundId,
        knotenId,
        kuerzel,
        text: text.trim(),
        ...(verzoegerungTage !== undefined ? { erwarteteVerzoegerungTage: verzoegerungTage } : {}),
        gemeldetAm: new Date().toISOString(),
      };
      await speichern(ergaenzeRisiko(alleRisiken, neu));
    },

    erledigen: async id => { await speichern(erledigeRisiko(alleRisiken, id)); },
  };
}
