/**
 * Reine, layer-agnostische Workflow-Schritt-Helfer. Hier wohnt die Logik, die im
 * Datensatz NICHT stehen darf — allen voran die Gate-Auswertung (kein `eval()`,
 * keine Funktions-Strings im JSON). In Phase 5 kommen `computeStepNumbers` /
 * `flattenStepsTopological` dazu.
 */
import type { GateExpr } from './types';

/**
 * Minimaler Kontext für die Gate-Auswertung — bewusst STRUKTURELL typisiert (kein
 * `KurzfassungContext`-Import aus der Plugin-Schicht). Der Gutachten-`ctx` ist
 * zuweisungskompatibel (`teilvorhaben` ist ein Array).
 */
export interface GateContext {
  teilvorhaben: readonly unknown[];
}

/**
 * Wertet ein deklaratives Anwendbarkeits-Gate aus. `'hat_teilvorhaben'` ⇒ es gibt
 * mindestens ein Teilvorhaben; alles andere (inkl. `undefined` / unbekannte Werte)
 * ⇒ `true` (anwendbar). Reine Funktion, trivial testbar.
 */
export function evalGate(expr: GateExpr | undefined, ctx: GateContext): boolean {
  if (expr === 'hat_teilvorhaben') return ctx.teilvorhaben.length > 0;
  return true;
}
