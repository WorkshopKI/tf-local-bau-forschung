/**
 * Globaler Antraege-Cache fuer das Auslastungs-Modul + Einstellungen-Tab
 * "Meine Technologien".
 *
 * Architektur: Modul-globaler Zustand-Store + Hook-Wrapper, NICHT pro-Komponente
 * `useState`. So bezahlt nur der erste Konsument den IDB-Read, alle
 * nachfolgenden Konsumenten (z.B. Tab-Switches in den Einstellungen) sehen die
 * Daten sofort.
 *
 * **v2.63 — Slim-Cache:** Der Cache haelt NICHT mehr die vollen ~13k
 * `Antrag`-Records (~450 MB Heap, frueher der groesste Einzelposten des
 * pl-RAM-Sockels), sondern:
 *  1. die **Slim-Projektion** (`AntragListItem[]`, inkl. der v2-Felder t_hint/
 *     d_xtec/d_adv/tib_mail/verbund_titel) — traegt Listen, Filter, Quartals-
 *     Auslastung, Kuerzel-Sync;
 *  2. **Stream-Artefakte** aus EINER Cursor-Passage ueber die vollen Records
 *     (`forEachAntragByProgramm`, keine Array-Retention): `deskriptorenByAz`,
 *     `ztKlartexteByAz` (Stage-0/1-Klassifizierung), `embeddableAz`
 *     (Korpus-Hash MUSS aus vollen Records stammen — Self-Heal-Integritaet),
 *     `xtecAzSet`/`advAzSet` (Vollstaendigkeits-Gate mit den ueber das
 *     CSV-Schema AUFGELOESTEN Feldern — custom-Mappings!).
 * Schwere Texte (`projektbeschreibung_text`) bleiben in der IDB und werden
 * on-demand per `getAntrag`-Point-Read geholt (Cockpit-Detail, Export).
 *
 * v2.13: Aggregate (`anonymMap`, `verbuendeById`, `historische*ByAnon`,
 * `allDeskriptoren`) wohnen im Store — Single-Pass genau einmal pro
 * Daten-Load, ref-stable ueber Re-Mounts. Seit v2.63 werden sie in-memory aus
 * (Slim + deskriptorenByAz + kuerzelMap) abgeleitet — eine spaet ankommende
 * kuerzel-map re-derived OHNE erneuten Stream (`aggregatesKey` nutzt den
 * `streamToken` als Identitaet).
 *
 * Invalidierungs-Regeln:
 *  - Wechsel von `activeProgrammId` → Cache wird verworfen + neu geladen.
 *  - Externe Mutationen (CSV-Import, Antrag-Edit): Caller muss explizit
 *    `invalidateAntraegeCache()` aufrufen oder `cache.refresh()` triggern.
 *  - KuerzelMap-Append (neuer TIB): `ensureAggregates()` rechnet die Aggregate
 *    via Key-Vergleich nach.
 */
import { useCallback, useEffect } from 'react';
import { create } from 'zustand';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import {
  forEachAntragChunkByProgramm,
  listAntraegeListViewByProgramm,
  listSchemasByProgramm,
  listVerbuendeByProgramm,
} from '@/core/services/csv/idb-csv';
import { SYNC_VERSION_KEY } from '@/core/services/csv/snapshot-keys';
import { parseGermanDate } from '@/core/services/csv/dateParse';
import type { AntragListItem, Verbund } from '@/core/services/csv/types';
import type { StorageService } from '@/core/services/storage';
import { type AnonymMap } from '../services/anonym-map';
import { buildAnonymMapFromKuerzelMap, type KuerzelMapFile } from '../services/kuerzel-map';
import { useKuerzelMap } from './useKuerzelMap';
import {
  aggregateAntragCountByAnon,
  aggregateAstByAnon,
  aggregateMaProfilesByAnonFromLookup,
  collectAllDeskriptorenMitCountFromLookup,
  readAntragDeskriptorenMitZt,
  readTruthyZtKlartexte,
} from '../services/profil-aggregator';
import { isEmbeddableAntrag } from '../services/embedding-corpus';
import {
  resolveVollstaendigkeitsFelder,
  DEFAULT_VOLLSTAENDIGKEITS_FELDER,
} from '../services/vollstaendigkeit-felder';

