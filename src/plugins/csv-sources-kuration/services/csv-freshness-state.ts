/**
 * Reine Entscheidungslogik für den ● CSV-Fußzeilen-Indikator (`CsvFreshnessIndicator`).
 *
 * Ausgelagert + rein, damit der Kern-Fall testbar ist: Ein **Produktions-Build**
 * mit einer Fixture-Quelle (`fixture-real-*`) oder einer unerreichbaren Datei darf
 * NIE „fresh/grün" melden — sonst läuft der Import „durch, ohne dass etwas ankommt"
 * (der 2026-06-Vorfall). Fixtures sind in dev erwartet/gebündelt und daher nur in
 * prod (`isProd`) ein Fehlkonfigurations-Signal.
 */

export type CsvFreshnessState = 'fresh' | 'stale' | 'unknown';

export interface FreshnessInput {
  totalSchemas: number;
  /** Quellen mit neuerem/geänderten Export (`update_available`). */
  candidates: number;
  permissionNeeded: number;
  unlinked: number;
  /** Fixture-Quellen (`local_fixture`) — nur in prod ein Problem. */
  fixtures: number;
  /** Verknüpfte Quellen, deren Datei nicht erreichbar war (`file_missing`). */
  fileMissing: number;
  /** `!isDevFixturesEnabled()` — nur dann zählen Fixtures als Fehlkonfiguration. */
  isProd: boolean;
}

export interface FreshnessDecision {
  state: CsvFreshnessState;
  /**
   * Fehlkonfiguration/Problem, das die echten Daten NICHT ankommen lässt:
   * prod-Fixtures oder unerreichbare Dateien. Erzwingt einen nicht-grünen Punkt.
   */
  misconfig: boolean;
}

export function deriveCsvFreshnessState(input: FreshnessInput): FreshnessDecision {
  const prodFixtures = input.isProd ? input.fixtures : 0;
  const misconfig = prodFixtures > 0 || input.fileMissing > 0;
  // „erreichbar" = Quellen, die wir tatsächlich prüfen konnten (nicht ohne
  // Handle/Permission). Nur dann ist ein leeres `candidates` wirklich „grün".
  const reachable = input.totalSchemas - input.permissionNeeded - input.unlinked;

  let state: CsvFreshnessState;
  if (input.candidates > 0 || misconfig) {
    state = 'stale';
  } else if (input.totalSchemas > 0 && reachable > 0) {
    state = 'fresh';
  } else {
    state = 'unknown';
  }
  return { state, misconfig };
}
