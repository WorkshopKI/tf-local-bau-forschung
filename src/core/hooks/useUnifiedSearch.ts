/**
 * Uebergreifende Suche: aggregiert Treffer aus der Foerderantraege-Suche
 * (Substring + Embedding + DMS, programm-scoped) UND aus der globalen
 * Dokumenten-Hybrid-Suche (Orama BM25 + Vector) in einer einzigen,
 * score-sortierten Liste.
 *
 * Architektur: Services werden **direkt** aufgerufen — kein Hook-in-Hook.
 *  - {@link searchAntraege} aus dem Antraege-Plugin-Service.
 *  - {@link hybridSearch} aus dem Orama-Store.
 *  - `useSearch()` wird nur read-only fuer `vectorReady`/`vectorLoading`/
 *    `documentCount` benutzt — niemals fuer den Search-Call.
 *
 * Debounce 300 ms; vorheriger Lauf wird via AbortController abgebrochen.
 *
 * Score-Strategie (v4.5): EINE Zahl je Antrag, aus seinen Fundstellen gerechnet.
 * Die Quellen liefern Belege, nicht Urteile — sie sammeln sich in einem
 * `AntragAkku`, aus dem am Ende `berechneRelevanz` die Relevanz bildet
 * ([trefferstelle.ts](src/plugins/antraege/services/trefferstelle.ts)).
 * Wortlaut schlägt Bedeutung: ein reiner Ähnlichkeitstreffer ist gedeckelt.
 *
 * Vorher bekam jeder Wortlaut-Treffer den festen Score 1.0. Da die
 * Ähnlichkeitssuche opt-in ist und der Dokumentenindex oft leer, hatten im
 * Normalfall ALLE Treffer denselben Score — die Sortierung „nach Score" gab
 * damit die Reihenfolge des IDB-Cursors aus.
 *
 * Dokumenttreffer mit bekanntem Antrag werden zur **Textstelle** dieses Antrags
 * gefaltet statt eine zweite Zeile zu erzeugen; Dokumente ohne zugeordneten
 * Antrag bleiben eigene Treffer.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStorage } from './useStorage';
import { protokolliereEreignis } from '@/core/services/assistent/protokoll';
import { useActiveProgramm } from './useActiveProgramm';
import { useSearch } from './useSearch';
import { useSemanticSearchMode } from './useSemanticSearchMode';
import {
  useSuchVerknuepfung, verknuepfungAlsThreshold, type SuchVerknuepfung,
} from './useSuchVerknuepfung';
import { useSuchOptionen } from './useSuchOptionen';
import { bereichNutztDokumente } from '@/core/services/search/suchbereich';
import { hatFeldPraefix } from '@/core/services/search/feldpraefix';
import type { PlanBegriff } from '@/core/services/search/frageplan';
import { embeddingService } from '@/core/services/search/embedding-service';
import { embedQueryCached } from '@/core/services/search/query-embedder';
import { getActiveModelId, getModelById } from '@/core/services/search/model-registry';
import {
  hybridSearch,
  getOramaDB,
  type OramaSearchResult,
} from '@/core/services/search/orama-store';
import {
  searchAntraegeWortlaut,
  searchAntraegeVector,
  getProgrammCaches,
  getEmbeddings,
  STREAMING_CONSTS,
  isSemanticSearchActive,
} from '@/plugins/antraege/services/antraege-search-service';
import {
  berechneRelevanz,
  relevanzAusAehnlichkeit,
  relevanzStufe,
  sortiereFelder,
  type Trefferfeld,
} from '@/core/services/search/trefferstelle';
import { ensureEmbeddingReady } from '@/core/services/embedding-corpus';
import { pipelineLog } from '@/core/services/search/pipeline-logger';
import {
  listAntraegeListViewByProgramm,
  countAntraegeListViewByProgramm,
} from '@/core/services/csv/idb-csv';
import type { AntragListItem } from '@/core/services/csv/types';
import type { AntragTextEntry } from '@/plugins/antraege/services/search-corpus';
import { getStatusCategory } from '@/core/utils/status-canonical';
import { useUnterprogrammLabels } from '@/plugins/antraege/useUnterprogrammLabels';
import { useBereich } from '@/core/hooks/useBereich';
import { istImBereich } from '@/core/status/betrachtungsbereich';
import type { UnifiedSearchResult, Textstelle } from '@/core/types/search-result';

const DEBOUNCE_MS = 300;
const DOC_HIT_LIMIT = 50;

export interface UnifiedSearchCounts {
  total: number;
  antraege: number;
  dokumente: number;
}

export interface UnifiedSearchIndexInfo {
  textabschnitteImIndex: number;
  antraegeGeladen: number;
}

/** Phase der Streaming-Pipeline. `substring` → erste Treffer sichtbar;
 *  `vector` → Embedding-Treffer kommen hinzu; `orama` → Dokument-Treffer
 *  + DMS-Antrags-Match werden ergaenzt; `done` → finaler Stand. */