export interface AntraegeCache {
  /** Slim-Projektion (v2.63) — Listen/Filter/Aggregation. Volle Records bei
   *  Bedarf per `getAntrag`-Point-Read. */
  antraege: AntragListItem[];
  /** Raw-Array aus dem Store — ref-stable ueber Re-Mount (im Gegensatz zu
   *  `verbuendeById`, das durch useMemo geht). Konsumenten, die Closure-
   *  Caches keyen, nutzen DIESE Property. */
  verbuende: Verbund[];
  /** Pro `verbund_id` das Verbund-Objekt aus dem `verbuende`-IDB-Store. */
  verbuendeById: Map<string, Verbund>;
  loading: boolean;
  loaded: boolean;
  /** True sobald die Stream-Passage (Deskriptoren/ZT/Embeddable/Gate-Sets)
   *  fuer den aktuellen Stand durch ist. Matching/Klassifizierung erst dann
   *  starten (sonst leere historische*-Maps, Bug-Klasse v2.46.1). */
  aggregatesLoaded: boolean;
  error: string | null;
  anonymMap: AnonymMap;
  historischeDeskriptorenByAnon: Map<string, string[]>;
  /** Pro anonId: AST-Name (lower+trim) → Anzahl bearbeiteter Antraege. */
  historischeAstByAnon: Map<string, Map<string, number>>;
  /** Pro anonId: Gesamtzahl bearbeiteter historischer Antraege. */
  historischeAntraegeCountByAnon: Map<string, number>;
  allDeskriptoren: Array<{ wert: string; count: number }>;
  /** Stream-Artefakte (v2.63) — pro Aktenzeichen vorberechnete Daten aus den
   *  vollen Records (siehe Header). */
  deskriptorenByAz: ReadonlyMap<string, readonly string[]>;
  ztKlartexteByAz: ReadonlyMap<string, readonly string[]>;
  embeddableAz: readonly string[];
  xtecAzSet: ReadonlySet<string>;
  advAzSet: ReadonlySet<string>;
  refresh: () => Promise<void>;
}

// Stabile Default-Refs fuer den leeren Anfangszustand — vermeidet
// unnoetige Re-Renders durch neue Object/Map-Identitaeten bei jedem Reset.
const EMPTY_ANONYM_MAP: AnonymMap = { toAnon: new Map(), toReal: new Map() };
const EMPTY_VERBUEND_BY_ID: ReadonlyMap<string, Verbund> = new Map();
const EMPTY_DESKR_BY_ANON: ReadonlyMap<string, string[]> = new Map();
const EMPTY_AST_BY_ANON: ReadonlyMap<string, Map<string, number>> = new Map();
const EMPTY_COUNT_BY_ANON: ReadonlyMap<string, number> = new Map();
const EMPTY_DESKR_LIST: ReadonlyArray<{ wert: string; count: number }> = [];
const EMPTY_BY_AZ: ReadonlyMap<string, readonly string[]> = new Map();
const EMPTY_AZ_LIST: readonly string[] = [];
const EMPTY_AZ_SET: ReadonlySet<string> = new Set();

interface StreamArtefakte {
  deskriptorenByAz: ReadonlyMap<string, readonly string[]>;
  ztKlartexteByAz: ReadonlyMap<string, readonly string[]>;
  embeddableAz: readonly string[];
  xtecAzSet: ReadonlySet<string>;
  advAzSet: ReadonlySet<string>;
}

const EMPTY_ARTEFAKTE: StreamArtefakte = {
  deskriptorenByAz: EMPTY_BY_AZ,
  ztKlartexteByAz: EMPTY_BY_AZ,
  embeddableAz: EMPTY_AZ_LIST,
  xtecAzSet: EMPTY_AZ_SET,
  advAzSet: EMPTY_AZ_SET,
};

