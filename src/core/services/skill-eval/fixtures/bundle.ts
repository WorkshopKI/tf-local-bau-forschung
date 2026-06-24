/**
 * Gebündelte FIKTIVE Eval-Fixtures (dev-only) für die In-App Skill-Eval-GUI.
 *
 * DSGVO-Hardlock: der externe Judge darf ausschließlich diese gebündelten,
 * fiktiven VBs sehen — nie einen realen Antrag. Die GUI/Orchestrierung bezieht
 * Fixtures NUR hierüber; jedes geladene Array trägt ein nicht-enumerierbares
 * Brand-Symbol, das `runEvalBatch` vor dem ersten Judge-Call prüft
 * (`isFromEvalBundle`).
 *
 * Tree-Shaking: Der `?raw`-Import wird AUSSCHLIESSLICH innerhalb des
 * Literal-Guards (`__TEAMFLOW_DEV_FIXTURES__ && …`) referenziert. In Prod-Builds
 * faltet Vite `__TEAMFLOW_DEV_FIXTURES__` zu `false` → der Block wird dead code →
 * der ~2-MB-Fixture-String fällt aus dem Bundle (verifiziert per
 * `build:prod`-Grep). Doppel-Guard wie bei den restlichen dev-fixtures
 * (Compile-Time `__TEAMFLOW_DEV_FIXTURES__` + Runtime `features.devFixtures`).
 */
import rawFixtures from './eval-fixtures.data.json?raw';
import { features } from '@/config/feature-flags';
import type { Fixture } from '../types';

/** Obergrenze v1 — nie mehr als 25 Fixtures bündeln/zurückgeben. */
const MAX_FIXTURES = 25;

/** Nicht-enumerierbarer Provenienz-Marker auf dem geladenen Fixture-Array. */
const EVAL_FIXTURE_BRAND: unique symbol = Symbol('eval-fixture-bundle');

/**
 * Liefert die gebündelten fiktiven Fixtures (max. 25), versehen mit dem
 * Provenienz-Brand. Wirft, wenn der dev-Kontext fehlt (analog `assertDevFixtures`).
 */
export function loadEvalFixtures(): Fixture[] {
  // Referenz auf `rawFixtures` NUR hier drin → in prod dead code → tree-shaked.
  if (__TEAMFLOW_DEV_FIXTURES__ && features.devFixtures) {
    const parsed = JSON.parse(rawFixtures) as Fixture[];
    const arr = parsed.slice(0, MAX_FIXTURES);
    Object.defineProperty(arr, EVAL_FIXTURE_BRAND, { value: true, enumerable: false });
    return arr;
  }
  throw new Error('Eval-Fixtures nur im dev-Build (features.devFixtures) verfügbar.');
}

/**
 * Provenienz-Guard: true nur für ein Array, das `loadEvalFixtures()` gebrandet
 * hat. `runEvalBatch` asserted dies VOR dem ersten Judge-Call — so kann kein
 * realer Antrag in einen externen Judge-Call geraten.
 */
export function isFromEvalBundle(arr: unknown): boolean {
  return Array.isArray(arr)
    && (arr as unknown as Record<symbol, unknown>)[EVAL_FIXTURE_BRAND] === true;
}