export type SearchPhase = 'idle' | 'substring' | 'vector' | 'orama' | 'done' | 'error';

/** Diagnose der Ähnlichkeits-Stage (v2.62.2): Unter `file://` ist die Console
 *  meist zu — stille Leerlauf-Pfade (Modell lädt nicht / Korpus lokal leer)
 *  sahen für den User aus wie „Umschalten tut nichts". Der Status macht die
 *  Ursache im UI anzeigbar. `null` = Stage lief nicht (Opt-in aus / Query zu
 *  kurz / noch keine Suche), `ok` = Vector-Stage ist durchgelaufen. */
export type SemanticStatus = 'ok' | 'model-failed' | 'corpus-empty' | null;

export interface UseUnifiedSearchResult {
  results: UnifiedSearchResult[];
  loading: boolean;
  error: string | null;
  counts: UnifiedSearchCounts;
  indexInfo: UnifiedSearchIndexInfo;
  vectorReady: boolean;
  /** Welche Pipeline-Stage gerade laeuft. Fuer Status-Badge im UI. */
  searchPhase: SearchPhase;
  /** Warum die Ähnlichkeits-Stage ggf. keine Treffer liefern konnte. */
  semanticStatus: SemanticStatus;
  /** Wörter, die der Bestand über den Wortstamm beigesteuert hat — die
   *  abwählbaren Chips der Deutungszeile. Leer, wenn „Wortformen mitsuchen" aus
   *  ist oder nichts dazukam. */
  varianten: string[];
}

interface AntraegeListCache {
  programmId: string;
  byAkz: Map<string, AntragListItem>;
}

let cachedAntraegeListCache: AntraegeListCache | null = null;

async function getAntraegeListCache(
  idb: ReturnType<typeof useStorage>['idb'],
  programmId: string,
): Promise<AntraegeListCache> {
  if (cachedAntraegeListCache && cachedAntraegeListCache.programmId === programmId) {
    return cachedAntraegeListCache;
  }
  const items = await listAntraegeListViewByProgramm(idb, programmId);
  const byAkz = new Map(items.map(it => [it.aktenzeichen, it]));
  cachedAntraegeListCache = { programmId, byAkz };
  return cachedAntraegeListCache;
}

/** Vorschaulänge einer Textstelle. Eine Zahl für Snippet und Belegstelle —
 *  zwei Deckel für dieselbe Sache wären zwei Wahrheiten. */
const TEXTSTELLE_MAX = 300;

function kuerze(text: string): string {
  return text.length > TEXTSTELLE_MAX ? `${text.slice(0, TEXTSTELLE_MAX)}…` : text;
}

function makeAntragSnippet(item: AntragListItem | undefined): string {
  if (!item) return '';
  const parts: string[] = [];
  if (item.antragsteller) parts.push(item.antragsteller);
  if (item.akronym) parts.push(item.akronym);
  if (item.foerdergeber) parts.push(item.foerdergeber);
  return parts.join(' · ');
}

/**
 * Was die drei Stufen über EINEN Antrag zusammentragen, bevor daraus eine Zahl
 * wird. Die Stufen liefern Belege — die Relevanz entsteht erst hier, aus der
 * Vereinigung aller Fundstellen. Genau deshalb hebt ein Dokumenttreffer die
 * Bewertung seines Antrags, statt als zweite Zeile danebenzustehen.
 */