interface CacheStoreState extends StreamArtefakte {
  antraege: AntragListItem[];
  verbuende: Verbund[];
  loading: boolean;
  loaded: boolean;
  aggregatesLoaded: boolean;
  error: string | null;
  /** Programm-ID des aktuell gecachten States. null = nichts geladen. */
  cachedProgrammId: string | null;
  /** Laufende Refresh-Promise zum Dedupe paralleler Aufrufe. */
  refreshing: Promise<void> | null;
  // Aggregate (v2.13) — berechnet im refresh() oder via ensureAggregates().
  anonymMap: AnonymMap;
  verbuendeById: Map<string, Verbund>;
  historischeDeskriptorenByAnon: Map<string, string[]>;
  historischeAstByAnon: Map<string, Map<string, number>>;
  historischeAntraegeCountByAnon: Map<string, number>;
  allDeskriptoren: Array<{ wert: string; count: number }>;
  /** Key der zuletzt berechneten Aggregate. Null = noch nichts. */
  aggregatesKey: string | null;
  /** Bumpt pro abgeschlossenem Stream — Identitaet des Antrags-Stands fuer
   *  den aggregatesKey (Laenge allein erkennt einen Re-Import gleicher
   *  Groesse nicht). */
  streamToken: number;
  /** Snapshot-Version (`snapshot-version-<programmId>`), gegen die der Cache
   *  geladen wurde. Weicht die IDB-Version davon ab (CSV-Refresh / Cross-User-
   *  Snapshot-Pull), lädt der Cache neu — ohne App-Reload (v2.26.x). */
  cachedSnapshotVersion: string | null;
  /** Loesst den Refresh aus; idempotent fuer dieselbe programmId. */
  refresh: (storage: StorageService, programmId: string | null) => Promise<void>;
  /** Externe Invalidierung (CSV-Re-Import, Antrag-Edit). */
  invalidate: () => void;
  /** Berechnet die Aggregate neu, wenn sich die Eingaben geaendert haben
   *  (streamToken, verbuende, kuerzelMapFile). No-op sonst. */
  ensureAggregates: () => void;
}

function buildAggregatesKey(
  programmId: string | null,
  streamToken: number,
  antraege: AntragListItem[],
  verbuende: Verbund[],
  kuerzelMapFile: KuerzelMapFile,
): string {
  return `${programmId ?? '∅'}|${streamToken}|${antraege.length}|${verbuende.length}|${kuerzelMapFile.entries.length}|${kuerzelMapFile.updatedAt}`;
}

/** Aggregate in-memory aus Slim + Stream-Artefakten ableiten (kein IDB). */
function deriveAggregates(
  antraege: AntragListItem[],
  verbuende: Verbund[],
  deskriptorenByAz: ReadonlyMap<string, readonly string[]>,
  kuerzelMapFile: KuerzelMapFile,
): {
  anonymMap: AnonymMap;
  verbuendeById: Map<string, Verbund>;
  historischeDeskriptorenByAnon: Map<string, string[]>;
  historischeAstByAnon: Map<string, Map<string, number>>;
  historischeAntraegeCountByAnon: Map<string, number>;
  allDeskriptoren: Array<{ wert: string; count: number }>;
} {
  const anonymMap = buildAnonymMapFromKuerzelMap(kuerzelMapFile);
  return {
    anonymMap,
    verbuendeById: new Map(verbuende.map(v => [v.verbund_id, v])),
    historischeDeskriptorenByAnon: aggregateMaProfilesByAnonFromLookup(antraege, anonymMap, deskriptorenByAz),
    historischeAstByAnon: aggregateAstByAnon(antraege, anonymMap),
    historischeAntraegeCountByAnon: aggregateAntragCountByAnon(antraege, anonymMap),
    allDeskriptoren: collectAllDeskriptorenMitCountFromLookup(deskriptorenByAz),
  };
}

