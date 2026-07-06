/**
 * Reine Zählung der Prüf-Schweregrade eines Abschnitts (Journey-Paket 3) — für die
 * Kopfzeile des Prüfpanels („{f} Fehler · {h} Hinweise"). `ok`-Checks zählen nicht.
 */
import type { CheckResult } from '@/core/services/skills';

export interface PruefSummary {
  fehler: number;
  hinweis: number;
}

export function pruefSummary(checks: CheckResult[]): PruefSummary {
  let fehler = 0;
  let hinweis = 0;
  for (const c of checks) {
    if (c.level === 'fehler') fehler += 1;
    else if (c.level === 'hinweis') hinweis += 1;
  }
  return { fehler, hinweis };
}