interface AntragAkku {
  /** Alle Fundstellen inkl. `dokument`/`aehnlichkeit`. */
  felder: Set<Trefferfeld>;
  /** Anteil der Suchwörter mit wörtlicher Fundstelle (0..1). */
  wortAbdeckung: number;
  /** Relevanz aus der Ähnlichkeit, gedeckelt. 0 = kein Vektortreffer. */
  aehnlichkeit: number;
  textstelle?: Textstelle;
}

function leererAkku(): AntragAkku {
  return { felder: new Set(), wortAbdeckung: 0, aehnlichkeit: 0 };
}

/**
 * Rechnet den Sammler in einen Treffer um. `'aehnlichkeit'` zählt bewusst NICHT
 * als Beleg-Feld: sonst höbe ein Modellurteil die Breite und damit die Relevanz
 * eines Treffers, für den kein einziges Suchwort im Text steht.
 */
function baueAntragTreffer(
  akz: string,
  akku: AntragAkku,
  item: AntragListItem | undefined,
  programmNameById: Map<string, string>,
  korpus: AntragTextEntry | undefined,
): UnifiedSearchResult {
  const belege = sortiereFelder(akku.felder).filter(f => f !== 'aehnlichkeit');
  const wortlaut = berechneRelevanz(belege, akku.wortAbdeckung);
  const score = Math.max(wortlaut, akku.aehnlichkeit);
  const method: UnifiedSearchResult['method'] =
    belege.length > 0 && akku.aehnlichkeit > 0 ? 'hybrid'
      : belege.length > 0 ? 'fulltext'
        : 'vector';
  return {
    ...basisAntrag(akz, item, programmNameById, korpus),
    score,
    method,
    trefferfelder: sortiereFelder(akku.felder),
    relevanzStufe: relevanzStufe(score),
    textstelle: akku.textstelle,
  };
}

function basisAntrag(
  aktenzeichen: string,
  item: AntragListItem | undefined,
  programmNameById: Map<string, string>,
  korpus: AntragTextEntry | undefined,
): UnifiedSearchResult {
  return {
    id: aktenzeichen,
    type: 'antrag',
    score: 0,
    method: 'fulltext',
    title: item?.titel ?? item?.akronym ?? aktenzeichen,
    snippet: makeAntragSnippet(item),
    fkz: aktenzeichen,
    programm: item ? (programmNameById.get(item.programm_id) ?? item.programm_id) : undefined,
    // Roher Unterprogramm-Code; das sprechende Label wird erst nach dem Mappen
    // via useUnterprogrammLabels aufgeloest (Fallback = Code).
    unterprogramm: item?.unterprogramm_id?.trim() || undefined,
    unterprogrammCode: item?.unterprogramm_id?.trim() || undefined,
    antragsteller: item?.antragsteller,
    status: item?.status,
    statusKategorie: item?.status ? getStatusCategory(item.status) : undefined,
    antragsdatum: item?.antragsdatum,
    bewilligungsdatum: item?.bewilligung_datum,
    laufzeitbeginn: item?.laufzeitbeginn,
    laufzeitende: item?.laufzeitende,
    ortAst: item?.ort_ast,
    zuwendung: typeof item?.foerdersumme === 'number' ? item.foerdersumme : undefined,
    vbPhase: item?.vb_phase,
    // Die sieben Belege, die sonst nirgends im Ergebnis stehen. Aus dem KORPUS,
    // nicht aus der Listen-Projektion: gesucht wird in genau diesen Zeichenketten
    // (`ort_ast` allein trüge weder den Ausführungsort noch das Bundesland).
    // Fehlt der Korpus-Eintrag (reiner Vektortreffer), bleibt das Feld leer —
    // ein Ersatzwert wäre eine Behauptung.
    standort: korpus?.standort || undefined,
    deskriptoren: korpus?.descriptors || undefined,
    domain: korpus?.domain || undefined,
    netzwerk: korpus?.netzwerk || undefined,
    wahlkreis: korpus?.wahlkreis || undefined,
    notiz: korpus?.notiz || undefined,
    verbundkennzeichen: korpus?.verbundNr || undefined,
  };
}