/**
 * EINE Passage ueber die vollen Records des Programms — extrahiert alle
 * Daten, die NUR dort stehen, ohne die Records zu behalten.
 *
 * v2.63.1: gechunkte Bulk-Reads (`forEachAntragChunkByProgramm`) statt
 * per-Record-Cursor — der Cursor kostete pro Record einen IDB-Roundtrip
 * (~46 s bei 14k auf pl-Echtdaten), Bulk-getAll in 500er-Chunks liefert
 * dieselben Records in Sekunden bei ~18 MB Peak pro Chunk. Zudem laeuft der
 * teure ZT-Kandidaten-Scan (~600 Probes/Record) nur noch EINMAL pro Record
 * (`readTruthyZtKlartexte` → `readAntragDeskriptorenMitZt`). Strings werden
 * interned (frische Instanzen aus der Deserialisierung — ohne Interning
 * entstuenden zigtausend Duplikate der immergleichen Deskriptoren).
 */
async function streamArtefakte(
  storage: StorageService,
  programmId: string,
): Promise<StreamArtefakte> {
  const schemas = await listSchemasByProgramm(storage.idb, programmId).catch(() => []);
  const felder = schemas.length > 0
    ? resolveVollstaendigkeitsFelder(schemas)
    : DEFAULT_VOLLSTAENDIGKEITS_FELDER;

  const intern = new Map<string, string>();
  const internStr = (s: string): string => {
    const hit = intern.get(s);
    if (hit !== undefined) return hit;
    intern.set(s, s);
    return s;
  };

  const deskriptorenByAz = new Map<string, readonly string[]>();
  const ztKlartexteByAz = new Map<string, readonly string[]>();
  const embeddableAz: string[] = [];
  const xtecAzSet = new Set<string>();
  const advAzSet = new Set<string>();

  await forEachAntragChunkByProgramm(storage.idb, programmId, records => {
    for (const a of records) {
      const rec = a as Record<string, unknown>;
      const zt = readTruthyZtKlartexte(rec);
      if (zt.length > 0) ztKlartexteByAz.set(a.aktenzeichen, zt);
      const desk = readAntragDeskriptorenMitZt(rec, zt);
      if (desk.length > 0) deskriptorenByAz.set(a.aktenzeichen, desk.map(internStr));
      if (isEmbeddableAntrag(a)) embeddableAz.push(a.aktenzeichen);
      const xv = rec[felder.xtecFeld];
      if (typeof xv === 'string' && parseGermanDate(xv) !== null) xtecAzSet.add(a.aktenzeichen);
      const av = rec[felder.advFeld];
      if (typeof av === 'string' && parseGermanDate(av) !== null) advAzSet.add(a.aktenzeichen);
    }
  });

  return { deskriptorenByAz, ztKlartexteByAz, embeddableAz, xtecAzSet, advAzSet };
}

