/**
 * State-/IO-Schicht der Aufbereitungs-Seite: lädt den (deterministischen) Run,
 * bietet „Neu aufbereiten" (via `useAsyncAction` → Fehlerbanner) und den
 * Offene-Punkte-Toggle, prüft best-effort auf veraltete Quellen, und orchestriert
 * die LLM-Bausteine (Paket 2) — sequentiell, tolerant, ohne den deterministischen
 * Teil je zu blockieren.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { kiVerbindungGeprueft } from '@/core/services/ai/ki-guard';
import { useAsyncAction, type UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { hashText } from '@/plugins/antraege/gutachten/runner';
import {
  loadSkillRegistry,
  AUFBEREITUNG_RECHERCHE_IMPORT_SKILL,
} from '@/core/services/skills';
import { DocConverter } from '@/core/services/converter';
import { resolveKorpus, resolveAnlage5, resolveAnlagenProTv, misseKorpus, type KorpusMass } from './quellen';
import { getVbCharCap } from '@/core/services/ai/llm-context';
import { bestimmeLaufZiel, type LaufZiel } from './lauf-ziel';
import { parseVbGliederung } from './gliederung';
import {
  aufbereitungKey, computeAufbereitung, loadAufbereitung, istVeraltet, toggleOffenerPunkt, toggleErledigterPunkt,
  type AufbereitungContext,
} from './store';
import { istAufbereitungBausteinFreigeschaltet, vbHashFuer } from './bausteine';
import {
  BAUSTEIN_IDS, BAUSTEIN_KATALOG, loescheBausteinCaches,
  type AufbereitungBausteinId, type BausteinLaufDeps,
} from './baustein-katalog';
import {
  FEHLT, alsFelder, fuelleAusCache, initialerZustand, setzeAlleUi, setzeSkill, setzeUi,
  type BausteinUiState,
} from './baustein-zustand';
import { leseGecachteBausteine } from './baustein-rehydrierung';
import { ladeEinreichungsBezug, type EinreichungsBezug } from './map-verknuepfung';
import type { AspektMapping } from './aspekte';
import type { SteckbriefDaten } from './steckbrief';
import type { ZahlenDaten } from './zahlen';
import type { GlossarDaten } from './glossar';
import type { VerwertungDaten } from './verwertung';
import {
  normalisiereAuftragstext, parseRecherchePrompt, pruefeBearbeitetenPrompt,
  recherchePromptCacheKey, recherchePromptBearbeitetKey, leseBearbeitetenRecherchePrompt,
  type RecherchePromptDaten,
} from './recherche-prompt';
import { baueDeepResearchAuftrag } from './recherche-auftrag';
import {
  LEERE_STICHWORTE, STICHWORTE_SCHEMA_VERSION, type RechercheStichworte,
} from './recherche-stichworte';
import { strukturiereImport } from './recherche-import';
import type { AufbereitungRun, ExterneRecherche } from './types';

// Der Baustein-Zustandstyp lebt seit dem Konsolidierungs-Pass in `baustein-zustand.ts`
// (zusammen mit den reinen Übergängen). Hier bleibt er als Re-Export: er ist Teil der
// öffentlichen Oberfläche dieses Hooks, und alle Tabs importieren ihn von hier.
export type { BausteinUiStatus, BausteinUiState } from './baustein-zustand';

export interface UseAufbereitungResult {
  run: AufbereitungRun | null;
  loading: boolean;
  veraltet: boolean;
  neu: UseAsyncActionResult<[]>;
  /** Coalesced „nach Dokument-Upload neu aufbereiten" (verkraftet nebenläufige Multi-File-Ingests). */
  requestRecompute: () => void;
  toggle: UseAsyncActionResult<[string]>;
  /** „Erledigt"-Achse des Fragen-Tabs (getrennt von `toggle`/`offenePunkte`). */
  toggleErledigt: UseAsyncActionResult<[string]>;
  /** Stempelt „Marktzugang-Template kopiert" auf den Run (Paket 5, best-effort — nur wenn ein Run existiert). */
  markiereMarktzugangKopiert: UseAsyncActionResult<[]>;
  /** Externen DR-Text importieren (JSON-Block direkt → interner Lauf → Rohtext). */
  importTextRecherche: UseAsyncActionResult<[string, string?]>;
  /** Externe DR-Dateien (PDF/Word/Markdown/Text) importieren — Text-Extraktion via
   *  DocConverter, dann wie Text; je Datei ein Eintrag, ein gemeinsamer Write. */
  importDateiRecherche: UseAsyncActionResult<[File[], ((fertig: number, gesamt: number) => void)?]>;
  /** Einen externen Import wieder entfernen (Index in `run.extern`). */
  loescheExternRecherche: UseAsyncActionResult<[number]>;
  /** Aspekt-Mapping-Baustein (Paket 2). */
  aspekte: BausteinUiState<AspektMapping>;
  /** Steckbrief-Baustein (Paket 2). */
  steckbrief: BausteinUiState<SteckbriefDaten>;
  /** Zahlen-Inventar-Baustein (Paket 4). */
  zahlen: BausteinUiState<ZahlenDaten>;
  /** Glossar-Baustein (v2.219). */
  glossar: BausteinUiState<GlossarDaten>;
  /** Verwertung/Markt-Baustein (Stufe 2) — läuft über den Korpus (dokumentgrenzen-unabhängig). */
  verwertung: BausteinUiState<VerwertungDaten>;
  /** Deep-Research-Prompt-Baustein (Paket 5) — läuft ZUERST; agentische Variante + Leak-Check. */
  recherchePrompt: BausteinUiState<RecherchePromptDaten>;
  /** Übernimmt einen von Hand bearbeiteten DR-Auftragstext (erneuter Leak-Check, siehe unten). */
  speichereRecherchePrompt: UseAsyncActionResult<[string]>;
  /** Übernimmt geänderte Stichworte und baut den Auftrag aus der Vorlage neu. */
  speichereRechercheStichworte: UseAsyncActionResult<[RechercheStichworte]>;
  /** Stellt die ursprüngliche KI-Fassung des DR-Auftrags wieder her (nur nach einer Bearbeitung). */
  verwerfeRecherchePromptEdit: UseAsyncActionResult<[]>;
  /** Korpus-Volltext (VB + narrative Zusatzdokumente) für Fundstellen-Auszüge +
   *  Lesemodus — gesetzt, sobald ein Baustein-Lauf den Korpus auflöst. Heißt aus
   *  Kompatibilität weiter `vbMarkdown` (Prop-Name in allen Tabs). */
  vbMarkdown: string | null;
  /** Umfang des Korpus gegen das Kontextfenster DER GERADE GEWÄHLTEN KI
   *  (`laufZiel.cap`, nicht die globale KI-Variante). `ueberCap` heisst: ein
   *  NEUER Lauf sähe das Ende des Textes nicht. Über bereits GECACHTE Ergebnisse
   *  sagt es nichts — der Cache-Eintrag trägt sein Ziel nicht, und der
   *  Notausfahrt-Schalter ist Sitzungszustand (siehe `QuellenPanel`). */
  korpusMass: KorpusMass | null;
  /**
   * Zum Vorgang gefundene MAP-Einreichung (über die zugeordnete VB-Datei) samt dem
   * daraus abgeleiteten Projektplan — `null`, solange keine Einreichungs-JSON
   * hinterlegt ist. Hebt allein die Zeitplan-Pause auf (`pausierte-module.ts`).
   */
  einreichungsBezug: EinreichungsBezug | null;
  /** Auf welcher internen KI die Bausteine laufen + ob die Notausfahrt anzubieten ist. */
  laufZiel: LaufZiel;
  /** Notausfahrt für DIESEN Antrag (Sitzung, nicht persistiert) — agentische KI wegen
   *  eines Korpus, der nicht ins Standard-Kontextfenster passt. */
  setzeAgentischErzwungen: (an: boolean) => void;
  /** Läuft alle Bausteine sequentiell (Recherche-Prompt → Aspekte → Steckbrief → Zahlen → Glossar → Verwertung). */
  bausteine: UseAsyncActionResult<[]>;
  /** Verwirft die Baustein-Caches und rechnet neu (dev-Aktion „KI-Bausteine neu berechnen"). */
  bausteineNeu: UseAsyncActionResult<[]>;
}