function mapDokumentHit(
  hit: OramaSearchResult,
  filenameToAkz: Map<string, string>,
  antraegeByAkz: Map<string, AntragListItem>,
  programmNameById: Map<string, string>,
): UnifiedSearchResult {
  const akz = filenameToAkz.get(hit.source);
  const linkedItem = akz ? antraegeByAkz.get(akz) : undefined;
  const snippet = kuerze(hit.text);
  // Orama-Score ist längennormalisiert, aber nicht garantiert ≤ 1. Seit die
  // Antrags-Relevanz auf 0..1 lebt, würde ein Ausreißer die ganze Liste anführen.
  const score = Math.min(1, hit.score);
  return {
    id: hit.id,
    type: 'dokument',
    score,
    method: hit.method,
    trefferfelder: ['dokument'],
    relevanzStufe: relevanzStufe(score),
    title: hit.title || hit.source,
    snippet,
    dateiname: hit.source,
    dokumentTyp: hit.type,
    zugehoerigerAntragFkz: akz,
    zugehoerigesProgramm: linkedItem
      ? (programmNameById.get(linkedItem.programm_id) ?? linkedItem.programm_id)
      : undefined,
    unterprogramm: linkedItem?.unterprogramm_id?.trim() || undefined,
    unterprogrammCode: linkedItem?.unterprogramm_id?.trim() || undefined,
  };
}

async function embedQueryIfReady(
  query: string,
  idb: ReturnType<typeof useStorage>['idb'],
): Promise<number[] | null> {
  if (!embeddingService.isReady()) return null;
  try {
    const modelId = await getActiveModelId(idb);
    const cfg = getModelById(modelId);
    return await embedQueryCached(query, cfg, 'query');
  } catch {
    return null;
  }
}

/**
 * Die Suche. `planTeile` ist der Frageplan der natürlichsprachigen Suche
 * ([frageplan.ts](src/core/services/search/frageplan.ts)) — gesetzt heißt: in
 * `query` steht eine FRAGE, deren Wörter keine Suchbegriffe sind, und die
 * Wortlaut-Stufe nimmt ihre Teile von dort.
 *
 * Der Aufrufer reicht die Liste **memoisiert** herein: sie steht im Dep-Array,
 * damit das Abwählen eines Leitbegriffs die laufende Suche neu ausführt — eine
 * bei jedem Render neu gebaute Liste liefe endlos.
 */