const useCacheStore = create<CacheStoreState>((set, get) => ({
  antraege: [],
  verbuende: [],
  loading: false,
  loaded: false,
  aggregatesLoaded: false,
  error: null,
  cachedProgrammId: null,
  refreshing: null,
  anonymMap: EMPTY_ANONYM_MAP,
  verbuendeById: EMPTY_VERBUEND_BY_ID as Map<string, Verbund>,
  historischeDeskriptorenByAnon: EMPTY_DESKR_BY_ANON as Map<string, string[]>,
  historischeAstByAnon: EMPTY_AST_BY_ANON as Map<string, Map<string, number>>,
  historischeAntraegeCountByAnon: EMPTY_COUNT_BY_ANON as Map<string, number>,
  allDeskriptoren: EMPTY_DESKR_LIST as Array<{ wert: string; count: number }>,
  ...EMPTY_ARTEFAKTE,
  aggregatesKey: null,
  streamToken: 0,
  cachedSnapshotVersion: null,
  refresh: async (storage, programmId) => {
    const s = get();
    // Hit: gleiche programmId schon geladen → no-op.
    if (programmId === s.cachedProgrammId && s.loaded && !s.error) return;
    // Dedupe: schon ein Refresh in-flight → an dessen Promise haengen.
    if (s.refreshing) {
      await s.refreshing;
      return;
    }
    if (!programmId) {
      set({
        antraege: [],
        verbuende: [],
        loaded: true,
        aggregatesLoaded: true,
        error: null,
        cachedProgrammId: null,
        anonymMap: EMPTY_ANONYM_MAP,
        verbuendeById: EMPTY_VERBUEND_BY_ID as Map<string, Verbund>,
        historischeDeskriptorenByAnon: EMPTY_DESKR_BY_ANON as Map<string, string[]>,
        historischeAstByAnon: EMPTY_AST_BY_ANON as Map<string, Map<string, number>>,
        historischeAntraegeCountByAnon: EMPTY_COUNT_BY_ANON as Map<string, number>,
        allDeskriptoren: EMPTY_DESKR_LIST as Array<{ wert: string; count: number }>,
        ...EMPTY_ARTEFAKTE,
        aggregatesKey: null,
        cachedSnapshotVersion: null,
      });
      return;
    }
    const promise = (async () => {
      set({ loading: true, error: null });
      try {
        // Always-on-Timing (v2.62.5): Warmup-Dauer sichtbar machen
        // (Citrix-Diagnose, Console statt build-stummem tfPerf).
        const t0 = performance.now();
        // Phase 1: Slim-Projektion + Verbuende parallel (kleine IDB-Reads) —
        // Listen/Dashboards rendern sofort, ohne auf den Stream zu warten.
        const [slimAntraege, allVerbuende] = await Promise.all([
          listAntraegeListViewByProgramm(storage.idb, programmId),
          listVerbuendeByProgramm(storage.idb, programmId),
        ]);
        // Snapshot-Version mitlesen, gegen die geladen wird — damit ein
        // späterer CSV-Refresh (neue Version in der IDB) erkannt wird.
        const snapshotVersion =
          (await storage.idb.get<string>(SYNC_VERSION_KEY(programmId)).catch(() => null)) ?? null;
        set({
          antraege: slimAntraege,
          verbuende: allVerbuende,
          loaded: true,
          loading: false,
          aggregatesLoaded: false,
          error: null,
          cachedProgrammId: programmId,
          cachedSnapshotVersion: snapshotVersion,
          // Artefakte des VORHERIGEN Stands sofort verwerfen (Programm-Wechsel:
          // sonst mischen sich bis zum Stream-Ende alte Deskriptoren mit neuen
          // Slim-Records in ensureAggregates).
          ...EMPTY_ARTEFAKTE,
        });
        console.info(`[auslastung] cache.refresh: ${slimAntraege.length} Anträge (slim) in ${Math.round(performance.now() - t0)} ms`);

        // Phase 2: Stream-Passage ueber die vollen Records (Cursor, keine
        // Retention) — Deskriptoren/ZT/Embeddable/Gate-Sets.
        const tStream = performance.now();
        const artefakte = await streamArtefakte(storage, programmId);
        set(prev => ({
          ...artefakte,
          aggregatesLoaded: true,
          streamToken: prev.streamToken + 1,
        }));
        console.info(`[auslastung] cache.stream: ${artefakte.deskriptorenByAz.size} Antraege mit Deskriptoren, ${artefakte.embeddableAz.length} embeddable in ${Math.round(performance.now() - tStream)} ms`);
        // Aggregate ableiten (in-memory) — falls die kuerzel-map noch nicht
        // da ist, holt ensureAggregates() das im Hook-useEffect nach.
        get().ensureAggregates();
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : String(err),
          loading: false,
          refreshing: null,
        });
      } finally {
        set({ refreshing: null });
      }
    })();
    set({ refreshing: promise });
    await promise;
  },
  invalidate: () => {
    set({
      antraege: [],
      verbuende: [],
      loaded: false,
      aggregatesLoaded: false,
      cachedProgrammId: null,
      error: null,
      anonymMap: EMPTY_ANONYM_MAP,
      verbuendeById: EMPTY_VERBUEND_BY_ID as Map<string, Verbund>,
      historischeDeskriptorenByAnon: EMPTY_DESKR_BY_ANON as Map<string, string[]>,
      historischeAstByAnon: EMPTY_AST_BY_ANON as Map<string, Map<string, number>>,
      historischeAntraegeCountByAnon: EMPTY_COUNT_BY_ANON as Map<string, number>,
      allDeskriptoren: EMPTY_DESKR_LIST as Array<{ wert: string; count: number }>,
      ...EMPTY_ARTEFAKTE,
      aggregatesKey: null,
      cachedSnapshotVersion: null,
    });
  },
  ensureAggregates: () => {
    const s = get();
    if (!s.loaded) return;
    const kuerzelState = useKuerzelMap.getState();
    if (!kuerzelState.loaded) return;
    const kuerzelMapFile = kuerzelState.file;
    const nextKey = buildAggregatesKey(s.cachedProgrammId, s.streamToken, s.antraege, s.verbuende, kuerzelMapFile);
    if (nextKey === s.aggregatesKey) return; // no-op
    const agg = deriveAggregates(s.antraege, s.verbuende, s.deskriptorenByAz, kuerzelMapFile);
    set({ ...agg, aggregatesKey: nextKey });
  },
}));

