/**
 * Browser-Eval-Runner der Antrag-Aufbereitung (dev-only). Jagt die fiktiven
 * Goldset-Fixtures **sequentiell** über den internen Transport (Streamlit-Bridge)
 * durch die bestehenden Bausteine und misst die Aspekt-Zuordnung gegen das
 * partielle Goldset (Steckbrief nur als Smoke-Test).
 *
 * REIN bis auf den Transport-Aufruf (`runBaustein`) → mit Stub-Transport testbar.
 * KEIN Cache-Kontakt: ruft `buildAspektePrompt`/`buildSteckbriefPrompt` +
 * `runBaustein` + die Parser DIREKT auf — NIE `getOrComputeBaustein`/
 * `computeAspekteBaustein`/`computeSteckbriefBaustein`, kein `idb`, kein `antragKey`,
 * keine Runs. Wirft NIE: jeder Transport-/Parse-Fehler wird zur Ergebniszeile, der
 * Gesamtlauf läuft weiter (Muster `getOrComputeBaustein`-Degradation).
 *
 * DSGVO: der Transport kommt vom Caller ausschließlich über
 * `bridge.getTransportForSkillRun(skill)` (Policy wirft bei externem Provider,
 * Pitfall #30). Die Fixtures sind fiktiv (`loadEvalFixtures`).
 */
import type { AITransport, BridgeZiel } from '@/core/services/ai/transports/streamlit';
import type { ChatResetStatus } from '@/core/services/ai/chat-reset';
import type { SkillRecord } from '@/core/services/skills';
import {
  metriken, fehlzuordnungen, fasseZusammen,
  type AspektMetrik, type AspektZusammenfassung, type Goldset, type GoldFixture,
} from '@/core/services/skill-eval/aspekte-metrik';
import { parseVbGliederung } from '../gliederung';
import { buildAspektePrompt, parseAspektMapping, sektionZuAspekte, aspekteVerdaechtig, type AspektMapping } from '../aspekte';
import { buildSteckbriefPrompt, parseSteckbrief, type SteckbriefDaten } from '../steckbrief';
import { buildZahlenPrompt, parseZahlen, zahlenAntwortDiagnose } from '../zahlen';
import { buildGlossarPrompt, parseGlossar } from '../glossar';
import { runBaustein, ROHTEXT_MAX } from '../bausteine';

/** Minimal-Sicht auf ein Fixture (was der Runner braucht — `loadEvalFixtures()` erfüllt das strukturell). */
export interface EvalFixtureQuelle {
  vbFile: string;
  vbMarkdown: string;
}

export type BausteinParseStatus = 'ok' | 'degradiert' | 'fehler';

/** Anzahl der Steckbrief-Felder (für die Smoke-Quote „N/8"). */
export const STECKBRIEF_FELDER = 8;

export interface AspekteFixtureErgebnis {
  status: BausteinParseStatus;
  /** Nur bei `ok`. */
  metrik?: AspektMetrik;
  /** Nur bei `ok` — menschenlesbare Abweichungen je Gold-Sektion. */
  fehlzuordnungen?: string[];
  /** Roh-Antwort bei `degradiert`. */
  rohtext?: string;
  /** Fehlermeldung bei `fehler` (Transport-/Policy-Wurf). */
  fehler?: string;
  /** Anzahl automatischer Retries (0/undefined = keiner) — Parität zum App-Pfad. */
  retryAnzahl?: number;
  /** Chat-Reset-Status vor dem Aspekte-Lauf (nur bei ok/degradiert — bei `fehler`
   *  warf der Submit vor der Rückgabe). `'nicht-gefunden'`/`'timeout'` markiert (Pitfall #36). */
  chatResetStatus?: ChatResetStatus;
}

