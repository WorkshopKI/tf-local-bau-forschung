/**
 * Lädt den bewerteten Meilenstein-Stand aller Programme für die Monitoring-Tabs.
 *
 * Zwei Quellen werden zusammengeführt:
 * - die **Projektion** (`holeProjektion`, offene Verbünde, signaturgeprüft) — der
 *   fachliche Stand,
 * - die schlanke **Listen-Projektion** — Akronym, Titel, Bearbeiter-Kürzel und
 *   Abschlussdaten. Beides steht nicht im Verbund-Record, und die vollen
 *   Antrag-Records dafür zu laden wäre Verschwendung.
 *
 * Ohne freigegebene Plan-Fassung wird gar nichts bewertet — `keinPlan` ist dann
 * gesetzt und die Oberfläche verweist auf die Konfiguration.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import {
  listAllAntraegeListView, listProgramme, listSchemasByProgramm,
} from '@/core/services/csv/idb-csv';
import { getAntragstypBucket, type AntragstypBucket } from '@/core/utils/vb-phase-mappings';
import {
  freigegebeneFassung, holeProjektion, ladePlan,
  type AbschlussFall, type MeilensteinPlan, type VerbundMeilensteine,
} from '@/core/meilensteine';

/** Bewerteter Verbund plus alles, was die Anzeige zusätzlich braucht. */
export interface VerbundZeile extends VerbundMeilensteine {
  akronym: string;
  titel: string;
  /** TIB-Kürzel aller Teilvorhaben (für den „nur meine"-Filter). */
  kuerzel: string[];
}

export interface MeilensteinStandApi {
  laden: boolean;
  fehler: string | null;
  /** Kein freigegebener Plan vorhanden — nichts ist auswertbar. */
  keinPlan: boolean;
  plan: MeilensteinPlan | null;
  zeilen: VerbundZeile[];
  /** Abgeschlossene Vorgänge für die Dauer-Auswertung (aus der Listen-Projektion). */
  abschluesse: AbschlussFall[];
  meinKuerzel: string;
  /** Zeitpunkt der Bewertung — alle Zustände beziehen sich darauf. */
  stand: string;
  neuLaden: () => Promise<void>;
}

/** Ein Verbund gilt als abgeschlossen, sobald ein Abschlussdatum vorliegt. */
function abschlussDatumVon(a: { bewilligung_datum?: string; erstentscheidung?: string }): string | null {
  return a.bewilligung_datum?.trim() || a.erstentscheidung?.trim() || null;
}

export function useMeilensteinStand(): MeilensteinStandApi {
  const idb = useStorage().idb;
  const meinKuerzel = (useMeinKuerzel() ?? '').trim();

  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [plan, setPlan] = useState<MeilensteinPlan | null>(null);
  const [keinPlan, setKeinPlan] = useState(false);
  const [roh, setRoh] = useState<VerbundMeilensteine[]>([]);
  const [listItems, setListItems] = useState<Awaited<ReturnType<typeof listAllAntraegeListView>>>([]);
  const [stand, setStand] = useState(() => new Date().toISOString());

  const laden0 = useCallback(async () => {
    setLaden(true);
    setFehler(null);
    const jetzt = new Date().toISOString();
    try {
      const geladen = await ladePlan(idb);
      const gueltig = freigegebeneFassung(geladen.plan);
      setPlan(gueltig);
      setKeinPlan(gueltig === null);
      setStand(jetzt);

      const items = await listAllAntraegeListView(idb);
      setListItems(items);
      if (!gueltig) {
        setRoh([]);
        return;
      }

      const programme = await listProgramme(idb);
      const proProgramm = await Promise.all(programme.map(async p => {
        const schemas = await listSchemasByProgramm(idb, p.id);
        const projektion = await holeProjektion(idb, p.id, gueltig, schemas, jetzt);
        return projektion.verbuende;
      }));
      setRoh(proProgramm.flat());
    } catch (err) {
      setFehler(err instanceof Error ? err.message : String(err));
    } finally {
      setLaden(false);
    }
  }, [idb]);

  useEffect(() => { void laden0(); }, [laden0]);

  /** verbundId → Anzeige-Daten aus der schlanken Listen-Projektion. */
  const meta = useMemo(() => {
    const m = new Map<string, { akronym: string; titel: string; kuerzel: Set<string> }>();
    for (const a of listItems) {
      const id = a.verbund_id;
      if (!id) continue;
      const vorhanden = m.get(id) ?? { akronym: '', titel: '', kuerzel: new Set<string>() };
      if (!vorhanden.akronym && a.akronym) vorhanden.akronym = a.akronym;
      if (!vorhanden.titel) vorhanden.titel = a.verbund_titel ?? a.titel ?? '';
      const k = a.tib_kuerz?.trim();
      if (k) vorhanden.kuerzel.add(k.normalize('NFC'));
      m.set(id, vorhanden);
    }
    return m;
  }, [listItems]);

  const zeilen = useMemo<VerbundZeile[]>(() => roh.map(v => {
    const m = meta.get(v.verbundId);
    return {
      ...v,
      akronym: m?.akronym || v.verbundId,
      titel: m?.titel ?? '',
      kuerzel: m ? [...m.kuerzel] : [],
    };
  }), [roh, meta]);

  /**
   * Abschlüsse für die Dauer-Auswertung: ein Eintrag je Verbund, Anker ist das
   * späteste Antragsdatum seiner Teilvorhaben (dieselbe Regel wie in der Engine).
   */
  const abschluesse = useMemo<AbschlussFall[]>(() => {
    const proVerbund = new Map<string, { typ: AntragstypBucket | null; anker: string | null; abschluss: string | null }>();
    for (const a of listItems) {
      const id = a.verbund_id || `solo:${a.aktenzeichen}`;
      const vorhanden = proVerbund.get(id) ?? { typ: null, anker: null, abschluss: null };
      if (vorhanden.typ === null) vorhanden.typ = getAntragstypBucket(a.vb_phase);
      const ad = a.antragsdatum?.trim();
      if (ad && (vorhanden.anker === null || ad > vorhanden.anker)) vorhanden.anker = ad;
      const ab = abschlussDatumVon(a);
      if (ab && (vorhanden.abschluss === null || ab > vorhanden.abschluss)) vorhanden.abschluss = ab;
      proVerbund.set(id, vorhanden);
    }
    return [...proVerbund.entries()]
      .filter(([, v]) => v.anker !== null && v.abschluss !== null)
      .map(([verbundId, v]) => ({
        verbundId, typ: v.typ, antragsdatum: v.anker, abschlussDatum: v.abschluss,
      }));
  }, [listItems]);

  return { laden, fehler, keinPlan, plan, zeilen, abschluesse, meinKuerzel, stand, neuLaden: laden0 };
}