/** Externer Trigger fuer Cache-Invalidierung (z.B. nach CSV-Import). */
export function invalidateAntraegeCache(): void {
  useCacheStore.getState().invalidate();
}

/** Test-only: direkter Store-Zugriff (die App geht ueber den Hook). */
export const useCacheStoreForTests = useCacheStore;

/** Externer Trigger fuer Antraege-Cache-Warmup, z.B. aus dem Auslastung-
 *  Plugin-onInit. Idempotent — nutzt den `refresh()`-Hit-Check intern. */
export async function warmupAntraegeCache(
  storage: StorageService,
  programmId: string | null,
): Promise<void> {
  await useCacheStore.getState().refresh(storage, programmId);
}

/** Reine Entscheidung: weicht die IDB-Snapshot-Version von der gecachten ab? */
export function needsSnapshotRefresh(current: string | null, cached: string | null): boolean {
  return current !== cached;
}

const SNAPSHOT_REFRESH_INTERVAL_MS = 90_000;

/**
 * Hält den Auslastungs-Antraege-Cache nach einem CSV-Refresh aktuell — OHNE
 * App-Reload. Vergleicht die aktuelle IDB-Snapshot-Version
 * (`snapshot-version-<programmId>`, gesetzt von `importCsvSource`/`syncProgrammSnapshot`
 * NACH dem frischen IDB-Write) mit der Version, gegen die der Cache geladen wurde;
 * bei Abweichung wird invalidiert + neu gewarmt (idempotent, `refreshing`-Dedupe).
 *
 * Geprüft wird beim Mount, bei `visibilitychange`(visible)/`focus` und über ein
 * leichtes Intervall (Fallback für den Zwei-Monitor-Fall, in dem das Modul
 * dauerhaft sichtbar bleibt). Reine Lese-Aktualisierung — `auslastung.json`
 * (Config/MAs/Klassifizierungen/Zuweisungen) bleibt unberührt; eine
 * Klassifizierung wird NICHT automatisch angestoßen. Einmal pro Modul gemountet
 * (in `AuslastungView`).
 */
export function useAntraegeCacheSnapshotRefresh(): void {
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);

  useEffect(() => {
    if (!activeProgrammId) return;
    let cancelled = false;

    const checkAndRefresh = async (): Promise<void> => {
      if (cancelled || document.visibilityState !== 'visible') return;
      const s = useCacheStore.getState();
      // Nicht waehrend laufendem (Erst-)Load — sonst Race mit dem Warmup.
      if (!s.loaded || s.loading || s.refreshing) return;
      const current =
        (await storage.idb.get<string>(SYNC_VERSION_KEY(activeProgrammId)).catch(() => null)) ?? null;
      if (cancelled) return;
      if (!needsSnapshotRefresh(current, s.cachedSnapshotVersion)) return;
      invalidateAntraegeCache();
      await warmupAntraegeCache(storage, activeProgrammId);
    };

    void checkAndRefresh();
    const onVisible = (): void => { void checkAndRefresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    const timer = setInterval(() => { void checkAndRefresh(); }, SNAPSHOT_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      clearInterval(timer);
    };
  }, [storage, activeProgrammId]);
}