/**
 * Ohne aufgelösten Antrag brachen die drei Aufbereitungs-Aktionen wortlos ab
 * (`if (!ctx) return`) — für den Nutzer ein Knopf, der nichts tut, ohne Ladezustand
 * und ohne Meldung. Jetzt wird geworfen: `useAsyncAction` macht daraus einen
 * sichtbaren Fehler (Pitfall #15). Die Seite blendet die Knöpfe in diesem Zustand
 * ohnehin aus (`kontext-zustand.ts`) — das hier ist die zweite Verteidigungslinie.
 */
const KEIN_KONTEXT = 'Der Antrag ist noch nicht geladen — bitte „Erneut versuchen" oder die Seite neu laden.';

export function useAufbereitung(ctx: AufbereitungContext | null): UseAufbereitungResult {
  const storage = useStorage();
  const bridge = useAIBridge();
  const [run, setRun] = useState<AufbereitungRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [veraltet, setVeraltet] = useState(false);
  // EINE Karte statt zwölf `useState`: je Baustein der aufgelöste Skill + der
  // UI-Zustand seines letzten Laufs. Welche Bausteine es gibt, sagt `BAUSTEIN_KATALOG`;
  // die reinen Übergänge liegen in `baustein-zustand.ts`.
  const [bausteinZustand, setBausteinZustand] = useState(initialerZustand);
  // Ein laufender Lauf schreibt nacheinander in mehrere Bausteine. Über den
  // funktionalen Updater sieht jeder Schritt den frischen Stand — sonst überschriebe
  // der zweite Baustein den ersten mit einem veralteten Closure-Wert.
  const setzeBaustein = useCallback((id: AufbereitungBausteinId, ui: BausteinUiState<unknown>): void => {
    setBausteinZustand(vorher => setzeUi(vorher, id, ui));
  }, []);
  // Spiegel des Zustands für die Lauf-Kette: die läuft minutenlang sequentiell, und der
  // Registry-Effekt kann den Skill eines noch nicht gestarteten Bausteins zwischendurch
  // nachziehen. Aus der Closure gelesen wäre er dann veraltet.
  const bausteinZustandRef = useRef(bausteinZustand);
  bausteinZustandRef.current = bausteinZustand;
  const { aspekte, steckbrief, zahlen, glossar, verwertung, recherchePrompt } = alsFelder(bausteinZustand);
  const [vbMarkdown, setVbMarkdown] = useState<string | null>(null);
  const [einreichungsBezug, setEinreichungsBezug] = useState<EinreichungsBezug | null>(null);
  const [agentischErzwungen, setzeAgentischErzwungen] = useState(false);
  const key = ctx?.key ?? null;

  // Ziel-KI der Bausteine: fest die Standard-KI, es sei denn der Prüfer hat wegen eines
  // zu grossen Korpus die agentische Notausfahrt gewählt (`lauf-ziel.ts`). Die globale
  // KI-Variante (`useKiZiel`) gilt hier bewusst NICHT.
  const bridgeAktiv = bridge.istBridgeAktiv();
  const laufZiel = useMemo(() => bestimmeLaufZiel({
    zeichen: vbMarkdown?.length ?? null,
    standardCap: getVbCharCap({ bridge: bridgeAktiv, ziel: 'standard' }),
    agentischCap: getVbCharCap({ bridge: bridgeAktiv, ziel: 'agentisch' }),
    agentischErzwungen,
  }), [vbMarkdown, bridgeAktiv, agentischErzwungen]);

  // Gemessen, NICHT gekürzt: `runBaustein` umgeht `runSkill` und damit `capVbMarkdown`,
  // und der Upload-Check prüft nur je Datei. Ohne diese Messung liefe ein zu grosser
  // Korpus stillschweigend abgeschnitten ins Modell. Abgeleitet statt gespeichert, damit
  // die Warnung dem Ziel-Wechsel (Notausfahrt) sofort folgt.
  const korpusMass = useMemo<KorpusMass | null>(
    () => (vbMarkdown === null ? null : misseKorpus(vbMarkdown, laufZiel.cap)),
    [vbMarkdown, laufZiel.cap],
  );

  // Gespeicherten Run laden (bei Kontext-Wechsel neu) — Baustein-Status zurücksetzen.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setBausteinZustand(vorher => setzeAlleUi(vorher, FEHLT));
    setVbMarkdown(null);
    setzeAgentischErzwungen(false); // Notausfahrt gilt je Antrag, nicht global.
    (async () => {
      if (!key) { setRun(null); setLoading(false); return; }
      const r = await loadAufbereitung(storage.idb, key);
      if (!cancelled) { setRun(r); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [key, storage.idb]);

  // Baustein-Skills aus der Registry laden (Fallback: Seeds).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadSkillRegistry(storage);
        if (cancelled) return;
        setBausteinZustand(vorher => BAUSTEIN_IDS.reduce((z, id) => {
          const eintrag = BAUSTEIN_KATALOG[id];
          const geladen = loaded.file.skills.find(x => x.id === eintrag.skillId);
          return geladen ? setzeSkill(z, id, geladen) : z; // ohne Treffer bleibt der Seed
        }, vorher));
      } catch { /* Seed-Fallback bleibt gesetzt. */ }
    })();
    return () => { cancelled = true; };
  }, [storage]);

  /**
   * Holt bereits berechnete Bausteine aus dem kv zurueck — ohne Transport, ohne
   * LLM-Lauf. Der Baustein-Cache IST die Persistenz der KI-Anteile; ohne diesen
   * Rueckweg waeren die Ergebnisse nach jedem Seitenwechsel unsichtbar, obwohl sie
   * im Store liegen.
   *
   * Gefuellt werden ausschliesslich LEERE Slots (`status: 'fehlt'`): ein laufender
   * oder bereits fertiger Baustein wird nie ueberschrieben, auch wenn die
   * Leseantwort spaeter eintrifft. Ein Miss ist ein No-op — diese Funktion loescht
   * nie, sonst risse ein Zwischenstand frische Ergebnisse mit.
   */
  const rehydriereBausteine = async (
    antragKey: string, korpusMarkdown: string, abgebrochen: () => boolean,
  ): Promise<void> => {
    const gecacht = await leseGecachteBausteine(storage.idb, antragKey, vbHashFuer(korpusMarkdown));
    // Der VON HAND geprüfte Recherche-Auftrag überlebt den Korpus-Wechsel. Er
    // steht im hash-gekeyten Cache wie ein LLM-Ergebnis — für ein solches ist
    // das richtig (anderer Text = anderes Ergebnis), für eine Fassung, die der
    // Prüfer Zeile für Zeile abgenommen hat, nicht: nach dem nächsten
    // Dokument-Upload stand der Recherche-Tab wieder im Leerzustand, und auch
    // „Zurück zum KI-Text" kam nicht mehr heran, weil `bearbeitet.kiOriginal`
    // im selben verwaisten Eintrag steckte (v4.124). Derselbe Schutz, den
    // `uebernehmeExterneRecherchen` den importierten DR-Ergebnissen gibt.
    if (!gecacht.recherchePrompt) {
      const bearbeitet = await leseBearbeitetenRecherchePrompt(storage.idb, antragKey);
      if (bearbeitet) gecacht.recherchePrompt = bearbeitet;
    }
    if (abgebrochen()) return;
    setBausteinZustand(vorher => fuelleAusCache(vorher, gecacht));
  };

  // Korpus-abhaengige Arbeit beim Oeffnen: Korpus-Text setzen (daraus leitet sich die
  // Cap-Messung ab), Rehydrierung der Bausteine und die best-effort Veraltet-Pruefung.
  // Bewusst EIN Effekt — er loest den Korpus einmal auf, und alle drei brauchen genau
  // diesen Korpus.
  //
  // Die Deps sind SKALAR und bewusst nicht `ctx`: der Aufrufer (`AufbereitungPage`)
  // baut das Kontext-Objekt pro Render neu. Mit `ctx` in den Deps trieb sich dieser
  // Effekt endlos selbst an — Render → neues `ctx` → Effekt → voller Dokument-Scan.
  // `key`/`knownIdsKey`/`tvKey` decken alles ab, was der Effekt aus `ctx` liest.
  const knownIdsKey = (ctx?.knownIds ?? []).join('|');
  const tvKey = (ctx?.teilvorhaben ?? []).map(t => t.tvAz).join('|');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ctx || !run) { setVeraltet(false); return; }
      try {
        const korpus = await resolveKorpus(storage.idb, ctx);
        // Schon beim Oeffnen, nicht erst in `laufBausteine`: wer einen bereits
        // aufbereiteten Antrag oeffnet, muss sehen, dass die gecachten Bausteine
        // ueber einem abgeschnittenen Text entstanden sind (`korpusMass` haengt am
        // Korpus-Text).
        if (korpus && !cancelled) {
          // Der Korpus traegt Lesemodus + Fundstellen-Auszuege — unabhaengig davon,
          // ob je ein Baustein lief.
          setVbMarkdown(korpus.markdown);
          await rehydriereBausteine(ctx.key, korpus.markdown, () => cancelled);
        }
        const tvs = ctx.teilvorhaben ?? [];
        let anlage5Hash: string | undefined;
        let anlage5Hashes: string[] | undefined;
        if (tvs.length >= 2) {
          const { proTv } = await resolveAnlagenProTv(storage.idb, ctx.key, tvs.map(t => t.tvAz));
          anlage5Hashes = [...proTv.values()].map(a => hashText(a.markdown));
        } else {
          const anlageA = await resolveAnlage5(storage.idb, ctx).catch(() => null);
          anlage5Hash = anlageA ? hashText(anlageA.markdown) : undefined;
        }
        const aktuell = {
          vbHash: korpus ? hashText(korpus.vb.markdown) : undefined,
          anlage5Hash,
          anlage5Hashes,
          verwertungHashes: korpus ? korpus.narrative.map(n => hashText(n.markdown)) : [],
        };
        if (!cancelled) setVeraltet(istVeraltet(run, aktuell));
      } catch { /* Veraltet-Hinweis ist optional — Fehler still schlucken. */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- skalare Anker statt `ctx` (siehe oben)
  }, [key, knownIdsKey, tvKey, run, storage.idb]);

  // Einreichungs-Bezug (MAP) — eigener Effekt, weil er weder am `run` noch an den
  // Teilvorhaben hängt: er sucht nur die Einreichung, der DIESELBE VB-Datei zugeordnet
  // ist. Schlägt er fehl, bleibt der Zeitplan pausiert — kein sichtbarer Fehler, weil
  // „keine Einreichung hinterlegt" der Normalfall ist.
  useEffect(() => {
    let cancelled = false;
    setEinreichungsBezug(null);
    (async () => {
      if (!key) return;
      const bezug = await ladeEinreichungsBezug(storage.idb, { key, knownIds: knownIdsKey ? knownIdsKey.split('|') : [] })
        .catch(() => null);
      if (!cancelled) setEinreichungsBezug(bezug);
    })();
    return () => { cancelled = true; };
  }, [key, knownIdsKey, storage.idb]);

  const neu = useAsyncAction(async () => {
    if (!ctx) throw new Error(KEIN_KONTEXT);
    const r = await computeAufbereitung(storage.idb, ctx);
    setRun(r);
    setVeraltet(false);
    // Neuer deterministischer Stand → alle Bausteine erneut anfordern. Die importierten
    // externen Recherchen bleiben davon unberührt: sie hängen am Run (`run.extern`,
    // `uebernehmeExterneRecherchen` in store.ts), nicht am Baustein-Zustand — die Lehre
    // aus v2.301.1, dass ein „Neu aufbereiten" einen externen Lauf nicht wegwerfen darf.
    setBausteinZustand(vorher => setzeAlleUi(vorher, FEHLT));
  });

  // Nach einem Dokument-Upload neu aufbereiten. Mehrere Dateien feuern `onIngested`
  // nebenläufig, `useAsyncAction.run()` verwirft aber Aufrufe während `busy` — daher
  // ausstehende Anfragen bündeln und nach Abschluss EINMAL nachziehen (die letzte
  // gewinnt, weil `computeAufbereitung` den IDB-Stand frisch liest).
  const pendingRecomputeRef = useRef(false);
  const requestRecompute = useCallback(() => {
    if (neu.busy) { pendingRecomputeRef.current = true; return; }
    void neu.run();
  }, [neu.busy, neu.run]);
  useEffect(() => {
    if (!neu.busy && pendingRecomputeRef.current) {
      pendingRecomputeRef.current = false;
      void neu.run();
    }
  }, [neu.busy, neu.run]);

  /**
   * Fährt EINEN Baustein-Lauf, fängt ALLES intern und bildet es auf den
   * Baustein-Status ab (getTransportForSkillRun kann bei externem Provider werfen).
   * Der deterministische Teil bleibt unberührt; nie throw. Setzt zuvor `laeuft`.
   */
  const laufEinen = async (
    id: AufbereitungBausteinId,
    deps: Omit<BausteinLaufDeps, 'transport' | 'skill'>,
  ): Promise<void> => {
    const skill = bausteinZustandRef.current[id].skill;
    if (!istAufbereitungBausteinFreigeschaltet(skill)) {
      setzeBaustein(id, { status: 'fehler', begruendung: 'Dieser KI-Abschnitt ist in dieser Build-Variante nicht freigeschaltet.' });
      return;
    }
    setzeBaustein(id, { status: 'laeuft' });
    try {
      const transport = bridge.getTransportForSkillRun(skill);
      const res = await BAUSTEIN_KATALOG[id].lauf({ ...deps, transport, skill } as BausteinLaufDeps);
      setzeBaustein(id, {
        status: res.status, daten: res.daten, rohtext: res.rohtext, chatResetStatus: res.chatResetStatus,
        retryAnzahl: res.retryAnzahl, begruendung: res.begruendung,
      });
    } catch (e) {
      // Grund mitnehmen statt ihn zu verschlucken: hier landet u.a. die
      // DSGVO-Transport-Policy („aktiver Provider ist extern") — ohne Text stand
      // im Stepper nur „Fehler", und niemand konnte wissen, was zu tun ist.
      setzeBaustein(id, { status: 'fehler', begruendung: e instanceof Error ? e.message : String(e) });
    }
  };

  /**
   * Fährt alle Bausteine SEQUENTIELL (Aspekte → Steckbrief → Zahlen → Glossar) gegen
   * einen vorhandenen Run. Sequentiell, weil der interne Transport (Streamlit-Bridge)
   * ein einzelnes postMessage-Fenster ist. VB einmal auflösen.
   */
  const laufBausteine = async (_aktRun: AufbereitungRun, aktCtx: AufbereitungContext, force: boolean): Promise<void> => {
    // Bausteine laufen auf dem KORPUS (VB + narrative Zusatzdokumente), und ihre
    // Gliederung wird aus demselben frischen Korpus abgeleitet — nicht aus dem
    // gespeicherten Run (siehe `deps.gliederung` unten). So ist die Auswertung
    // dokumentgrenzen-unabhängig und Marketing-Inhalt wird fundstellen-fähig.
    const korpus = await resolveKorpus(storage.idb, aktCtx).catch(() => null);
    if (!korpus) {
      setBausteinZustand(vorher => setzeAlleUi(vorher, { status: 'fehler' }));
      return;
    }
    setVbMarkdown(korpus.markdown); // `vbMarkdown` trägt den Korpus (Lesemodus/Fundstellen-Auszüge + Cap-Messung)
    // EIN Deps-Objekt für ALLE Bausteine — insbesondere dasselbe `ziel`. Wäre es je
    // Aufruf einzeln zu setzen, hinge ein vergessener Baustein still an der globalen
    // KI-Variante, und der Streamlit-Tab wechselte mitten in der Kette.
    const deps = {
      idb: storage.idb,
      antragKey: aktCtx.key,
      // Die Gliederung aus dem FRISCH aufgelösten Korpus, nicht die des
      // gespeicherten Runs: beide gehen in denselben Prompt, und die Parser
      // prüfen die vom Modell genannten Fundstellen gegen genau diese Liste.
      // Kam seit dem Run ein Dokument dazu, trägt jeder Claim daraus eine
      // Sektions-Id, die die alte Liste nicht kennt — und wurde still verworfen
      // (v4.124). `parseVbGliederung` ist dieselbe Funktion, die `baueRun` nimmt.
      gliederung: parseVbGliederung(korpus.markdown),
      korpus: korpus.markdown,
      bekannteWerte: aktCtx.bekannteWerte ?? {},
      opts: {
        force,
        ziel: laufZiel.ziel,
        // Passt der Korpus nicht ins Standard-Fenster, darf kein Baustein dorthin
        // zurückfallen (siehe `getOrComputeBaustein.ueberStandardCap`).
        ueberStandardCap: laufZiel.notausfahrtAnbieten,
      },
    };
    // Sequentiell in Katalog-Reihenfolge (`recherchePrompt` zuerst, damit der Prüfer die
    // externe Deep Research starten kann, während die übrigen weiterlaufen). Sequentiell,
    // weil der interne Transport ein einzelnes postMessage-Fenster ist.
    for (const id of BAUSTEIN_IDS) await laufEinen(id, deps);
  };

  /**
   * Preflight VOR dem minutenlangen Lauf — auf dem Transport, der die Bausteine
   * wirklich fährt, nicht dem pauschal aktiven:
   *  1. `getTransportForSkillRun` WIRFT bei externem Provider (DSGVO-Policy). Ohne
   *     diesen Vorgriff liefe der Fehler sechsmal einzeln in `laufEinen` und stünde
   *     als sechsmal „Fehler" im Stepper, statt einmal am Knopf.
   *  2. Danach die echte Erreichbarkeit (passiver Ping, siehe `kiVerbindungGeprueft`).
   * `false` = abgebrochen, der Verbinden-Dialog steht offen.
   */
  const kiBereitFuerLauf = async (): Promise<boolean> => {
    // Stellvertretend der erste Baustein der Kette: alle sechs tragen VB-Volltext und
    // damit dieselbe Transport-Klasse (intern-pflichtig, Pitfall #30/#35).
    const t = bridge.getTransportForSkillRun(bausteinZustand[BAUSTEIN_IDS[0]!].skill);
    return kiVerbindungGeprueft(bridge, t.name);
  };

  const bausteine = useAsyncAction(async () => {
    if (!ctx) throw new Error(KEIN_KONTEXT);
    if (!await kiBereitFuerLauf()) return;
    // Sicherstellen, dass ein Run (mit Gliederung) existiert.
    const aktRun = run ?? await computeAufbereitung(storage.idb, ctx);
    if (!run) setRun(aktRun);
    await laufBausteine(aktRun, ctx, false);
  });

  const bausteineNeu = useAsyncAction(async () => {
    if (!ctx) throw new Error(KEIN_KONTEXT);
    if (!await kiBereitFuerLauf()) return;
    const aktRun = run ?? await computeAufbereitung(storage.idb, ctx);
    if (!run) setRun(aktRun);
    await loescheBausteinCaches(storage.idb, ctx.key);
    await laufBausteine(aktRun, ctx, true);
  });

  const toggle = useAsyncAction(async (befund: string) => {
    if (!run) return;
    const next = toggleOffenerPunkt(run, befund);
    setRun(next);
    await storage.idb.set(aufbereitungKey(next.antragKey), next);
  });

  const toggleErledigt = useAsyncAction(async (key: string) => {
    if (!run) return;
    const next = toggleErledigterPunkt(run, key);
    setRun(next);
    await storage.idb.set(aufbereitungKey(next.antragKey), next);
  });

  const markiereMarktzugangKopiert = useAsyncAction(async () => {
    if (!run) return; // best-effort: ohne Run kein Stempel (Kopieren funktioniert trotzdem im Tab).
    const next: AufbereitungRun = { ...run, marktzugangKopiert: { am: new Date().toISOString() } };
    setRun(next);
    await storage.idb.set(aufbereitungKey(next.antragKey), next);
  });

  /**
   * Der aktuell angezeigte DR-Auftragstext als Ausgangspunkt einer Bearbeitung: die
   * geparsten Daten, sonst (degradiert, nicht gecacht) der Prompt aus der Roh-Antwort.
   */
  const recherchePromptText = (): string =>
    recherchePrompt.daten?.prompt
    ?? (recherchePrompt.rohtext ? parseRecherchePrompt(recherchePrompt.rohtext)?.prompt ?? '' : '');

  /**
   * Übernimmt EINE Auftrags-Fassung (bearbeitet oder zurückgeholt). Der Text verlässt
   * beim Kopieren den geschützten Bereich, also läuft der deterministische Leak-Check
   * (DSGVO-Schicht 2) auf JEDEM Weg, der eine Fassung setzt — und bei einem Treffer wird
   * sie NICHT gecacht (dieselbe Invariante wie im `verdaechtig`-Guard des KI-Laufs):
   * sie bleibt nur für diese Sitzung sichtbar und gesperrt, bis der Prüfer die Angabe
   * entfernt. Sonst in den Baustein-Cache — der IST die Persistenz der KI-Anteile,
   * deshalb überlebt eine Bearbeitung den Seitenwechsel über denselben
   * Rehydrierungs-Pfad (kein zweiter Lesepfad, kein Merge).
   */
  const uebernimmRecherchePrompt = async (
    aktCtx: AufbereitungContext, korpus: string, daten: RecherchePromptDaten,
  ): Promise<void> => {
    const { leaks } = pruefeBearbeitetenPrompt(daten.prompt, aktCtx.bekannteWerte ?? {});
    if (leaks.length > 0) {
      setzeBaustein('recherchePrompt', {
        status: 'degradiert', daten,
        begruendung: `Identifizierende Angabe im Recherche-Prompt: ${leaks.join(', ')}`,
      });
      return;
    }
    const vbHash = vbHashFuer(korpus);
    await storage.idb.set(recherchePromptCacheKey(aktCtx.key, vbHash), { vbHash, daten });
    // Zusätzlich hash-frei, damit die geprüfte Fassung einen Korpus-Wechsel
    // übersteht (siehe `recherchePromptBearbeitetKey`).
    if (daten.bearbeitet) {
      await storage.idb.set(recherchePromptBearbeitetKey(aktCtx.key), { daten });
    }
    setzeBaustein('recherchePrompt', { status: 'ok', daten });
  };

  const speichereRecherchePrompt = useAsyncAction(async (neuerText: string) => {
    if (!ctx) return;
    const text = normalisiereAuftragstext(neuerText).trim();
    if (!text) throw new Error('Der Auftragstext darf nicht leer sein.');
    if (!vbMarkdown) throw new Error('Der Korpus ist noch nicht geladen — bitte die Seite neu öffnen.');
    const vorher = recherchePrompt.daten;
    await uebernimmRecherchePrompt(ctx, vbMarkdown, {
      schemaVersion: vorher?.schemaVersion ?? STICHWORTE_SCHEMA_VERSION,
      stichworte: vorher?.stichworte ?? LEERE_STICHWORTE,
      prompt: text,
      ...(vorher?.entfernt ? { entfernt: vorher.entfernt } : {}),
      bearbeitet: {
        am: new Date().toISOString(),
        // Die ERSTE KI-Fassung behalten — mehrfaches Bearbeiten überschreibt sie nicht.
        kiOriginal: vorher?.bearbeitet?.kiOriginal ?? recherchePromptText(),
      },
    });
  });

  /**
   * Übernimmt geänderte Stichworte und baut den Auftrag daraus NEU. Damit endet eine
   * etwaige Handfassung: die Vorlage ist wieder die Quelle, und `bearbeitet` fällt weg —
   * sonst stünden zwei Wahrheiten nebeneinander (Chips sagen A, Text zeigt B).
   */
  const speichereRechercheStichworte = useAsyncAction(async (stichworte: RechercheStichworte) => {
    if (!ctx) return;
    if (!vbMarkdown) throw new Error('Der Korpus ist noch nicht geladen — bitte die Seite neu öffnen.');
    await uebernimmRecherchePrompt(ctx, vbMarkdown, {
      schemaVersion: STICHWORTE_SCHEMA_VERSION,
      stichworte,
      prompt: baueDeepResearchAuftrag(stichworte),
    });
  });

  /** Stellt die ursprüngliche KI-Fassung wieder her (ohne neuen Lauf, mit Leak-Check). */
  const verwerfeRecherchePromptEdit = useAsyncAction(async () => {
    const vorher = recherchePrompt.daten;
    const original = vorher?.bearbeitet?.kiOriginal;
    if (!ctx || !vbMarkdown || !original) return;
    await uebernimmRecherchePrompt(ctx, vbMarkdown, {
      schemaVersion: vorher?.schemaVersion ?? STICHWORTE_SCHEMA_VERSION,
      stichworte: vorher?.stichworte ?? LEERE_STICHWORTE,
      prompt: original,
    });
  });

  /**
   * Baut den `ExterneRecherche`-Eintrag zu einem externen DR-Text — SCHREIBT NICHT.
   * Getrennt vom Persistieren, damit ein Mehr-Datei-Import alle Einträge sammeln und
   * mit EINEM `setRun` + EINEM `idb.set` ablegen kann (Pitfall #16/#20): schriebe die
   * Schleife je Datei, bauten alle Durchläufe auf demselben `run` aus der Render-Closure
   * auf und der letzte Eintrag überschriebe die vorherigen.
   */
  const baueExternEintrag = async (rohText: string, ausDatei: boolean, modellLabel?: string): Promise<ExterneRecherche | null> => {
    if (!ctx || !rohText.trim()) return null;
    // Transport für den (best-effort) internen Strukturierungs-Lauf — intern-pflichtig
    // (`{{externText}}`, Pitfall #30/#35). Fehlt/wirft er, übernimmt strukturiereImport Rohtext.
    let deps: Parameters<typeof strukturiereImport>[1];
    try {
      const t = bridge.getTransportForSkillRun(AUFBEREITUNG_RECHERCHE_IMPORT_SKILL);
      deps = {
        idb: storage.idb, transport: t, skill: AUFBEREITUNG_RECHERCHE_IMPORT_SKILL,
        antragKey: ctx.key, ziel: laufZiel.ziel,
      };
    } catch { deps = undefined; }
    const { kern, herkunftInhalt, unstrukturiert } = await strukturiereImport(rohText, deps);
    return {
      schemaVersion: kern.schemaVersion,
      importiertAm: new Date().toISOString(),
      herkunft: ausDatei ? 'datei' : herkunftInhalt,
      ...(modellLabel ? { modellLabel } : {}),
      quellen: kern.quellen,
      ...(kern.identifikation ? { identifikation: kern.identifikation } : {}),
      aussagen: kern.aussagen,
      ...(unstrukturiert ? { rohtext: rohText.slice(0, 200_000) } : {}),
    };
  };

  /** Hängt fertige Einträge an `run.extern` an — ein `setRun`, ein `persist`. */
  const persistiereExtern = async (eintraege: readonly ExterneRecherche[]): Promise<void> => {
    if (!run || eintraege.length === 0) return;
    const next: AufbereitungRun = { ...run, extern: [...(run.extern ?? []), ...eintraege] };
    setRun(next);
    await storage.idb.set(aufbereitungKey(next.antragKey), next);
  };

  const importTextRecherche = useAsyncAction(async (rohText: string, modellLabel?: string) => {
    if (!run) return;
    const eintrag = await baueExternEintrag(rohText, false, modellLabel);
    if (eintrag) await persistiereExtern([eintrag]);
  });

  /**
   * Externe DR-Dateien importieren — je Datei ein Eintrag. Extrahiert NUR den Text
   * (kein Korpus-Tag, keine Indexierung) — externe Quelle eigener Klasse.
   *
   * Teilfehler sind ehrlich: gescheiterte Dateien werden gesammelt, die erfolgreichen
   * ZUERST persistiert und der Fehler DANACH geworfen — so bleibt die geglückte Arbeit
   * stehen und der Nutzer sieht trotzdem, was nicht gelesen werden konnte.
   */
  const importDateiRecherche = useAsyncAction(async (dateien: File[], onFortschritt?: (fertig: number, gesamt: number) => void) => {
    if (!run || dateien.length === 0) return;
    const konverter = new DocConverter();
    const eintraege: ExterneRecherche[] = [];
    const fehler: string[] = [];
    for (const [i, file] of dateien.entries()) {
      onFortschritt?.(i, dateien.length);
      try {
        const conv = await konverter.convert(file);
        const eintrag = await baueExternEintrag(conv.markdown, true, file.name);
        if (eintrag) eintraege.push(eintrag);
        else fehler.push(`${file.name} (kein Text erkannt — evtl. ein gescanntes PDF)`);
      } catch (err) {
        fehler.push(`${file.name} (${err instanceof Error ? err.message : 'Lesefehler'})`);
      }
    }
    onFortschritt?.(dateien.length, dateien.length);
    await persistiereExtern(eintraege);
    if (fehler.length) {
      throw new Error(`${fehler.length} von ${dateien.length} Datei(en) konnten nicht gelesen werden: ${fehler.join('; ')}`);
    }
  });

  const loescheExternRecherche = useAsyncAction(async (index: number) => {
    if (!run) return;
    const next: AufbereitungRun = { ...run, extern: (run.extern ?? []).filter((_, i) => i !== index) };
    setRun(next);
    await storage.idb.set(aufbereitungKey(next.antragKey), next);
  });

  return { run, loading, veraltet, neu, requestRecompute, toggle, toggleErledigt, markiereMarktzugangKopiert, importTextRecherche, importDateiRecherche, loescheExternRecherche, aspekte, steckbrief, zahlen, glossar, verwertung, recherchePrompt, speichereRecherchePrompt, speichereRechercheStichworte, verwerfeRecherchePromptEdit, vbMarkdown, korpusMass, einreichungsBezug, laufZiel, setzeAgentischErzwungen, bausteine, bausteineNeu };
}
