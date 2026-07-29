/**
 * Monochrome Lane-Rampe der Kanban-Köpfe — EINE Quelle für alle Kanbans
 * (Anträge-Widget, Feedback-Widget, Feedback-Board).
 *
 * Zyklisch nach Lane-INDEX statt nach Kategorie/Status: so bleiben benachbarte
 * Köpfe unterscheidbar und die wählbare Primärfarbe (--tf-primary-h) schlägt
 * durch. Tokens leben in theme.css (:root + dark — theme-token-contract),
 * kein Hex im Komponenten-Code.
 */

/** Farbmodus der Lane-Köpfe: Status-/Kategorie-Töne vs. Primär-Hue-Rampe. */
export type LaneFarbmodus = 'bunt' | 'monochrom';

const MONO_ACCENTS = [
  'var(--tf-kanban-mono-1)',
  'var(--tf-kanban-mono-2)',
  'var(--tf-kanban-mono-3)',
] as const;

/** Monochrom-Akzent zyklisch nach Lane-Index. */
export function monoLaneAccent(laneIndex: number): string {
  return MONO_ACCENTS[laneIndex % MONO_ACCENTS.length]!;
}
