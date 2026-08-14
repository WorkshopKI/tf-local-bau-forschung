/**
 * Rolle → Farb-Token. Die **einzige** Stelle, an der diese Zuordnung steht.
 *
 * Die Farben selbst leben in [theme.css](../../theme.css) (Light **und** Dark)
 * als `--tf-rolle-*`; hier stehen nur die Namen. Wer stattdessen `hsl(…)` in
 * eine Komponente schreibt, hat den Dunkelmodus verloren, bevor er ihn getestet
 * hat — der Guard `rollen-farbe-eine-quelle` hält das fest.
 *
 * **Warum Farbe hier überhaupt zulässig ist** (DESIGN_GUIDE Regel 1: Farbe ist
 * ein knappes Gut): sie trägt genau eine Information — wer den Eintrag setzt —
 * und zwar in allen Flächen dieselbe. Filterleiste, Chronik-Zeile, Matrix-Zelle
 * und Zeitstrahl-Balken sind damit ein System, und die Filterleiste ist die
 * Legende. Dieselbe Begründung wie bei der Kompetenz-Matrix (`--tf-level-*`).
 *
 * **Neutral hat keine Farbe.** 144 der 505 Codes lässt das Fachsystem von jedem
 * setzen (`rollen: []`), und „jeder" ist keine Rolle, sondern deren Abwesenheit
 * ({@link ./rollen.ts}). Ein sechster Farbton dafür behauptete eine Zuständigkeit,
 * die es nicht gibt.
 *
 * Rein: keine Imports außer dem Typ, keine Laufzeit-Abhängigkeit.
 */
import type { Rolle } from './typen';

/** Die drei Rollen von einem Farbton: Schrift, Fläche, Balken. */
export interface RollenFarbe {
  /** Schrift-/Randfarbe — `--tf-rolle-<r>`. */
  text: string;
  /** Getönte Fläche hinter Badge und aktivem Chip — `--tf-rolle-<r>-bg`. */
  flaeche: string;
  /**
   * Gesättigtere Fläche für den Zeitstrahl-Balken — `--tf-rolle-<r>-bar`.
   * Steht bereits hier, damit die Familie vollständig an einer Stelle liegt;
   * gelesen wird sie erst vom Balken-Umbau.
   */
  balken: string;
}

const FARBEN: Readonly<Record<Rolle, RollenFarbe>> = {
  pa: { text: 'var(--tf-rolle-pa)', flaeche: 'var(--tf-rolle-pa-bg)', balken: 'var(--tf-rolle-pa-bar)' },
  ab: { text: 'var(--tf-rolle-ab)', flaeche: 'var(--tf-rolle-ab-bg)', balken: 'var(--tf-rolle-ab-bar)' },
  fb: { text: 'var(--tf-rolle-fb)', flaeche: 'var(--tf-rolle-fb-bg)', balken: 'var(--tf-rolle-fb-bar)' },
  qs: { text: 'var(--tf-rolle-qs)', flaeche: 'var(--tf-rolle-qs-bg)', balken: 'var(--tf-rolle-qs-bar)' },
  jur: { text: 'var(--tf-rolle-jur)', flaeche: 'var(--tf-rolle-jur-bg)', balken: 'var(--tf-rolle-jur-bar)' },
};

/** Die Farbe einer Rolle. */
export function rollenFarbe(rolle: Rolle): RollenFarbe {
  return FARBEN[rolle];
}

/**
 * Die Farbe einer **abgeblendeten** Zeile — dieselbe Form, ohne Aussage.
 *
 * Abgeblendet wird, was zur aktiven Rollenwahl nicht gehört, aber stehen bleiben
 * muss: neutrale Einträge (jeder darf sie setzen) und, im Zeitstrahl, fremde
 * Rollen. Sie verlieren die Tönung, nicht den Platz — eine Liste darf kürzer
 * werden, ein Verlauf verlöre seine Form.
 */
export const ROLLE_GEDIMMT: RollenFarbe = {
  text: 'var(--tf-text-tertiary)',
  flaeche: 'transparent',
  balken: 'var(--tf-bg-secondary)',
};