export interface SteckbriefSmokeErgebnis {
  status: BausteinParseStatus;
  /** Nur bei `ok`: Anzahl nicht-leerer Felder (0…8) — KEINE Qualitätsmetrik. */
  gefuellteFelder?: number;
  rohtext?: string;
  fehler?: string;
  /** Chat-Reset-Status vor dem Steckbrief-Lauf (nur bei ok/degradiert). */
  chatResetStatus?: ChatResetStatus;
}

export interface ZahlenSmokeErgebnis {
  status: BausteinParseStatus;
  /** Nur bei `ok`: Anzahl Claims (KEINE Qualitätsmetrik). */
  claimAnzahl?: number;
  /** Nur bei `ok`: aus dem JSON gelesene Schema-Version. */
  schemaVersion?: number;
  /** Roh-Antwort bei `degradiert` ODER bei auffälligem `ok` (Tabelle/Truncation) — Diagnose. */
  rohtext?: string;
  fehler?: string;
  /** Diagnose (auch bei `ok`): der JSON-Teil war truncated → Salvage lieferte Teilstand. */
  abgeschnitten?: boolean;
  /** Diagnose (auch bei `ok`): dem JSON ging eine Tabellen-Präambel voraus (frisst Budget). */
  hatTabelle?: boolean;
  /** Chat-Reset-Status vor dem Zahlen-Lauf (nur bei ok/degradiert). */
  chatResetStatus?: ChatResetStatus;
}

export interface GlossarSmokeErgebnis {
  status: BausteinParseStatus;
  /** Nur bei `ok`: Anzahl Begriffe (KEINE Qualitätsmetrik). */
  begriffAnzahl?: number;
  /** Nur bei `ok`: aus dem JSON gelesene Schema-Version. */
  schemaVersion?: number;
  rohtext?: string;
  fehler?: string;
  /** Chat-Reset-Status vor dem Glossar-Lauf (nur bei ok/degradiert). */
  chatResetStatus?: ChatResetStatus;
}

/** Wiederholungs-Kennzahlen eines Fixtures (nur bei n > 1 gesetzt). */
export interface AspekteWiederholungen {
  /** Alle n Aspekte-Läufe (in Laufreihenfolge). */
  laeufe: AspekteFixtureErgebnis[];
  /** Median-F1 über die Läufe (nicht-ok-Läufe zählen als F1 = 0). */
  medianF1: number;
  /** Worst-Case-F1 über die Läufe (Minimum; nicht-ok = 0). */
  worstF1: number;
  /** Wie viele der n Läufe `ok` waren. */
  okAnzahl: number;
}

export interface FixtureErgebnis {
  vbFile: string;
  /** false, wenn kein Fixture zur Goldset-Datei existiert (übersprungen, kein Abbruch). */
  gefunden: boolean;
  dauerMs?: number;
  /** Repräsentativer (Median-)Aspekte-Lauf — bei n = 1 der einzige Lauf. */
  aspekte?: AspekteFixtureErgebnis;
  steckbrief?: SteckbriefSmokeErgebnis;
  zahlen?: ZahlenSmokeErgebnis;
  glossar?: GlossarSmokeErgebnis;
  /** Nur bei n > 1: Einzelwerte + Median/Worst über die Wiederholungen. */
  aspekteWdh?: AspekteWiederholungen;
}

export interface AufbereitungEvalErgebnis {
  fixtures: FixtureErgebnis[];
  /** Aggregat über die repräsentativen (Median-)Aspekte-Läufe (n = 1: die einzigen). */
  zusammenfassung: AspektZusammenfassung;
  /** Aggregat über die Worst-Case-Aspekte-Läufe — nur bei n > 1 gesetzt. */
  zusammenfassungWorst?: AspektZusammenfassung;
  /** Wiederholungen pro Fixture (n, Default 1). */
  wiederholungen: number;
  abgebrochen: boolean;
}

