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
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { SkillRecord } from '@/core/services/skills';
import {
  metriken, fehlzuordnungen, fasseZusammen,
  type AspektMetrik, type AspektZusammenfassung, type Goldset, type GoldFixture,
} from '@/core/services/skill-eval/aspekte-metrik';
import { parseVbGliederung } from '../gliederung';
import { buildAspektePrompt, parseAspektMapping, sektionZuAspekte } from '../aspekte';
import { buildSteckbriefPrompt, parseSteckbrief, type SteckbriefDaten } from '../steckbrief';
import { runBaustein } from '../bausteine';

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
}

export interface SteckbriefSmokeErgebnis {
  status: BausteinParseStatus;
  /** Nur bei `ok`: Anzahl nicht-leerer Felder (0…8) — KEINE Qualitätsmetrik. */
  gefuellteFelder?: number;
  rohtext?: string;
  fehler?: string;
}

export interface FixtureErgebnis {
  vbFile: string;
  /** false, wenn kein Fixture zur Goldset-Datei existiert (übersprungen, kein Abbruch). */
  gefunden: boolean;
  dauerMs?: number;
  aspekte?: AspekteFixtureErgebnis;
  steckbrief?: SteckbriefSmokeErgebnis;
}

export interface AufbereitungEvalErgebnis {
  fixtures: FixtureErgebnis[];
  /** Aggregat NUR über erfolgreich gemessene Aspekte-Läufe. */
  zusammenfassung: AspektZusammenfassung;
  abgebrochen: boolean;
}

export interface EvalDeps {
  aspekteSkill: SkillRecord;
  steckbriefSkill: SkillRecord;
  transport: AITransport;
  fixtures: EvalFixtureQuelle[];
  goldset: Goldset;
}

export interface EvalOpts {
  /** Max. Fixtures (aus dem Goldset). Default: alle Goldset-Fixtures. */
  limit?: number;
  /** Steckbrief-Smoke einschließen (Default an). */
  includeSteckbrief?: boolean;
  signal?: AbortSignal;
  onFixtureStart?: (vbFile: string, index: number, total: number) => void;
  onFixtureDone?: (ergebnis: FixtureErgebnis, index: number, total: number) => void;
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
  sektionIds: string[], gf: GoldFixture,
): Promise<AspekteFixtureErgebnis> {
  let raw: string;
  try {
    raw = await runBaustein(transport, skill, buildAspektePrompt(gliederung, vbMarkdown));
  } catch (e) {
    return { status: 'fehler', fehler: fehlerText(e) };
  }
  const mapping = parseAspektMapping(raw, sektionIds);
  const leer = Object.keys(mapping.zuordnung).length === 0 && Object.keys(mapping.fehlend).length === 0;
  if (leer) return { status: 'degradiert', rohtext: raw };
  const pred = sektionZuAspekte(mapping);
  return { status: 'ok', metrik: metriken(gf.erwartung, pred), fehlzuordnungen: fehlzuordnungen(gf.erwartung, pred) };
}

async function laufSteckbrief(
  transport: AITransport, skill: SkillRecord,
  gliederung: ReturnType<typeof parseVbGliederung>, vbMarkdown: string, sektionIds: string[],
): Promise<SteckbriefSmokeErgebnis> {
  let raw: string;
  try {
    raw = await runBaustein(transport, skill, buildSteckbriefPrompt(gliederung, vbMarkdown));
  } catch (e) {
    return { status: 'fehler', fehler: fehlerText(e) };
  }
  const daten = parseSteckbrief(raw, sektionIds);
  if (daten == null) return { status: 'degradiert', rohtext: raw };
  return { status: 'ok', gefuellteFelder: zaehleGefuellteFelder(daten) };
}

/**
 * Fährt den Eval-Batch. Strikt sequentiell (die Bridge ist ein einzelnes
 * postMessage-Fenster, keine parallele API). `signal.aborted` wird zwischen den
 * Läufen geprüft (Abbrechen wirkt zwischen Fixtures, nicht mitten in einem
 * laufenden Bridge-Call).
 */
export async function runAufbereitungEval(deps: EvalDeps, opts: EvalOpts = {}): Promise<AufbereitungEvalErgebnis> {
  const { aspekteSkill, steckbriefSkill, transport, fixtures, goldset } = deps;
  const includeSteckbrief = opts.includeSteckbrief ?? true;
  const goldFixtures = goldset.fixtures.slice(0, opts.limit);
  const total = goldFixtures.length;

  const ergebnisse: FixtureErgebnis[] = [];
  const aspektMetriken: AspektMetrik[] = [];
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

    const aspekte = await laufAspekte(transport, aspekteSkill, gliederung, fx.vbMarkdown, sektionIds, gf);
    if (aspekte.status === 'ok' && aspekte.metrik) aspektMetriken.push(aspekte.metrik);

    let steckbrief: SteckbriefSmokeErgebnis | undefined;
    // Nach dem ersten Bridge-Call erneut prüfen: kein zweiter Call nach Abbruch.
    if (includeSteckbrief && !opts.signal?.aborted) {
      steckbrief = await laufSteckbrief(transport, steckbriefSkill, gliederung, fx.vbMarkdown, sektionIds);
    }

    const erg: FixtureErgebnis = { vbFile: gf.vbFile, gefunden: true, dauerMs: Date.now() - start, aspekte, steckbrief };
    ergebnisse.push(erg);
    opts.onFixtureDone?.(erg, i, total);
  }

  return { fixtures: ergebnisse, zusammenfassung: fasseZusammen(aspektMetriken), abgebrochen };
}
