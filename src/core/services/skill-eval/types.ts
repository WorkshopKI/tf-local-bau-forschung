/**
 * Datenmodell der Skill-Eval-Harness. Reine Typen — keine Laufzeit-Logik, keine
 * I/O. Der Fixture-Typ wird BEWUSST aus dem bestehenden Generator
 * (`eval-fixtures`) wiederverwendet (kein Schema-Drift): er ist die Form, die
 * dessen `fixtures.json` emittiert.
 */
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { CheckResult, ParsedSkillOutput } from '@/core/services/skills';
import type { StepId } from '@/plugins/antraege/gutachten/types';

/** Re-Export der Fixture-Form (eine Quelle = der `eval-fixtures`-Generator). */
export type { Fixture } from '@/core/services/eval-fixtures/fixture-build';

/** Ein zu evaluierendes Modell (intern via llama.cpp, extern via OpenRouter). */
export interface EvalModelConfig {
  /** Stabile Kennung (Spaltenname in der Matrix, Resume-Key). */
  id: string;
  /** Anzeigename. */
  name: string;
  /** OpenAI-kompatible Basis-URL (`/v1` optional). */
  baseUrl: string;
  /** Modell-ID für den Request-Body. */
  model: string;
  /** Name der Umgebungsvariable mit dem API-Key (z.B. `OPENROUTER_API_KEY`). */
  apiKeyEnv?: string;
  /** `intern` = on-prem (keine Echt-Daten-Sorge entfällt — Fixtures sind fiktiv);
   *  `extern` = Cloud (nur für fiktive Fixtures zulässig). */
  klasse: 'intern' | 'extern';
}

/** Fabrik, die pro Modell einen Transport baut — injizierbar für Tests. */
export type TransportFactory = (modell: EvalModelConfig) => AITransport;

/**
 * Kontext-Variante eines Laufs (A/B-Achse, `--kontext`):
 *  - `'voll'`: voller VB im Prompt (Bestandsverhalten).
 *  - `'relevant'`: nur die per Relevanz-Map ausgewählten VB-Sektionen.
 * Fehlt das Feld in einer alten JSONL-Zeile → als `'voll'` behandelt.
 */
export type EvalKontext = 'voll' | 'relevant';

/** Ergebnis eines einzelnen `(fixture × modell × abschnitt × kontext)`-Laufs. */
export interface EvalRunResult {
  vbFile: string;
  modellId: string;
  abschnitt: StepId;
  skillId: string;
  /** Kontext-Variante (fehlt in Alt-Zeilen → `'voll'`). */
  kontext?: EvalKontext;
  /** Roh-Antwort des LLM (leer bei Fehler). */
  raw: string;
  /** Geparste Ausgabe (`null` bei Fehler / fehlendem Skill). */
  parsed: ParsedSkillOutput | null;
  /** Deterministische Regel-Checks über `parsed.finalerText`. */
  checks: CheckResult[];
  /** Gesetzt, wenn der Lauf scheiterte (Transport-Fehler, fehlender Skill). */
  fehler?: string;
  /** Wandzeit des Laufs in Millisekunden. */
  dauerMs: number;
}

/** Tolerant geparste Judge-Bewertung (Subscores 1–5 oder `null`). */
export interface JudgeScores {
  fachliche_korrektheit: number | null;
  vollstaendigkeit: number | null;
  sprachqualitaet: number | null;
  regeltreue: number | null;
  begruendung: string | null;
  prompt_verbesserung: string | null;
  /** True, wenn die Judge-Ausgabe nicht als JSON lesbar war. */
  fehler?: boolean;
}

/** Persistierte Judge-Zeile: Identität des Laufs + die Bewertung. */
export interface JudgeResult extends JudgeScores {
  vbFile: string;
  modellId: string;
  abschnitt: StepId;
  /** Kontext-Variante des bewerteten Laufs (fehlt in Alt-Zeilen → `'voll'`). */
  kontext?: EvalKontext;
}

/** Bekannte Judge-Subscore-Dimensionen (Reihenfolge = Report-Spalten). */
export const JUDGE_DIMENSIONS = [
  'fachliche_korrektheit',
  'vollstaendigkeit',
  'sprachqualitaet',
  'regeltreue',
] as const;

export type JudgeDimension = (typeof JUDGE_DIMENSIONS)[number];
