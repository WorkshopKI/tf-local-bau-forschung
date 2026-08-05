/**
 * Ist ein Modul sichtbar? — die Entscheidung als REINE Funktion.
 *
 * Drei Fakten, drei Quellen, die man nicht verwechseln darf:
 *
 *  - `imBuild`    — Bauzeit. Ist das Modul überhaupt einkompiliert (`features.*`)?
 *  - `hatSchloss` — Bauzeit. Trägt die Config ein `moduleAuth`-Schloss dafür?
 *  - `frei`       — Laufzeit. Hat der Nutzer es in dieser Sitzung freigeschaltet?
 *
 * Das Muster ist `registry-zugang.ts`: Konfig-Lesen bleibt beim Aufrufer, hier steht
 * nur die Entscheidung. Der Grund ist nicht Ästhetik — Vitest verdrahtet
 * `__TEAMFLOW_CONFIG__` fest auf `variant: 'development'`, ein Prädikat mit
 * `runtimeConfig`-Zugriff wäre über die Varianten-Matrix gar nicht testbar.
 *
 * Siehe docs/architecture/modul-freischaltung.md.
 */

import type { ModulSlot } from './runtime-config';

export type { ModulSlot };

/** Die Fakten, aus denen sich die Sichtbarkeit ableitet. */
export interface ModulUmgebung {
  /** `features.<modul>` — das Modul ist im Bundle. */
  imBuild: boolean;
  /** `moduleAuth.<slot>` existiert — dieser Build sperrt das Modul. */
  hatSchloss: boolean;
  /** Laufzeit: in dieser Sitzung freigeschaltet (bzw. Session aktiv). */
  frei: boolean;
}

/**
 * Darf das Modul gezeigt werden?
 *
 * **Ohne Schloss ist offen.** Das ist die Regel, die `dev` und `local` unangetastet
 * lässt: sie führen kein `moduleAuth`, also verhalten sie sich exakt wie vor der
 * Einführung der Schlösser. Ein Build sperrt nur, was er ausdrücklich sperrt.
 *
 * Ein fehlendes Modul (`imBuild: false`) bleibt unsichtbar — eine Freischaltung
 * kann nichts zeigen, was gar nicht mitgebaut wurde.
 */
export function modulSichtbar(u: ModulUmgebung): boolean {
  if (!u.imBuild) return false;
  if (!u.hatSchloss) return true;
  return u.frei;
}
