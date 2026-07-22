/**
 * State-/IO-Schicht der Aufbereitungs-Seite: lädt den (deterministischen) Run,
 * bietet „Neu aufbereiten" (via `useAsyncAction` → Fehlerbanner) und den
 * Offene-Punkte-Toggle, prüft best-effort auf veraltete Quellen, und orchestriert
 * die LLM-Bausteine (Paket 2) — sequentiell, tolerant, ohne den deterministischen
 * Teil je zu blockieren.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { kiVerbindungBereit } from '@/core/services/ai/ki-guard';
import { useAsyncAction, type UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { hashText } from '@/plugins/antraege/gutachten/runner';
import {
  loadSkillRegistry,
  AUFBEREITUNG_ASPEKTE_SKILL, AUFBEREITUNG_ASPEKTE_SKILL_ID,
  AUFBEREITUNG_STECKBRIEF_SKILL, AUFBEREITUNG_STECKBRIEF_SKILL_ID,
  AUFBEREITUNG_ZAHLEN_SKILL, AUFBEREITUNG_ZAHLEN_SKILL_ID,
  AUFBEREITUNG_GLOSSAR_SKILL, AUFBEREITUNG_GLOSSAR_SKILL_ID,
  AUFBEREITUNG_VERWERTUNG_SKILL, AUFBEREITUNG_VERWERTUNG_SKILL_ID,
  AUFBEREITUNG_RECHERCHE_PROMPT_SKILL, AUFBEREITUNG_RECHERCHE_PROMPT_SKILL_ID,
  AUFBEREITUNG_RECHERCHE_IMPORT_SKILL,
  type SkillRecord,
} from '@/core/services/skills';
import { DocConverter } from '@/core/services/converter';
import { resolveKorpus, resolveAnlage5, resolveAnlagenProTv, misseKorpus, type KorpusMass } from './quellen';
import { getVbCharCap } from '@/core/services/ai/llm-context';
import { bestimmeLaufZiel, type LaufZiel } from './lauf-ziel';
import {
  aufbereitungKey, computeAufbereitung, loadAufbereitung, istVeraltet, toggleOffenerPunkt, toggleErledigterPunkt,
  type AufbereitungContext,
} from './store';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { ChatResetStatus } from '@/core/services/ai/chat-reset';
import {
  istAufbereitungBausteinFreigeschaltet, loescheBausteinCaches, vbHashFuer,
  type BausteinResult,
} from './bausteine';
import { leseGecachteBausteine } from './baustein-rehydrierung';
import { computeAspekteBaustein, type AspektMapping } from './aspekte';
import { computeSteckbriefBaustein, type SteckbriefDaten } from './steckbrief';
import { computeZahlenBaustein, type ZahlenDaten } from './zahlen';
import { computeGlossarBaustein, type GlossarDaten } from './glossar';
import { computeVerwertungBaustein, type VerwertungDaten } from './verwertung';
import {
  computeRecherchePromptBaustein, normalisiereAuftragstext, parseRecherchePrompt, pruefeBearbeitetenPrompt,
  recherchePromptCacheKey, type RecherchePromptDaten,
} from './recherche-prompt';
import { baueDeepResearchAuftrag } from './recherche-auftrag';
import {
  LEERE_STICHWORTE, STICHWORTE_SCHEMA_VERSION, type RechercheStichworte,
} from './recherche-stichworte';
import { strukturiereImport } from './recherche-import';
import type { AufbereitungRun, ExterneRecherche } from './types';

/** UI-Status eines Bausteins (Compute-Status + die Vor-Zustände `fehlt`/`laeuft`). */
export type BausteinUiStatus = 'fehlt' | 'laeuft' | 'ok' | 'degradiert' | 'fehler';