export function useUnifiedSearch(
  query: string,
  planTeile?: readonly PlanBegriff[],
): UseUnifiedSearchResult {
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const programme = useActiveProgramm(s => s.programme);
  const { vectorReady, documentCount } = useSearch();
  // v2.62.1: Opt-in-Modus der Ähnlichkeitssuche abonnieren, damit das
  // Umschalten im Dropdown die LAUFENDE Suche neu ausführt — sonst bleiben
  // die angezeigten Treffer Substring-only bis zur nächsten Query-Änderung.
  const semanticEnabled = useSemanticSearchMode(s => s.enabled);
  // Verknüpfung mehrerer Stichwörter (UND/ODER). Wie `semanticEnabled` im
  // Dep-Array des Such-Effekts, damit das Umschalten die LAUFENDE Suche neu
  // ausführt statt bis zum nächsten Tastendruck zu warten.
  const verknuepfung = useSuchVerknuepfung(s => s.verknuepfung);
  // Dieselbe Falle wie bei `semanticEnabled`: ohne Abo im Dep-Array unten
  // wirkte ein Umschalten erst beim nächsten Tastendruck.
  const stammSuche = useSuchOptionen(s => s.stammSuche);
  const bereich = useSuchOptionen(s => s.bereich);
  const abgewaehlteVarianten = useSuchOptionen(s => s.abgewaehlteVarianten);
  // Code→Name-Map der Unterprogramme des aktiven Programms (Modul-gecacht).
  // Die Suche ist immer auf EIN Programm gescoped, daher genuegt eine Map.
  const unterprogrammLabels = useUnterprogrammLabels(activeProgrammId);
  const bereichMenge = useBereich().menge;

  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [antraegeGeladen, setAntraegeGeladen] = useState(0);
  const [searchPhase, setSearchPhase] = useState<SearchPhase>('idle');
  const [semanticStatus, setSemanticStatus] = useState<SemanticStatus>(null);
  // Assistent-Protokoll: dedupe je abgeschlossener Query (der Effekt läuft pro
  // Tastendruck, aber nur der zuletzt fertige Lauf soll ein Ereignis erzeugen).
  const zuletztProtokollierteSuche = useRef<string | null>(null);
  /** Die im Bestand gefundenen Stamm-Varianten (Chips der Deutungszeile). */
  const [varianten, setVarianten] = useState<string[]>([]);
  /**
   * Dieselbe Liste als Ref. Sobald der Nutzer eine Variante abwählt, sucht der
   * nächste Lauf mit AUSDRÜCKLICHEN Nadeln statt mit dem Stamm — er findet dann
   * keine neuen Varianten mehr und dürfte die gefundenen nicht überschreiben,
   * sonst verschwänden die Chips beim ersten Klick auf einen von ihnen.
   */
  const gefundeneVarianten = useRef<string[]>([]);
  /** Query des letzten Laufs — der Wechsel räumt die Variantenwahl. */
  const letzteQuery = useRef<string>('');

  const programmNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of programme) m.set(p.id, p.name);
    return m;
  }, [programme]);

  // Programm-Count fuer die Index-Info-Zeile.
  useEffect(() => {
    if (!activeProgrammId) { setAntraegeGeladen(0); return; }
    let cancelled = false;
    void countAntraegeListViewByProgramm(storage.idb, activeProgrammId)
      .then(c => { if (!cancelled) setAntraegeGeladen(c); })
      .catch(() => { if (!cancelled) setAntraegeGeladen(0); });
    return () => { cancelled = true; };
  }, [activeProgrammId, storage]);

  // Streaming-Hauptsuche. Drei Stages emittieren progressiv `setResults`,
  // damit der User schon erste Treffer sieht waehrend die Embedding-Pipeline
  // noch laeuft. Pattern:
  //   Stage 1 (substring) — sync, ~10ms, gibt sofort 1.0-Score-Hits
  //   Stage 2 (vector)    — async, ~200ms, ergaenzt cosine-Hits
  //   Stage 3 (orama)     — sync, ~150-300ms, ergaenzt Dokument-Treffer + DMS
  useEffect(() => {
    const q = query.trim();
    // Neue Anfrage ⇒ die Varianten der alten sind hinfällig. Eine abgewählte
    // „Normung" darf eine spätere Suche nach etwas anderem nicht beschneiden.
    if (letzteQuery.current !== q) {
      letzteQuery.current = q;
      gefundeneVarianten.current = [];
      setVarianten([]);
      useSuchOptionen.getState().setzeVariantenZurueck();
    }
    if (!q) {
      setResults([]);
      setLoading(false);
      setError(null);
      setSearchPhase('idle');
      setSemanticStatus(null);
      return;
    }
    setSemanticStatus(null);

    // Ein Frageplan verknüpft seine Themen IMMER mit ODER: die Leitbegriffe sind
    // Alternativen („Normung ODER Standards"), und nur so misst `abdeckung`, wie
    // viele der gefragten Sachen ein Vorhaben behandelt. Die eingestellte
    // Verknüpfung gehört zur getippten Anfrage und gibt hier sichtbar ab.
    const effektiveVerknuepfung: SuchVerknuepfung = planTeile ? 'oder' : verknuepfung;

    // Nennt die Anfrage ein Feld? Einmal gelesen, in zwei Stufen gebraucht.
    //
    // Ein Frageplan zählt mit, sobald er ein Feld bindet ODER etwas verlangt:
    // beides sind Einschränkungen, die weder das Embedding noch der
    // Dokumentenindex einhalten können — sie steuerten genau die Treffer bei,
    // die ausserhalb liegen. Ein reines Themen-Bündel ohne Einschränkung lässt
    // beide Stufen dagegen mitlaufen, und das ist dort auch erwünscht.
    const planSchraenktEin = planTeile?.some(t => t.feld !== undefined || t.pflicht) === true;
    const feldSuche = hatFeldPraefix(q, effektiveVerknuepfung === 'wortfolge') || planSchraenktEin;

    const abort = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      void (async () => {
        // Zwei Sammler statt einer Ergebnis-Map: Anträge werden über die Stufen
        // hinweg ANGEREICHERT (Fundstellen vereinigen sich), Dokumente ohne
        // zugeordneten Antrag bleiben eigenständige Treffer.
        const antraege = new Map<string, AntragAkku>();
        const dokumente = new Map<string, UnifiedSearchResult>();
        let byAkz = new Map<string, AntragListItem>();
        // Neben `byAkz`, aus demselben Grund: `emit()` läuft nach jeder Stufe und
        // sieht nur, was AUSSERHALB des try-Blocks steht. Der Korpus liefert die
        // Belegtexte (Ort, Deskriptoren), die die Listen-Projektion nicht führt.
        let textKorpus = new Map<string, AntragTextEntry>();
        const tStart = performance.now();

        function isCancelled(): boolean {
          return cancelled || abort.signal.aborted;
        }

        function akkuFuer(akz: string): AntragAkku {
          let a = antraege.get(akz);
          if (!a) { a = leererAkku(); antraege.set(akz, a); }
          return a;
        }

        function emit(): void {
          if (isCancelled()) return;
          const out: UnifiedSearchResult[] = [];
          for (const [akz, akku] of antraege) {
            out.push(baueAntragTreffer(
              akz, akku, byAkz.get(akz), programmNameById, textKorpus.get(akz),
            ));
          }
          for (const d of dokumente.values()) out.push(d);
          out.sort((a, b) => b.score - a.score);
          setResults(out);
        }

        try {
          // Stage 0: Caches laden (idR warm wegen Mount-Preload in SuchSeite).
          setSearchPhase('substring');
          const [listCache, programmCaches] = activeProgrammId
            ? await Promise.all([
                getAntraegeListCache(storage.idb, activeProgrammId),
                getProgrammCaches(storage.idb, activeProgrammId).catch(() => null),
              ])
            : [null, null];
          if (isCancelled()) return;

          byAkz = listCache?.byAkz ?? new Map<string, AntragListItem>();
          textKorpus = programmCaches?.textCorpus ?? new Map<string, AntragTextEntry>();
          const filenameToAkz = programmCaches?.filenameToAkz ?? new Map<string, string>();

          // Stage 1: Wortlaut (sync) — sofort sichtbare Treffer, inkl. der
          // Fundstellen, aus denen Relevanz und Trefferstellen-Tags entstehen.
          if (programmCaches) {
            const tStage1 = performance.now();
            // Ohne Abwahl genügt der Stamm; mit Abwahl wird ausdrücklich nach
            // den verbliebenen Varianten gesucht — nur so hat der Klick auf
            // einen Chip eine Wirkung auf die Treffermenge.
            const abgewaehlt = new Set(abgewaehlteVarianten);
            const aktiveVarianten = abgewaehlt.size === 0
              ? undefined
              : gefundeneVarianten.current.filter(v => !abgewaehlt.has(v.toLowerCase()));
            const wortlaut = searchAntraegeWortlaut(q, programmCaches.textCorpus, {
              verknuepfung: effektiveVerknuepfung, stammSuche, bereich, aktiveVarianten, planTeile,
            });
            for (const [akz, treffer] of wortlaut.treffer) {
              const akku = akkuFuer(akz);
              for (const f of treffer.felder) akku.felder.add(f);
              akku.wortAbdeckung = Math.max(akku.wortAbdeckung, treffer.abdeckung);
            }
            if (aktiveVarianten === undefined) {
              gefundeneVarianten.current = wortlaut.varianten;
              setVarianten(wortlaut.varianten);
            }
            pipelineLog.info('Suche', `Stage 1 (Wortlaut): ${wortlaut.treffer.size} Treffer in ${Math.round(performance.now() - tStage1)}ms`);
            emit();
          }
          if (isCancelled()) return;

          // Stage 2: Vector — Embedding berechnen, Cosine-Loop.
          setSearchPhase('vector');
          // Abonnierter Wert + zentrales Gate (Build-Flag): beides muss stehen.
          //
          // `feldSuche` nimmt beide nachgelagerten Quellen heraus: nennt die
          // Anfrage ein Feld (`ast:GMBU`), können weder das Embedding noch der
          // Dokumentenindex diese Einschränkung einhalten — sie lieferten
          // Treffer, die genau außerhalb des genannten Feldes liegen. Die
          // Deutungszeile schreibt das an, statt es still zu tun.
          const semanticActive =
            semanticEnabled
            && !feldSuche
            && isSemanticSearchActive()
            && q.length >= STREAMING_CONSTS.MIN_QUERY_LEN_FOR_SEMANTIC;

          // Diagnose-Logs hier bewusst via console.* (nicht pipelineLog — der
          // ist in Builds stumm): unter file:// ist das die einzige Spur, warum
          // die Ähnlichkeitssuche ggf. keine Treffer ergänzt (Pitfall #15-Klasse).
          let queryVec: number[] | null = null;
          if (semanticActive) {
            try {
              await ensureEmbeddingReady(storage.idb);
              if (isCancelled()) return;
              queryVec = await embedQueryIfReady(q, storage.idb);
              if (queryVec === null && !isCancelled()) {
                console.warn('[useUnifiedSearch] Ähnlichkeitssuche: Query-Embedding fehlgeschlagen (Modell nicht bereit / Embed-Fehler).');
                setSemanticStatus('model-failed');
              }
            } catch (err) {
              console.warn('[useUnifiedSearch] embedding init failed:', err);
              if (!isCancelled()) setSemanticStatus('model-failed');
            }
            if (isCancelled()) return;
          }

          if (queryVec && programmCaches) {
            try {
              const tStage2 = performance.now();
              const embeddings = await getEmbeddings(storage.idb);
              if (isCancelled()) return;
              if (embeddings.size === 0) {
                console.warn('[useUnifiedSearch] Ähnlichkeitssuche: Embedding-Korpus lokal leer (IDB) — keine Vector-Treffer möglich. Korpus kommt vom Daten-Share (Auslastungs-Modul / Auto-Download).');
                setSemanticStatus('corpus-empty');
              } else {
                const vecHits = await searchAntraegeVector(queryVec, embeddings, abort.signal);
                if (isCancelled()) return;
                for (const h of vecHits) {
                  const akku = akkuFuer(h.akz);
                  akku.felder.add('aehnlichkeit');
                  akku.aehnlichkeit = Math.max(akku.aehnlichkeit, relevanzAusAehnlichkeit(h.score));
                }
                setSemanticStatus('ok');
                console.info(
                  `[useUnifiedSearch] Ähnlichkeitssuche: ${vecHits.length} Vector-Treffer (Korpus ${embeddings.size}) in ${Math.round(performance.now() - tStage2)}ms`,
                );
                emit();
              }
            } catch (err) {
              console.warn('[useUnifiedSearch] vector stage failed:', err);
            }
          }
          if (isCancelled()) return;

          // Stage 3: Orama — Dokumente + DMS-Antraege-Match.
          setSearchPhase('orama');
          const tStage3 = performance.now();
          const dokumenteHits: OramaSearchResult[] =
            getOramaDB() !== null && bereichNutztDokumente(bereich) && !feldSuche
              ? hybridSearch(q, queryVec, {
                  limit: DOC_HIT_LIMIT,
                  threshold: verknuepfungAlsThreshold(effektiveVerknuepfung),
                })
              : [];
          // Faltung: ein Dokumenttreffer, dessen Antrag bekannt ist, wird zur
          // BELEGSTELLE dieses Antrags — eine Zeile je Vorhaben statt zweier
          // Zeilen, die dasselbe meinen. Nur Dokumente ohne zugeordneten Antrag
          // (Manifest kennt keinen Match) bleiben eigenständige Treffer.
          //
          // Der frühere zweite Orama-Lauf (`searchAntraegeDms`) entfällt hier: er
          // fragte denselben Index ein zweites Mal, nur um dieselbe Zuordnung zu
          // bilden — 150–300 ms für ein Ergebnis, das schon vorlag.
          let gefaltet = 0;
          for (const h of dokumenteHits) {
            const akz = filenameToAkz.get(h.source);
            if (akz) {
              const akku = akkuFuer(akz);
              akku.felder.add('dokument');
              // Kein wörtlicher Treffer in den Stammdaten? Dann trägt allein das
              // Dokument den Beleg — Orama hat die Anfrage dort gefunden.
              if (akku.wortAbdeckung === 0) akku.wortAbdeckung = 1;
              // Orama liefert absteigend sortiert: die erste Fundstelle ist die
              // stärkste, spätere überschreiben sie nicht.
              akku.textstelle ??= { quelle: h.title || h.source, text: kuerze(h.text) };
              gefaltet++;
              continue;
            }
            const r = mapDokumentHit(h, filenameToAkz, byAkz, programmNameById);
            const key = `dokument:${r.id}`;
            const prev = dokumente.get(key);
            if (!prev || r.score > prev.score) dokumente.set(key, r);
          }
          pipelineLog.info('Suche', `Stage 3 (Orama): ${dokumenteHits.length} Dok-Treffer (${gefaltet} unter ihren Antrag gefaltet) in ${Math.round(performance.now() - tStage3)}ms`);
          emit();

          if (isCancelled()) return;
          setSearchPhase('done');
          setLoading(false);
          const trefferzahl = antraege.size + dokumente.size;
          pipelineLog.info('Suche', `Pipeline gesamt: ${Math.round(performance.now() - tStart)}ms, ${trefferzahl} Treffer`);
          if (zuletztProtokollierteSuche.current !== q) {
            zuletztProtokollierteSuche.current = q;
            void protokolliereEreignis({
              typ: 'suche_ausgefuehrt',
              detail: { query: q, trefferanzahl: trefferzahl },
            });
          }
        } catch (err) {
          if (isCancelled()) return;
          if ((err as Error).name === 'AbortError') return;
          console.warn('[useUnifiedSearch] failed:', err);
          setError((err as Error).message ?? 'Suche fehlgeschlagen');
          setResults([]);
          setSearchPhase('error');
          setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      abort.abort();
      clearTimeout(timer);
    };
  }, [query, activeProgrammId, storage, programmNameById, semanticEnabled,
    verknuepfung, stammSuche, bereich, abgewaehlteVarianten, planTeile]);

  const counts = useMemo<UnifiedSearchCounts>(() => {
    let antraege = 0;
    let dokumente = 0;
    for (const r of results) {
      if (r.type === 'antrag') antraege++;
      else dokumente++;
    }
    return { total: results.length, antraege, dokumente };
  }, [results]);

  // Unterprogramm-Code → sprechendes Label aufloesen (Fallback = Code). Bewusst
  // NACH der Streaming-Pipeline als reines Memo, damit der Effekt-Dep-Array
  // unberuehrt bleibt (kein zusaetzlicher Such-Re-Run/Flicker beim Label-Load).
  const resultsWithUnterprogramm = useMemo(() => {
    // Die Suche bleibt IMMER am Vollbestand (Pitfall #46) — sie ist Evidenz,
    // kein Arbeitsvorrat. Damit ein Treffer außerhalb des Anzeigebereichs nicht
    // wie ein Widerspruch zur Liste wirkt, wird er MARKIERT, nicht entfernt.
    if (unterprogrammLabels.size === 0 && bereichMenge === null) return results;
    let changed = false;
    const out = results.map(r => {
      let next = r;
      if (r.unterprogramm) {
        const label = unterprogrammLabels.get(r.unterprogramm);
        if (label && label !== r.unterprogramm) next = { ...next, unterprogramm: label };
      }
      if (bereichMenge !== null && r.unterprogrammCode !== undefined
        && !istImBereich(r.unterprogrammCode, bereichMenge)) {
        next = { ...next, ausserhalbBereich: true };
      }
      if (next !== r) changed = true;
      return next;
    });
    return changed ? out : results;
  }, [results, unterprogrammLabels, bereichMenge]);

  return {
    results: resultsWithUnterprogramm,
    loading,
    error,
    counts,
    indexInfo: { textabschnitteImIndex: documentCount, antraegeGeladen },
    vectorReady,
    searchPhase,
    semanticStatus,
    varianten,
  };
}
