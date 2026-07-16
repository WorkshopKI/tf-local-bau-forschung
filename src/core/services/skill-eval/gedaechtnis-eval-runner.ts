/**
 * Geteilte, node-freie Orchestrierung der Gedächtnis-Eval (Assistent Phase 2).
 *
 * Single-Source der inneren Läufe-Logik, die BEIDE Konsumenten teilen — der
 * node-gebundene CLI-Wrapper (`gedaechtnis-eval.ts`) UND das In-App-Eval-Panel.
 * So können Zeilen-Shape (JSONL-Felder), Assertions-Aufbereitung und Judge-Aufruf
 * nicht auseinanderdriften. Der äußere Rahmen (Console/Datei/Exit vs. React-State/
 * Callbacks) bleibt beim jeweiligen Konsumenten.
 *
 * Läuft strikt sequentiell (die Bridge ist ein einzelnes postMessage-Fenster); die
 * Provenienz (nur FIKTIVE Fixtures) wird vor dem ersten Lauf hart geprüft.
 */
import type { AITransport, BridgeZiel } from '@/core/services/ai/transports/streamlit';
import { frischeIdFabrik, laufeFixture, type FixtureLaufErgebnis } from './gedaechtnis-eval-lib';
import { pruefeAssertions } from './gedaechtnis-assertions';
import type { GedaechtnisFixture, Szenario, AssertionErgebnis } from './gedaechtnis-assertions';
import { GEDAECHTNIS_FIXTURES } from './gedaechtnis-fixtures';
import { buildJudgePrompt, runJudge, mittel, type JudgeScore } from './gedaechtnis-judge';

/** Ein JSONL-Datensatz je (Fixture, Lauf) — EXAKT die Felder, die die CLI schreibt. */
export interface EvalZeile {
  fixture: string;
  szenario: Szenario;
  run: number;
  aktive: number;
  assertionsOk: boolean;
  assertionsFehler: string[];
  judge?: JudgeScore;
}

/** Aggregat je Fixture (Anzeige + Report). */
export interface FixtureAggregat {
  id: string;
  szenario: Szenario;
  okLaeufe: number;
  n: number;
  judgeF?: number;
  judgeN?: number;
  /** Läufe, deren Judge-Antwort nicht als JSON parsebar war — aus dem Mittel genommen
   *  (sonst zögen Parse-Fehler-Nullen den Schnitt künstlich nach unten). */
  judgeFehler?: number;
  /** Verletzungen des ersten fehlgeschlagenen Laufs (Beispiel für den Report). */
  beispielVerletzung?: string[];
}

/** Failing-Assertions als kompakte `name(detail)`-Strings (eine Quelle für CLI + Panel). */
export function assertionsFehlerListe(assertions: AssertionErgebnis[]): string[] {
  return assertions.filter(a => !a.ok).map(a => `${a.name}(${a.detail ?? ''})`);
}

/** Baut den JSONL-Datensatz — die EINZIGE Quelle der Feld-Form (Vergleichbarkeit). */
export function baueEvalZeile(
  fx: GedaechtnisFixture,
  run: number,
  lauf: FixtureLaufErgebnis,
  fehler: string[],
  judge?: JudgeScore,
): EvalZeile {
  return {
    fixture: fx.id,
    szenario: fx.szenario,
    run,
    aktive: lauf.active.length,
    assertionsOk: fehler.length === 0,
    assertionsFehler: fehler,
    judge,
  };
}

export interface FixtureLaufOptionen {
  /** Wiederholungen je Fixture (Varianz). */
  n: number;
  /** Generierungs-Transport; `null` → Dry-Run (Fixture-stubOps). */
  transport: AITransport | null;
  /** Judge-Transport; fehlt/`null` → kein Judge. */
  judgeTransport?: AITransport | null;
  /** Ziel-Tab (`'agentisch'` = Qwen); nur Bridge. */
  ziel?: BridgeZiel;
  /** resetChat vor jedem Bridge-Submit (Generierung + Judge). */
  reset?: boolean;
  /** Dry-Run-Kennung: unterdrückt den Judge (spiegelt CLI-`--dry-run`). */
  dryRun?: boolean;
  signal?: AbortSignal;
}

export interface EinFixtureErgebnis {
  zeilen: EvalZeile[];
  aggregat: FixtureAggregat;
  /** Rohantworten je Lauf (Diagnose auffälliger Läufe). */
  rawProLauf: string[][];
}

/**
 * Fährt EINE Fixture n× durch die reine Konsolidierungs-Pipeline + Assertions +
 * optionalen Judge. Von CLI und Panel-Runner gemeinsam genutzt.
 */