export interface BausteinUiState<T> {
  status: BausteinUiStatus;
  daten?: T;
  /** Roh-Antwort bei `degradiert` (einsehbar im UI). */
  rohtext?: string;
  /** Chat-Reset-Status des Laufs (Pitfall #36) — `'nicht-gefunden'`/`'timeout'` →
   *  Warn-Banner auf der Seite. Nur bei echtem Submit gesetzt (nicht bei Cache-Hit). */
  chatResetStatus?: ChatResetStatus;
  /** Anzahl automatischer Retries (nur bei Auffälligkeit gesetzt). */
  retryAnzahl?: number;
  /** Begründung der Degradation (z.B. „Modell hat keine Sektion zugeordnet"). */
  begruendung?: string;
}

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
  /** Externe DR-Datei (PDF/Word) importieren — Text-Extraktion via DocConverter, dann wie Text. */
  importDateiRecherche: UseAsyncActionResult<[File]>;
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
  /** Umfang des Korpus gegen das Kontextfenster DER TATSÄCHLICH GENUTZTEN KI
   *  (`laufZiel.cap`, nicht die globale KI-Variante). `ueberCap` heisst: die Bausteine
   *  haben das Ende des Textes nicht gesehen; das gilt auch für gecachte Ergebnisse. */
  korpusMass: KorpusMass | null;
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