/**
 * Wie viele Fixtures einen MESSBAREN Aspekte-Lauf hatten.
 *
 * Nicht-`ok`-Läufe fließen bewusst nicht ins Aggregat (so wie in der CLI), und
 * `fasseZusammen` liefert auf der leeren Liste den 1er-Fallback. Ohne diese Zahl
 * daneben stand nach einem durchweg gescheiterten Lauf „Mikro-F1 1.000" über
 * lauter roten Fixture-Zeilen (v4.124). Eine Quelle für Panel und Report.
 */
export function gemesseneFixtures(erg: AufbereitungEvalErgebnis): number {
  return erg.fixtures.filter(f => f.aspekte?.status === 'ok').length;
}

export interface EvalDeps {
  aspekteSkill: SkillRecord;
  steckbriefSkill: SkillRecord;
  /** Optional (Paket 4): fehlt er, läuft kein Zahlen-Smoke. */
  zahlenSkill?: SkillRecord;
  /** Optional (v2.219): fehlt er, läuft kein Glossar-Smoke. */
  glossarSkill?: SkillRecord;
  transport: AITransport;
  fixtures: EvalFixtureQuelle[];
  goldset: Goldset;
}

export interface EvalOpts {
  /** Max. Fixtures (aus dem Goldset). Default: alle Goldset-Fixtures. */
  limit?: number;
  /** Steckbrief-Smoke einschließen (Default an). */
  includeSteckbrief?: boolean;
  /** Zahlen-Smoke einschließen (Default an; wirkt nur mit `deps.zahlenSkill`). */
  includeZahlen?: boolean;
  /** Glossar-Smoke einschließen (Default an; wirkt nur mit `deps.glossarSkill`). */
  includeGlossar?: boolean;
  /** Wiederholungen pro Fixture (1…5, Default 1). Aspekte wird n× gefahren (Varianz),
   *  der Steckbrief-Smoke bleibt EIN Lauf pro Fixture. Reset-Invariante gilt pro Einzellauf. */
  wiederholungen?: number;
  /** Ziel-Tab der Streamlit-Bridge (Zweit-LLM-A/B): ohne = Standard-Chat (gpt-oss),
   *  `'agentisch'` = Qwen-Tab (262k). Wird an Reset + Submit jedes Laufs durchgereicht. */
  ziel?: BridgeZiel;
  signal?: AbortSignal;
  onFixtureStart?: (vbFile: string, index: number, total: number) => void;
  onFixtureDone?: (ergebnis: FixtureErgebnis, index: number, total: number) => void;
}

/** Obergrenze der Wiederholungen (Bridge-Zeit begrenzen). */
export const WIEDERHOLUNGEN_MAX = 5;

/** F1 eines Aspekte-Laufs für Median/Worst — nicht-ok zählt als 0. */
function aspekteF1(e: AspekteFixtureErgebnis): number {
  return e.status === 'ok' && e.metrik ? e.metrik.f1 : 0;
}

/** Lower-Median-Index einer nach Wert aufsteigend sortierten Liste der Länge k. */
function medianIndex(k: number): number {
  return Math.floor((k - 1) / 2);
}

function fehlerText(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 500);
}

/** Zählt die nicht-leeren Steckbrief-Felder (Smoke-Quote). */
export function zaehleGefuellteFelder(d: SteckbriefDaten): number {
  let n = 0;
  if (d.einSatz != null) n++;
  if (d.innovation.length > 0) n++;
  if (d.fueGegenstand.length > 0) n++;
  if (d.laufzeit != null) n++;
  if (d.kernZielwert != null) n++;
  if (d.zielmaerkte.length > 0) n++;
  if (d.personal.length > 0) n++;
  if (d.auftraegeDritte.length > 0) n++;
  return n;
}

