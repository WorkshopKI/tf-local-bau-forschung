/**
 * Reine Entscheidungslogik für den ● CSV-Fußzeilen-Indikator (`CsvFreshnessIndicator`).
 *
 * Ausgelagert + rein, damit der Kern-Fall testbar ist: Ein **Produktions-Build**
 * mit einer Fixture-Quelle (`fixture-real-*`) oder einer unerreichbaren Datei darf
 * NIE „fresh/grün" melden — sonst läuft der Import „durch, ohne dass etwas ankommt"
 * (der 2026-06-Vorfall). Fixtures sind in dev erwartet/gebündelt und daher nur in
 * prod (`isProd`) ein Fehlkonfigurations-Signal.
 */

/**
 * `fresh`      = alles Verknüpfte importiert (grün)
 * `stale`      = geänderte Exporte ODER Fehlkonfiguration (rot)
 * `needs_link` = Schemas da, aber keine erreichbar (Permission fehlt / Ordner nicht
 *                verknüpft) → handlungsleitend „Zugriff erneuern / Ordner verknüpfen"
 * `no_sources` = Share erreichbar, aber 0 CSV-Quellen definiert → Datenbestand
 *                unvollständig (z.B. leer publizierte `csv_schemas`) — NICHT grün faken
 * `offline`    = nicht prüfbar (Share offline / kein Handle / vor dem ersten Check)
 */
export type CsvFreshnessState = 'fresh' | 'stale' | 'needs_link' | 'no_sources' | 'offline';

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
  /**
   * Ob der Daten-Share aktuell erreichbar war (SMB online + Handle vorhanden).
   * Ohne Erreichbarkeit lässt sich der CSV-Stand nicht beurteilen → `offline`
   * (statt fälschlich „keine Quellen"/„verknüpfen" zu melden).
   */
  shareReachable: boolean;
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
  } else if (!input.shareReachable) {
    // Nicht prüfbar (offline / kein Handle) → echtes Unbekannt bleibt grau.
    state = 'offline';
  } else if (input.totalSchemas === 0) {
    // Share erreichbar, aber keine CSV-Quellen definiert → der Datenbestand ist
    // unvollständig (z.B. leer publizierte csv_schemas / Snapshot-Defekt). Nicht
    // grün faken — auf CSV-Rollen-Builds (pl/as/kurator/dev) ist das ein Problem.
    state = 'no_sources';
  } else {
    // Schemas da, aber keine erreichbar (Permission fehlt / Ordner nicht verknüpft)
    // → handlungsleitend statt grau: Zugriff erneuern / Ordner verknüpfen.
    state = 'needs_link';
  }
  return { state, misconfig };
}

/**
 * Was der Zustand dem Nutzer SAGT. Steht hier und nicht im Indikator, weil
 * seit v4.34 zwei Stellen dieselbe Aussage zeigen: der „● CSV"-Knopf in der
 * Fusszeile und die Zeile „CSV-Datenimport" auf der Kuration-Uebersicht. Die
 * Darstellung (Punktfarbe dort, Badge hier) bleibt bei den Aufrufern — der
 * SATZ nicht, sonst driften die beiden auseinander.
 */
export type CsvFreshnessTon = 'ok' | 'warnung' | 'fehler' | 'unbekannt';

export interface CsvFreshnessAussage {
  ton: CsvFreshnessTon;
  /** Kurzform fuer Badge/Zeile („Aktuell", „Neue Exporte verfügbar"). */
  label: string;
  /** Langform mit Handlungsaufforderung — Tooltip bzw. `aria-label`. */
  tip: string;
}

export function csvFreshnessAussage({ state, misconfig }: FreshnessDecision): CsvFreshnessAussage {
  const ton: CsvFreshnessTon =
    state === 'fresh' ? 'ok'
      : state === 'stale' || state === 'no_sources' ? 'fehler'
        : state === 'needs_link' ? 'warnung'
          : 'unbekannt';

  if (misconfig) {
    return {
      ton,
      label: 'Achtung — Quellen ausgeschlossen',
      tip: 'CSV-Quellen werden nicht importiert — klicken für Details',
    };
  }
  switch (state) {
    case 'fresh':
      return { ton, label: 'Aktuell', tip: 'CSV-Exporte sind importiert' };
    case 'stale':
      return { ton, label: 'Neue Exporte verfügbar', tip: 'Neue CSV-Exporte verfügbar — klicken zum Importieren' };
    case 'no_sources':
      return { ton, label: 'Keine CSV-Quellen — Datenbestand prüfen', tip: 'Keine CSV-Quellen im Datenbestand — klicken für Details' };
    case 'needs_link':
      return { ton, label: 'CSV-Ordner verknüpfen', tip: 'CSV-Ordner nicht verknüpft — klicken zum Verknüpfen' };
    default:
      return { ton, label: 'Status offline', tip: 'CSV-Status offline / nicht prüfbar' };
  }
}