export async function laufeEineFixtureMitJudge(
  fx: GedaechtnisFixture,
  opts: FixtureLaufOptionen,
): Promise<EinFixtureErgebnis> {
  const zeilen: EvalZeile[] = [];
  const rawProLauf: string[][] = [];
  const detFehlerProLauf: string[][] = [];
  const judgeScores: JudgeScore[] = [];

  for (let run = 0; run < opts.n; run++) {
    if (opts.signal?.aborted) break;
    const lauf = await laufeFixture(fx, opts.transport, frischeIdFabrik(`${fx.id}-${run}`), {
      ziel: opts.ziel,
      resetVorZyklus: opts.reset,
      signal: opts.signal,
    });
    // Ein mittendrin abgebrochener (Teil-)Lauf wird NICHT gewertet (verfälscht sonst
    // Assertions/Zähler — z.B. fehlende Stichworte durch abgeschnittene Zyklen).
    if (opts.signal?.aborted) break;
    const assertions = pruefeAssertions(fx, lauf.active, lauf.ergebnisse);
    const fehler = assertionsFehlerListe(assertions);

    let judgeScore: JudgeScore | undefined;
    if (opts.judgeTransport && !opts.dryRun) {
      judgeScore = await runJudge(opts.judgeTransport, buildJudgePrompt(fx, lauf.active), {
        ziel: opts.ziel,
        resetVorSubmit: opts.reset,
        signal: opts.signal,
      });
      if (opts.signal?.aborted) break;
      judgeScores.push(judgeScore);
    }

    detFehlerProLauf.push(fehler);
    rawProLauf.push(lauf.rawAntworten);
    zeilen.push(baueEvalZeile(fx, run, lauf, fehler, judgeScore));
  }

  const okLaeufe = detFehlerProLauf.filter(f => f.length === 0).length;
  // Parse-Fehler-Judges (fehler:true → 0/0) NICHT ins Mittel — sonst drücken sie den
  // Schnitt künstlich (Bridge liefert gelegentlich nicht-JSON, das der Judge nicht parst).
  const guteJudges = judgeScores.filter(s => !s.fehler);
  const aggregat: FixtureAggregat = {
    id: fx.id,
    szenario: fx.szenario,
    okLaeufe,
    n: opts.n,
    judgeF: guteJudges.length > 0 ? mittel(guteJudges.map(s => s.faktentreue)) : undefined,
    judgeN: guteJudges.length > 0 ? mittel(guteJudges.map(s => s.nuetzlichkeit)) : undefined,
    judgeFehler: judgeScores.length - guteJudges.length,
    beispielVerletzung: detFehlerProLauf.find(f => f.length > 0),
  };
  return { zeilen, aggregat, rawProLauf };
}

export interface GedaechtnisEvalCallbacks {
  onFixtureStart?: (id: string, index: number, total: number) => void;
  onFixtureDone?: (aggregat: FixtureAggregat, index: number, total: number) => void;
}

export interface GedaechtnisEvalOptionen extends FixtureLaufOptionen {
  /** Fixture-Quelle (Default: die gebündelten `GEDAECHTNIS_FIXTURES`). */
  fixtures?: GedaechtnisFixture[];
  /** Auf die ersten N Fixtures begrenzen. */
  limit?: number;
}

export interface GedaechtnisEvalErgebnis {
  zeilen: EvalZeile[];
  aggregate: FixtureAggregat[];
  rawProFixture: Record<string, string[][]>;
  abgebrochen: boolean;
  alleAssertionsOk: boolean;
}

/**
 * Äußere sequentielle Schleife über alle (fiktiven) Fixtures. Vom Panel + Test
 * genutzt; die CLI behält ihren eigenen Rahmen (Console/Datei/Exit).
 */
export async function laufeGedaechtnisEval(
  opts: GedaechtnisEvalOptionen,
  callbacks?: GedaechtnisEvalCallbacks,
): Promise<GedaechtnisEvalErgebnis> {
  const basis = opts.fixtures ?? GEDAECHTNIS_FIXTURES;
  const fixtures = typeof opts.limit === 'number' ? basis.slice(0, opts.limit) : basis;

  // DSGVO-Provenienz-Guard: nur FIKTIVE Fixtures dürfen (ggf. extern) laufen.
  const unfiktiv = fixtures.filter(f => f.fiktiv !== true);
  if (unfiktiv.length > 0) {
    throw new Error(`Provenienz-Guard: nicht-fiktive Fixture(s): ${unfiktiv.map(f => f.id).join(', ')}`);
  }

  const zeilen: EvalZeile[] = [];
  const aggregate: FixtureAggregat[] = [];
  const rawProFixture: Record<string, string[][]> = {};
  let abgebrochen = false;
  const total = fixtures.length;

  for (let i = 0; i < total; i++) {
    if (opts.signal?.aborted) { abgebrochen = true; break; }
    const fx = fixtures[i]!;
    callbacks?.onFixtureStart?.(fx.id, i, total);
    const r = await laufeEineFixtureMitJudge(fx, opts);
    // Eine mittendrin abgebrochene Fixture NICHT werten (nur voll durchgelaufene
    // Fixtures gehen ins Aggregat/JSONL — keine halben okLaeufe/n-Zahlen).
    if (opts.signal?.aborted) { abgebrochen = true; break; }
    zeilen.push(...r.zeilen);
    aggregate.push(r.aggregat);
    rawProFixture[fx.id] = r.rawProLauf;
    callbacks?.onFixtureDone?.(r.aggregat, i, total);
  }

  return {
    zeilen,
    aggregate,
    rawProFixture,
    abgebrochen,
    alleAssertionsOk: zeilen.every(z => z.assertionsOk),
  };
}