async function laufAspekte(
  transport: AITransport, skill: SkillRecord,
  gliederung: ReturnType<typeof parseVbGliederung>, vbMarkdown: string,
  sektionIds: string[], gf: GoldFixture, ziel?: BridgeZiel,
): Promise<AspekteFixtureErgebnis> {
  // Spiegelt `getOrComputeBaustein`: leeres Parse-Ergebnis ODER 0 Zuordnungen bei
  // ≥1 Sektion → auffällig → EIN Retry mit frischem Chat (Mess-Parität zum App-Pfad).
  const einLauf = async (): Promise<{ mapping: AspektMapping | null; raw: string; reset: ChatResetStatus } | { fehler: string }> => {
    let raw: string;
    let reset: ChatResetStatus;
    try {
      const r = await runBaustein(transport, skill, buildAspektePrompt(gliederung, vbMarkdown), ziel);
      raw = r.text;
      reset = r.chatResetStatus;
    } catch (e) {
      return { fehler: fehlerText(e) };
    }
    const mapping = parseAspektMapping(raw, sektionIds);
    const leer = Object.keys(mapping.zuordnung).length === 0 && Object.keys(mapping.fehlend).length === 0;
    return { mapping: leer ? null : mapping, raw, reset };
  };
  const istSchlecht = (m: AspektMapping | null): boolean => m == null || aspekteVerdaechtig(m, sektionIds);

  const erster = await einLauf();
  if ('fehler' in erster) return { status: 'fehler', fehler: erster.fehler };
  let { mapping, raw, reset } = erster;
  let retryAnzahl = 0;
  if (istSchlecht(mapping)) {
    retryAnzahl = 1;
    const zweiter = await einLauf();
    if (!('fehler' in zweiter)) ({ mapping, raw, reset } = zweiter);
  }
  if (istSchlecht(mapping)) {
    return { status: 'degradiert', rohtext: raw.slice(0, ROHTEXT_MAX), chatResetStatus: reset, ...(retryAnzahl ? { retryAnzahl } : {}) };
  }
  const pred = sektionZuAspekte(mapping!);
  return {
    status: 'ok',
    metrik: metriken(gf.erwartung, pred),
    fehlzuordnungen: fehlzuordnungen(gf.erwartung, pred),
    chatResetStatus: reset,
    ...(retryAnzahl ? { retryAnzahl } : {}),
  };
}

async function laufSteckbrief(
  transport: AITransport, skill: SkillRecord,
  gliederung: ReturnType<typeof parseVbGliederung>, vbMarkdown: string, sektionIds: string[], ziel?: BridgeZiel,
): Promise<SteckbriefSmokeErgebnis> {
  let raw: string;
  let chatResetStatus: ChatResetStatus;
  try {
    const r = await runBaustein(transport, skill, buildSteckbriefPrompt(gliederung, vbMarkdown), ziel);
    raw = r.text;
    chatResetStatus = r.chatResetStatus;
  } catch (e) {
    return { status: 'fehler', fehler: fehlerText(e) };
  }
  const daten = parseSteckbrief(raw, sektionIds);
  if (daten == null) return { status: 'degradiert', rohtext: raw.slice(0, ROHTEXT_MAX), chatResetStatus };
  return { status: 'ok', gefuellteFelder: zaehleGefuellteFelder(daten), chatResetStatus };
}

async function laufZahlen(
  transport: AITransport, skill: SkillRecord,
  gliederung: ReturnType<typeof parseVbGliederung>, vbMarkdown: string, sektionIds: string[], ziel?: BridgeZiel,
): Promise<ZahlenSmokeErgebnis> {
  let raw: string;
  let chatResetStatus: ChatResetStatus;
  try {
    const r = await runBaustein(transport, skill, buildZahlenPrompt(gliederung, vbMarkdown), ziel);
    raw = r.text;
    chatResetStatus = r.chatResetStatus;
  } catch (e) {
    return { status: 'fehler', fehler: fehlerText(e) };
  }
  const daten = parseZahlen(raw, sektionIds);
  // Diagnose (auch bei ok): Tabellen-Präambel + Truncation erklären dünne/fehlende Claims.
  const { hatTabelle, abgeschnitten } = zahlenAntwortDiagnose(raw);
  const diag = { ...(hatTabelle ? { hatTabelle } : {}), ...(abgeschnitten ? { abgeschnitten } : {}) };
  if (daten == null) return { status: 'degradiert', rohtext: raw.slice(0, ROHTEXT_MAX), chatResetStatus, ...diag };
  // Smoke: parse ok, schemaVersion vorhanden, Claims-Array vorhanden; `parseZahlen`
  // garantiert bereits nicht-leere, katalog-valide sektionIds je Claim. Bei auffälligem ok
  // (Tabelle/Truncation) die Roh-Antwort mitgeben, damit das Panel sie zeigen kann.
  const auffaellig = hatTabelle || abgeschnitten;
  return {
    status: 'ok', claimAnzahl: daten.claims.length, schemaVersion: daten.schemaVersion, chatResetStatus,
    ...diag,
    ...(auffaellig ? { rohtext: raw.slice(0, ROHTEXT_MAX) } : {}),
  };
}