export function useAntraegeCache(): AntraegeCache {
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const antraege = useCacheStore(s => s.antraege);
  const verbuende = useCacheStore(s => s.verbuende);
  const loading = useCacheStore(s => s.loading);
  const loaded = useCacheStore(s => s.loaded);
  const aggregatesLoaded = useCacheStore(s => s.aggregatesLoaded);
  const error = useCacheStore(s => s.error);
  const refreshAction = useCacheStore(s => s.refresh);
  const cachedProgrammId = useCacheStore(s => s.cachedProgrammId);
  // v2.13: Aggregate direkt aus dem Store, nicht mehr ueber useMemo-Kaskade
  // pro Hook-Instanz. Ref-stable ueber Re-Mounts.
  const anonymMap = useCacheStore(s => s.anonymMap);
  const verbuendeById = useCacheStore(s => s.verbuendeById);
  const historischeDeskriptorenByAnon = useCacheStore(s => s.historischeDeskriptorenByAnon);
  const historischeAstByAnon = useCacheStore(s => s.historischeAstByAnon);
  const historischeAntraegeCountByAnon = useCacheStore(s => s.historischeAntraegeCountByAnon);
  const allDeskriptoren = useCacheStore(s => s.allDeskriptoren);
  const deskriptorenByAz = useCacheStore(s => s.deskriptorenByAz);
  const ztKlartexteByAz = useCacheStore(s => s.ztKlartexteByAz);
  const embeddableAz = useCacheStore(s => s.embeddableAz);
  const xtecAzSet = useCacheStore(s => s.xtecAzSet);
  const advAzSet = useCacheStore(s => s.advAzSet);
  const ensureAggregates = useCacheStore(s => s.ensureAggregates);

  const kuerzelMapFile = useKuerzelMap(s => s.file);
  const kuerzelMapLoaded = useKuerzelMap(s => s.loaded);
  const loadKuerzelMap = useKuerzelMap(s => s.load);
  const syncKuerzelMap = useKuerzelMap(s => s.syncWithAntraege);

  const refresh = useCallback(async (): Promise<void> => {
    await refreshAction(storage, activeProgrammId);
  }, [refreshAction, storage, activeProgrammId]);

  // Initial-Load + Programm-Wechsel: nur loesen wenn Cache leer oder
  // programmId verschieden. Doppelaufrufe von parallelen Konsumenten werden
  // im Store deduped.
  useEffect(() => {
    if (activeProgrammId === cachedProgrammId && loaded && !error) return;
    void refresh();
  }, [refresh, activeProgrammId, cachedProgrammId, loaded, error]);

  // Lazy-load der persistenten Kuerzel-Map beim ersten Render.
  useEffect(() => {
    if (!kuerzelMapLoaded) void loadKuerzelMap(storage);
  }, [kuerzelMapLoaded, loadKuerzelMap, storage]);

  // Sync der Kuerzel-Map mit den geladenen Antraegen (Bootstrap falls leer,
  // sonst Append neuer Kuerzel). Idempotent — kein Write wenn nichts neu.
  // Slim reicht: gelesen wird nur `tib_kuerz` (akzeptiert die Union).
  useEffect(() => {
    if (!loaded || !kuerzelMapLoaded || antraege.length === 0) return;
    void syncKuerzelMap(storage, antraege).catch(err => {
      console.warn('[useAntraegeCache] kuerzel-map sync fehlgeschlagen:', err);
    });
  }, [loaded, kuerzelMapLoaded, antraege, storage, syncKuerzelMap]);

  // Aggregate-Trigger: rechnet nach, wenn Stream-Stand oder kuerzelMapFile
  // sich aendern. Beim Re-Mount sind die Refs stabil → ensureAggregates
  // checked den Key und macht no-op.
  useEffect(() => {
    ensureAggregates();
  }, [ensureAggregates, antraege, verbuende, kuerzelMapFile, loaded, kuerzelMapLoaded, aggregatesLoaded]);

  return {
    antraege,
    verbuende,
    verbuendeById,
    loading,
    loaded,
    aggregatesLoaded,
    error,
    anonymMap,
    historischeDeskriptorenByAnon,
    historischeAstByAnon,
    historischeAntraegeCountByAnon,
    allDeskriptoren,
    deskriptorenByAz,
    ztKlartexteByAz,
    embeddableAz,
    xtecAzSet,
    advAzSet,
    refresh,
  };
}