const FEHLT: BausteinUiState<never> = { status: 'fehlt' };

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
  const [aspekteSkill, setAspekteSkill] = useState<SkillRecord>(AUFBEREITUNG_ASPEKTE_SKILL);
  const [steckbriefSkill, setSteckbriefSkill] = useState<SkillRecord>(AUFBEREITUNG_STECKBRIEF_SKILL);
  const [zahlenSkill, setZahlenSkill] = useState<SkillRecord>(AUFBEREITUNG_ZAHLEN_SKILL);
  const [glossarSkill, setGlossarSkill] = useState<SkillRecord>(AUFBEREITUNG_GLOSSAR_SKILL);
  const [verwertungSkill, setVerwertungSkill] = useState<SkillRecord>(AUFBEREITUNG_VERWERTUNG_SKILL);
  const [recherchePromptSkill, setRecherchePromptSkill] = useState<SkillRecord>(AUFBEREITUNG_RECHERCHE_PROMPT_SKILL);
  const [aspekte, setAspekte] = useState<BausteinUiState<AspektMapping>>(FEHLT);
  const [steckbrief, setSteckbrief] = useState<BausteinUiState<SteckbriefDaten>>(FEHLT);
  const [zahlen, setZahlen] = useState<BausteinUiState<ZahlenDaten>>(FEHLT);
  const [glossar, setGlossar] = useState<BausteinUiState<GlossarDaten>>(FEHLT);
  const [verwertung, setVerwertung] = useState<BausteinUiState<VerwertungDaten>>(FEHLT);
  const [recherchePrompt, setRecherchePrompt] = useState<BausteinUiState<RecherchePromptDaten>>(FEHLT);
  const [vbMarkdown, setVbMarkdown] = useState<string | null>(null);
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
    setAspekte(FEHLT);
    setSteckbrief(FEHLT);
    setZahlen(FEHLT);
    setGlossar(FEHLT);
    setVerwertung(FEHLT);
    setRecherchePrompt(FEHLT);
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
        const asp = loaded.file.skills.find(x => x.id === AUFBEREITUNG_ASPEKTE_SKILL_ID) ?? AUFBEREITUNG_ASPEKTE_SKILL;
        const stb = loaded.file.skills.find(x => x.id === AUFBEREITUNG_STECKBRIEF_SKILL_ID) ?? AUFBEREITUNG_STECKBRIEF_SKILL;
        const zah = loaded.file.skills.find(x => x.id === AUFBEREITUNG_ZAHLEN_SKILL_ID) ?? AUFBEREITUNG_ZAHLEN_SKILL;
        const glo = loaded.file.skills.find(x => x.id === AUFBEREITUNG_GLOSSAR_SKILL_ID) ?? AUFBEREITUNG_GLOSSAR_SKILL;
        const vw = loaded.file.skills.find(x => x.id === AUFBEREITUNG_VERWERTUNG_SKILL_ID) ?? AUFBEREITUNG_VERWERTUNG_SKILL;
        const rp = loaded.file.skills.find(x => x.id === AUFBEREITUNG_RECHERCHE_PROMPT_SKILL_ID) ?? AUFBEREITUNG_RECHERCHE_PROMPT_SKILL;
        if (!cancelled) { setAspekteSkill(asp); setSteckbriefSkill(stb); setZahlenSkill(zah); setGlossarSkill(glo); setVerwertungSkill(vw); setRecherchePromptSkill(rp); }
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
    if (abgebrochen()) return;
    const fuelle = <T,>(
      set: Dispatch<SetStateAction<BausteinUiState<T>>>, daten: T | null,
    ): void => {
      if (daten === null) return;
      set(vorher => (vorher.status === 'fehlt' ? { status: 'ok', daten } : vorher));
    };
    fuelle(setRecherchePrompt, gecacht.recherchePrompt);
    fuelle(setAspekte, gecacht.aspekte);
    fuelle(setSteckbrief, gecacht.steckbrief);
    fuelle(setZahlen, gecacht.zahlen);
    fuelle(setGlossar, gecacht.glossar);
    fuelle(setVerwertung, gecacht.verwertung);
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

  const neu = useAsyncAction(async () => {
    if (!ctx) throw new Error(KEIN_KONTEXT);
    const r = await computeAufbereitung(storage.idb, ctx);
    setRun(r);
    setVeraltet(false);
    setAspekte(FEHLT);    // Neuer deterministischer Stand → Bausteine erneut anfordern.
    setSteckbrief(FEHLT);
    setZahlen(FEHLT);
    setGlossar(FEHLT);
    setVerwertung(FEHLT);
    setRecherchePrompt(FEHLT);
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
  const laufEinen = async <T>(
    skill: SkillRecord,
    set: (s: BausteinUiState<T>) => void,
    compute: (t: AITransport) => Promise<BausteinResult<T>>,
  ): Promise<void> => {
    if (!istAufbereitungBausteinFreigeschaltet(skill)) { set({ status: 'fehler' }); return; }
    set({ status: 'laeuft' });
    try {
      const t = bridge.getTransportForSkillRun(skill);
      const res = await compute(t);
      set({
        status: res.status, daten: res.daten, rohtext: res.rohtext, chatResetStatus: res.chatResetStatus,
        retryAnzahl: res.retryAnzahl, begruendung: res.begruendung,
      });
    } catch {
      set({ status: 'fehler' });
    }
  };

  /**
   * Fährt alle Bausteine SEQUENTIELL (Aspekte → Steckbrief → Zahlen → Glossar) gegen
   * einen vorhandenen Run. Sequentiell, weil der interne Transport (Streamlit-Bridge)
   * ein einzelnes postMessage-Fenster ist. VB einmal auflösen.
   */
  const laufBausteine = async (aktRun: AufbereitungRun, aktCtx: AufbereitungContext, force: boolean): Promise<void> => {
    // Bausteine laufen auf dem KORPUS (VB + narrative Zusatzdokumente) — deckungsgleich
    // mit `aktRun.gliederung` (in `baueRun` ebenfalls aus dem Korpus). So ist die
    // Auswertung dokumentgrenzen-unabhängig und Marketing-Inhalt wird fundstellen-fähig.
    const korpus = await resolveKorpus(storage.idb, aktCtx).catch(() => null);
    if (!korpus) {
      setRecherchePrompt({ status: 'fehler' });
      setAspekte({ status: 'fehler' }); setSteckbrief({ status: 'fehler' });
      setZahlen({ status: 'fehler' }); setGlossar({ status: 'fehler' }); setVerwertung({ status: 'fehler' });
      return;
    }
    setVbMarkdown(korpus.markdown); // `vbMarkdown` trägt den Korpus (Lesemodus/Fundstellen-Auszüge + Cap-Messung)
    // EIN Options-Objekt für ALLE sechs Bausteine — insbesondere dasselbe `ziel`. Wäre es
    // je Aufruf einzeln zu setzen, hinge ein vergessener Baustein still an der globalen
    // KI-Variante, und der Streamlit-Tab wechselte mitten in der Kette.
    const bausteinOpts = { force, ziel: laufZiel.ziel };
    // Recherche-Prompt ZUERST: der Prüfer kann die externe Deep Research (5–10 Min) starten,
    // während die übrigen Bausteine weiterlaufen. Leak-Check im Compute.
    await laufEinen<RecherchePromptDaten>(recherchePromptSkill, setRecherchePrompt, t =>
      computeRecherchePromptBaustein(storage.idb, t, recherchePromptSkill, aktCtx.key, korpus.markdown, aktCtx.bekannteWerte ?? {}, bausteinOpts));
    await laufEinen<AspektMapping>(aspekteSkill, setAspekte, t =>
      computeAspekteBaustein(storage.idb, t, aspekteSkill, aktCtx.key, aktRun.gliederung, korpus.markdown, bausteinOpts));
    await laufEinen<SteckbriefDaten>(steckbriefSkill, setSteckbrief, t =>
      computeSteckbriefBaustein(storage.idb, t, steckbriefSkill, aktCtx.key, aktRun.gliederung, korpus.markdown, bausteinOpts));
    await laufEinen<ZahlenDaten>(zahlenSkill, setZahlen, t =>
      computeZahlenBaustein(storage.idb, t, zahlenSkill, aktCtx.key, aktRun.gliederung, korpus.markdown, bausteinOpts));
    await laufEinen<GlossarDaten>(glossarSkill, setGlossar, t =>
      computeGlossarBaustein(storage.idb, t, glossarSkill, aktCtx.key, aktRun.gliederung, korpus.markdown, bausteinOpts));
    await laufEinen<VerwertungDaten>(verwertungSkill, setVerwertung, t =>
      computeVerwertungBaustein(storage.idb, t, verwertungSkill, aktCtx.key, aktRun.gliederung, korpus.markdown, bausteinOpts));
  };

  const bausteine = useAsyncAction(async () => {
    if (!ctx) throw new Error(KEIN_KONTEXT);
    // KI-Preflight: nicht verbunden → Verbinden-Prompt statt stiller Tab-Öffnung + Loop.
    if (!kiVerbindungBereit(bridge)) return;
    // Sicherstellen, dass ein Run (mit Gliederung) existiert.
    const aktRun = run ?? await computeAufbereitung(storage.idb, ctx);
    if (!run) setRun(aktRun);
    await laufBausteine(aktRun, ctx, false);
  });

  const bausteineNeu = useAsyncAction(async () => {
    if (!ctx) throw new Error(KEIN_KONTEXT);
    if (!kiVerbindungBereit(bridge)) return;
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
      setRecherchePrompt({
        status: 'degradiert', daten,
        begruendung: `Identifizierende Angabe im Recherche-Prompt: ${leaks.join(', ')}`,
      });
      return;
    }
    const vbHash = vbHashFuer(korpus);
    await storage.idb.set(recherchePromptCacheKey(aktCtx.key, vbHash), { vbHash, daten });
    setRecherchePrompt({ status: 'ok', daten });
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

  /** Toleranter Import eines externen DR-Textes → `run.extern` (NIE in den VB-Korpus). */
  const fuegeExternHinzu = async (rohText: string, ausDatei: boolean, modellLabel?: string): Promise<void> => {
    if (!ctx || !run || !rohText.trim()) return;
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
    const eintrag: ExterneRecherche = {
      schemaVersion: kern.schemaVersion,
      importiertAm: new Date().toISOString(),
      herkunft: ausDatei ? 'datei' : herkunftInhalt,
      ...(modellLabel ? { modellLabel } : {}),
      quellen: kern.quellen,
      ...(kern.identifikation ? { identifikation: kern.identifikation } : {}),
      aussagen: kern.aussagen,
      ...(unstrukturiert ? { rohtext: rohText.slice(0, 200_000) } : {}),
    };
    const next: AufbereitungRun = { ...run, extern: [...(run.extern ?? []), eintrag] };
    setRun(next);
    await storage.idb.set(aufbereitungKey(next.antragKey), next);
  };

  const importTextRecherche = useAsyncAction(async (rohText: string, modellLabel?: string) => {
    await fuegeExternHinzu(rohText, false, modellLabel);
  });

  const importDateiRecherche = useAsyncAction(async (file: File) => {
    // Extrahiert NUR den Text (kein Korpus-Tag, keine Indexierung) — externe Quelle eigener Klasse.
    const conv = await new DocConverter().convert(file);
    await fuegeExternHinzu(conv.markdown, true, file.name);
  });

  const loescheExternRecherche = useAsyncAction(async (index: number) => {
    if (!run) return;
    const next: AufbereitungRun = { ...run, extern: (run.extern ?? []).filter((_, i) => i !== index) };
    setRun(next);
    await storage.idb.set(aufbereitungKey(next.antragKey), next);
  });

  return { run, loading, veraltet, neu, requestRecompute, toggle, toggleErledigt, markiereMarktzugangKopiert, importTextRecherche, importDateiRecherche, loescheExternRecherche, aspekte, steckbrief, zahlen, glossar, verwertung, recherchePrompt, speichereRecherchePrompt, speichereRechercheStichworte, verwerfeRecherchePromptEdit, vbMarkdown, korpusMass, laufZiel, setzeAgentischErzwungen, bausteine, bausteineNeu };
}
