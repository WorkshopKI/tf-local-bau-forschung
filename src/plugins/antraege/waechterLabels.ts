/**
 * **Ein Wortlaut für das Urteil des Stillstands-Wächters** — gelesen vom
 * Fristen-Band und von der Verlaufs-Bahn.
 *
 * Beide zeigen dasselbe Urteil an derselben Zeile: der eine ausführlich mit
 * Begründung, die andere als Marke am Achsenende. Zwei Wörter für dieselbe Lage
 * („hängt fest" hier, „Stillstand" dort) wären zwei Wahrheiten in einem
 * Aufklappbereich — die Frage „meint das dasselbe?" darf gar nicht erst
 * entstehen.
 *
 * `unbewertet` ist ein **eigenes** Urteil, nicht „ok": ein Status ohne gepflegte
 * Zieltage lässt sich nicht beurteilen (`waechter.ts`).
 */
import type { WaechterUrteil } from '@/core/status/waechter';

export const URTEIL_LABEL: Record<WaechterUrteil, string> = {
  ok: 'läuft',
  haengt: 'hängt fest',
  unbewertet: 'nicht prüfbar',
};

export const URTEIL_FARBE: Record<WaechterUrteil, string> = {
  ok: 'var(--tf-success-text)',
  haengt: 'var(--tf-danger-text)',
  unbewertet: 'var(--tf-text-tertiary)',
};
