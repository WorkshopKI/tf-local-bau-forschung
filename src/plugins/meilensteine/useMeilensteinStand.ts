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
import { useBereich } from '@/core/hooks/useBereich';
import { istImBereich } from '@/core/status/betrachtungsbereich';
import {
  listAllAntraegeListView, listProgramme, listSchemasByProgramm,
} from '@/core/services/csv/idb-csv';
import { verbundWirksamerEingang } from '@/core/services/csv/frist';
import { getAntragstypBucket, type AntragstypBucket } from '@/core/utils/vb-phase-mappings';
import { anzeigeTokensFuer, parseBearbeiterFilter } from '@/plugins/antraege/bearbeiterFilter';
import { kuerzelFormen } from './monitoringLogic';
import {
  freigegebeneFassung, holeProjektion, ladePlan,
  type AbschlussFall, type MeilensteinPlan, type VerbundMeilensteine,
} from '@/core/meilensteine';

/** Bewerteter Verbund plus alles, was die Anzeige zusätzlich braucht. */
export interface VerbundZeile extends VerbundMeilensteine {
  akronym: string;
  titel: string;
  /**
   * Bearbeiter-Kürzel aller Teilvorhaben in der **Vergleichsform** (NFC +
   * uppercase, wie `BearbeiterFilterMode.tokens`) — der Wert, gegen den „nur
   * meine" matcht. Nie zum Anzeigen; dafür steht `kuerzelAnzeige` daneben.
   */
  kuerzel: string[];
  /** Dieselben Kürzel in der Schreibweise der Daten — **nur** zum Anzeigen. */
  kuerzelAnzeige: string[];
}

export interface MeilensteinStandApi {
  laden: boolean;
  fehler: string | null;
  /** Kein freigegebener Plan vorhanden — nichts ist auswertbar. */
  keinPlan: boolean;
  plan: MeilensteinPlan | null;
  zeilen: VerbundZeile[];
  /** Verbünde, die der Betrachtungsbereich wegnimmt (für den Chip). */
  ausgeblendet: number;
  /** Abgeschlossene Vorgänge für die Dauer-Auswertung (aus der Listen-Projektion). */
  abschluesse: AbschlussFall[];
  /**
   * Das eigene Kürzel als Filter-Tokens (Vergleichsform). Leer heißt „kein
   * eigenes Kürzel" — auch bei `alle` im Profil, das app-weit den
   * Übersichts-Modus meint und keinen Namen (`parseBearbeiterFilter`).
   */
  meineTokens: string[];
  /** Dieselben Tokens in der Schreibweise der Daten — nur für Beschriftungen. */
  meineTokensAnzeige: string[];
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
  const bereich = useBereich();

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

  /**
   * verbundId → Anzeige-Daten aus der schlanken Listen-Projektion.
   *
   * Die Kürzel kommen aus **beiden** Bearbeiter-Spalten (`tib_kuerz` +
   * `bib_kuerz`, wie `bearbeiterFilter.ts` sie führt) und werden in der
   * Vergleichsform (NFC + uppercase) abgelegt; die Schreibweise der Daten läuft
   * getrennt mit. Bis v4.118 stand hier nur `tib_kuerz` in roher Schreibweise —
   * gegen ein Profilfeld, das die Einstellungen großgeschrieben ablegen. 81 der
   * 112 Kürzel im Bestand sind gemischt geschrieben und trafen deshalb nie.
   */
  const meta = useMemo(() => {
    const m = new Map<string, {
      akronym: string; titel: string; kuerzel: Set<string>; kuerzelAnzeige: Map<string, string>;
    }>();
    for (const a of listItems) {
      const id = a.verbund_id;
      if (!id) continue;
      const vorhanden = m.get(id)
        ?? { akronym: '', titel: '', kuerzel: new Set<string>(), kuerzelAnzeige: new Map<string, string>() };
      if (!vorhanden.akronym && a.akronym) vorhanden.akronym = a.akronym;
      if (!vorhanden.titel) vorhanden.titel = a.verbund_titel ?? a.titel ?? '';
      for (const roh of [a.tib_kuerz, a.bib_kuerz]) {
        const formen = kuerzelFormen(roh);
        if (!formen) continue;
        vorhanden.kuerzel.add(formen.vergleich);
        if (!vorhanden.kuerzelAnzeige.has(formen.vergleich)) {
          vorhanden.kuerzelAnzeige.set(formen.vergleich, formen.anzeige);
        }
      }
      m.set(id, vorhanden);
    }
    return m;
  }, [listItems]);

  /**
   * Verbünde im Betrachtungsbereich. Der Bereich hängt an der `FM_NUMMER` des
   * Antrags; die Meilenstein-Projektion rechnet je Verbund — die Zuordnung kommt
   * deshalb über die Listen-Projektion, die ohnehin geladen ist.
   */
  const imBereich = useMemo(() => {
    if (bereich.menge === null) return null;
    const ids = new Set<string>();
    for (const a of listItems) {
      if (a.verbund_id && istImBereich(a.unterprogramm_id, bereich.menge)) ids.add(a.verbund_id);
    }
    return ids;
  }, [listItems, bereich.menge]);

