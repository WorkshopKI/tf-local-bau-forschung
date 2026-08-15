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
 * und Zeitstrahl-Marke sind damit ein System, und die Filterleiste ist die
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

/**
 * Die zwei Rollen von einem Farbton: Schrift und Fläche.
 *
 * **Eine dritte gab es kurz** (`--tf-rolle-<r>-bar`, v4.47–v4.49): die
 * gesättigtere Fläche für einen nach Rolle gefärbten Zeitstrahl-Balken. Der
 * Umbau hat sich dagegen entschieden — die Rolle sitzt am **Termin**, nicht auf
 * dem Zeitraum ({@link ../../plugins/antraege/verlauf-band/BandBahn.tsx}) —, und
 * ein Token, das nichts färbt, ist eine Behauptung über ein Vorhaben.
 */
export interface RollenFarbe {
  /** Schrift-/Randfarbe — `--tf-rolle-<r>`. */
  text: string;
  /** Getönte Fläche hinter Badge und aktivem Chip — `--tf-rolle-<r>-bg`. */
  flaeche: string;
}

const FARBEN: Readonly<Record<Rolle, RollenFarbe>> = {
  pa: { text: 'var(--tf-rolle-pa)', flaeche: 'var(--tf-rolle-pa-bg)' },
  ab: { text: 'var(--tf-rolle-ab)', flaeche: 'var(--tf-rolle-ab-bg)' },
  fb: { text: 'var(--tf-rolle-fb)', flaeche: 'var(--tf-rolle-fb-bg)' },
  qs: { text: 'var(--tf-rolle-qs)', flaeche: 'var(--tf-rolle-qs-bg)' },
  jur: { text: 'var(--tf-rolle-jur)', flaeche: 'var(--tf-rolle-jur-bg)' },
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
};