async function laufGlossar(
  transport: AITransport, skill: SkillRecord,
  gliederung: ReturnType<typeof parseVbGliederung>, vbMarkdown: string, sektionIds: string[], ziel?: BridgeZiel,
): Promise<GlossarSmokeErgebnis> {
  let raw: string;
  let chatResetStatus: ChatResetStatus;
  try {
    const r = await runBaustein(transport, skill, buildGlossarPrompt(gliederung, vbMarkdown), ziel);
    raw = r.text;
    chatResetStatus = r.chatResetStatus;
  } catch (e) {
    return { status: 'fehler', fehler: fehlerText(e) };
  }
  const daten = parseGlossar(raw, sektionIds);
  if (daten == null) return { status: 'degradiert', rohtext: raw.slice(0, ROHTEXT_MAX), chatResetStatus };
  // Smoke: parse ok, schemaVersion + Begriffe-Array vorhanden; `parseGlossar` garantiert
  // bereits Begriff+Definition je Eintrag + validierte sektionIds.
  return { status: 'ok', begriffAnzahl: daten.begriffe.length, schemaVersion: daten.schemaVersion, chatResetStatus };
}

/**
 * Fährt den Eval-Batch. Strikt sequentiell (die Bridge ist ein einzelnes
 * postMessage-Fenster, keine parallele API). `signal.aborted` wird zwischen den
 * Läufen geprüft (Abbrechen wirkt zwischen Fixtures, nicht mitten in einem
 * laufenden Bridge-Call).
 */