  const zeilen = useMemo<VerbundZeile[]>(() => roh.filter(v => imBereich === null || imBereich.has(v.verbundId)).map(v => {
    const m = meta.get(v.verbundId);
    return {
      ...v,
      akronym: m?.akronym || v.verbundId,
      titel: m?.titel ?? '',
      kuerzel: m ? [...m.kuerzel] : [],
      kuerzelAnzeige: m ? [...m.kuerzelAnzeige.values()] : [],
    };
  }), [roh, meta, imBereich]);

  /**
   * Abschlüsse für die Dauer-Auswertung: ein Eintrag je Verbund, Anker ist das
   * späteste Antragsdatum seiner Teilvorhaben (dieselbe Regel wie in der Engine).
   *
   * **Derselbe Betrachtungsbereich wie die offenen Verbünde.** Bis v4.118 lief
   * diese Hälfte über den Vollbestand, während die Übersicht darüber gefiltert
   * war: bei „letzte 3 Richtlinien" standen 2.046 offene Verbünde neben 5.885
   * Abschlüssen, von denen 658 gar nicht zum Arbeitsvorrat gehörten. Der Chip im
   * Seitenkopf sagt „Anzeige: …" und muss dann auch für die Auswertung gelten.
   * Gefiltert wird je Antrag (nicht über die Verbund-Menge oben), weil hier auch
   * Anträge ohne `verbund_id` als Einzelfall zählen.
   */
  const abschluesse = useMemo<AbschlussFall[]>(() => {
    const proVerbund = new Map<string, {
      typ: AntragstypBucket | null;
      antragsdatum: string | null;
      /** Wirksamer Eingang je TV, gesammelt — der Anker ist ihr spätester. */
      eingaenge: { antragsdatum: string | null; alleAntraegeDa: string | null }[];
      abschluss: string | null;
    }>();
    for (const a of listItems) {
      if (bereich.menge !== null && !istImBereich(a.unterprogramm_id, bereich.menge)) continue;
      const id = a.verbund_id || `solo:${a.aktenzeichen}`;
      const vorhanden = proVerbund.get(id) ?? { typ: null, antragsdatum: null, eingaenge: [], abschluss: null };
      if (vorhanden.typ === null) vorhanden.typ = getAntragstypBucket(a.vb_phase);
      const ad = a.antragsdatum?.trim() || null;
      if (ad && (vorhanden.antragsdatum === null || ad > vorhanden.antragsdatum)) vorhanden.antragsdatum = ad;
      // `alle_antraege_da` (= `D_XTE`) führt die Listen-Projektion seit v4.126 —
      // derselbe Wert, den die Frist-Zelle der Tabelle liest.
      vorhanden.eingaenge.push({ antragsdatum: ad, alleAntraegeDa: a.alle_antraege_da?.trim() || null });
      const ab = abschlussDatumVon(a);
      if (ab && (vorhanden.abschluss === null || ab > vorhanden.abschluss)) vorhanden.abschluss = ab;
      proVerbund.set(id, vorhanden);
    }
    return [...proVerbund.entries()]
      .map(([verbundId, v]) => ({
        verbundId, typ: v.typ, antragsdatum: v.antragsdatum,
        anker: verbundWirksamerEingang(v.eingaenge), abschlussDatum: v.abschluss,
      }))
      .filter(f => f.anker !== null && f.abschlussDatum !== null);
  }, [listItems, bereich.menge]);

  /**
   * Das eigene Kürzel über den **app-weiten** Vertrag (`parseBearbeiterFilter`):
   * getrimmt, uppercase, komma-getrennt, und `alle` heißt „kein Kürzel".
   * Vorher verglich dieses Modul roh und zeichengenau — `ATh` traf, `ATH` nicht,
   * `alle` blendete alles aus, und eine Vertretung („ATh, MB") traf nie.
   */
  const kuerzelModus = useMemo(() => parseBearbeiterFilter(meinKuerzel, false), [meinKuerzel]);
  const meineTokens = kuerzelModus.active ? kuerzelModus.tokens : [];
  const meineTokensAnzeige = useMemo(
    () => anzeigeTokensFuer(listItems, meineTokens),
    // `meineTokens` hängt an `kuerzelModus` und ist mit ihm stabil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listItems, kuerzelModus],
  );

  return {
    laden, fehler, keinPlan, plan, zeilen, abschluesse, meineTokens, meineTokensAnzeige,
    stand, neuLaden: laden0,
    ausgeblendet: imBereich === null ? 0 : roh.length - zeilen.length,
  };
}