export async function runAufbereitungEval(deps: EvalDeps, opts: EvalOpts = {}): Promise<AufbereitungEvalErgebnis> {
  const { aspekteSkill, steckbriefSkill, zahlenSkill, glossarSkill, transport, fixtures, goldset } = deps;
  const includeSteckbrief = opts.includeSteckbrief ?? true;
  const includeZahlen = (opts.includeZahlen ?? true) && !!zahlenSkill;
  const includeGlossar = (opts.includeGlossar ?? true) && !!glossarSkill;
  const n = Math.max(1, Math.min(opts.wiederholungen ?? 1, WIEDERHOLUNGEN_MAX));
  const goldFixtures = goldset.fixtures.slice(0, opts.limit);
  const total = goldFixtures.length;

  const ergebnisse: FixtureErgebnis[] = [];
  const medianMetriken: AspektMetrik[] = [];   // repräsentativer Lauf je Fixture
  const worstMetriken: AspektMetrik[] = [];     // Worst-Case-Lauf je Fixture (nur n>1 relevant)
  let abgebrochen = false;

  for (let i = 0; i < total; i++) {
    if (opts.signal?.aborted) { abgebrochen = true; break; }
    const gf = goldFixtures[i]!;
    opts.onFixtureStart?.(gf.vbFile, i, total);
    const start = Date.now();

    const fx = fixtures.find(f => f.vbFile === gf.vbFile);
    if (!fx) {
      const erg: FixtureErgebnis = { vbFile: gf.vbFile, gefunden: false };
      ergebnisse.push(erg);
      opts.onFixtureDone?.(erg, i, total);
      continue;
    }

    const gliederung = parseVbGliederung(fx.vbMarkdown);
    const sektionIds = gliederung.map(s => s.id);

    // Aspekte n× (Varianz-Messung) — jeder Einzellauf resettet den Chat (Pitfall #36).
    const laeufe: AspekteFixtureErgebnis[] = [];
    for (let r = 0; r < n; r++) {
      if (r > 0 && opts.signal?.aborted) break;
      laeufe.push(await laufAspekte(transport, aspekteSkill, gliederung, fx.vbMarkdown, sektionIds, gf, opts.ziel));
    }

    // Median-/Worst-Lauf nach F1 wählen (nicht-ok zählt als 0).
    const sortiert = laeufe.map(e => ({ e, f1: aspekteF1(e) })).sort((a, b) => a.f1 - b.f1);
    const median = sortiert[medianIndex(sortiert.length)]!.e;
    const worst = sortiert[0]!.e;
    if (median.status === 'ok' && median.metrik) medianMetriken.push(median.metrik);
    if (n > 1 && worst.status === 'ok' && worst.metrik) worstMetriken.push(worst.metrik);
    const aspekteWdh: AspekteWiederholungen | undefined = laeufe.length > 1
      ? { laeufe, medianF1: aspekteF1(median), worstF1: aspekteF1(worst), okAnzahl: laeufe.filter(e => e.status === 'ok').length }
      : undefined;

    let steckbrief: SteckbriefSmokeErgebnis | undefined;
    // Steckbrief EIN Smoke-Lauf je Fixture (unabhängig von n). Nach Abbruch nicht mehr starten.
    if (includeSteckbrief && !opts.signal?.aborted) {
      steckbrief = await laufSteckbrief(transport, steckbriefSkill, gliederung, fx.vbMarkdown, sektionIds, opts.ziel);
    }

    let zahlen: ZahlenSmokeErgebnis | undefined;
    // Zahlen EIN Smoke-Lauf je Fixture (analog Steckbrief). Nach Abbruch nicht mehr starten.
    if (includeZahlen && zahlenSkill && !opts.signal?.aborted) {
      zahlen = await laufZahlen(transport, zahlenSkill, gliederung, fx.vbMarkdown, sektionIds, opts.ziel);
    }

    let glossar: GlossarSmokeErgebnis | undefined;
    // Glossar EIN Smoke-Lauf je Fixture (analog Zahlen). Nach Abbruch nicht mehr starten.
    if (includeGlossar && glossarSkill && !opts.signal?.aborted) {
      glossar = await laufGlossar(transport, glossarSkill, gliederung, fx.vbMarkdown, sektionIds, opts.ziel);
    }

    const erg: FixtureErgebnis = {
      vbFile: gf.vbFile, gefunden: true, dauerMs: Date.now() - start,
      aspekte: median, steckbrief, ...(zahlen ? { zahlen } : {}), ...(glossar ? { glossar } : {}), ...(aspekteWdh ? { aspekteWdh } : {}),
    };
    ergebnisse.push(erg);
    opts.onFixtureDone?.(erg, i, total);
  }

  return {
    fixtures: ergebnisse,
    zusammenfassung: fasseZusammen(medianMetriken),
    ...(n > 1 ? { zusammenfassungWorst: fasseZusammen(worstMetriken) } : {}),
    wiederholungen: n,
    // Auch ein Abbruch WÄHREND des letzten Fixtures zählt: `abgebrochen` wurde
    // nur am Schleifenkopf gesetzt, also blieb es `false`, wenn das Signal beim
    // letzten Eintrag kam — der Report las sich dann wie ein vollständiger Lauf,
    // obwohl Steckbrief-, Zahlen- und Glossar-Smoke dieses Fixtures fehlten
    // (v4.124).
    abgebrochen: abgebrochen || opts.signal?.aborted === true,
  };
}
