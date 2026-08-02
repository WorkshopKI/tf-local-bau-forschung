/**
 * Amtlicher-Status → Stepper-Position (Journey-Paket 2 Phase 6).
 *
 * Reine Ableitung der 5-Stationen-Position aus dem AMTLICHEN Antrags-/Verbund-
 * Status (NICHT aus einem WorkflowRun). Ersetzt die alte `STATUS_TO_STEP`-Map im
 * WorkflowStepper, die nur Bauantrag-snake_case kannte → jeder Förderantrag-Roh-
 * Status fiel still auf Station 1. Die Stationen bilden den amtlichen Lebenszyklus
 * ab: Eingang → Vollständigkeit → Fachprüfung → Bewilligung → Schluss.
 *
 * Terminal-negativ (`abgelehnt` / `abgelehnt/zurückgezogen`) → Abbruch an der
 * Fachprüfungs-Station (3) mit X-Rendering; Folgestationen bleiben gedämpft.
 *
 * Einzelquelle für den Stepper — Vergleiche laufen über die Kategorie-Helper aus
 * `status-canonical.ts` (Pitfall #12), nie gegen Status-Literale.
 */
import { getStatusCategory, isAbgelehntZurueckgezogenStatus } from '@/core/utils/status-canonical';
// Direktimport auf das Quellmodul, NICHT über das Barrel `@/core/status` — das
// zieht `snapshot.ts` mit und damit einen Laufzeit-Zyklus (Zyklen-Wächter).
import { findeStatusCode } from '@/core/status/status-codes';

/** Die fünf amtlichen Stationen (1-indiziert über `station`). */
export const STEPPER_STATIONS = [
  'Eingang',
  'Vollständigkeit',
  'Fachprüfung',
  'Bewilligung',
  'Schluss',
] as const;

export type StepperStation = 1 | 2 | 3 | 4 | 5;

export interface StepperPosition {
  /** Aktive Station 1..5 (bei Terminal: die Abbruch-Station). */
  station: StepperStation;
  /** Gesetzt bei final-negativem Ausgang → X-Rendering statt Ring. */
  terminal?: 'abgelehnt' | 'zurueckgezogen';
}

/**
 * Status-Codes, die auf der Vollständigkeits-Station stehen: 34
 * (bearbeitungsreif) und 36 (NL eingegangen).
 *
 * Über den CODE statt über Roh-Literale (Pitfall #12) — und unabhängig von der
 * Kategorie: `NL eingegangen` ist seit v2.383 `nachforderung`, die Station
 * bleibt aber 2. Hinge die Prüfung wie vorher an `case 'offen'`, wäre sie mit
 * dem Kategorie-Wechsel still auf Station 3 gerutscht.
 */
const VOLLSTAENDIGKEITS_CODES: ReadonlySet<number> = new Set([34, 36]);

/**
 * Bildet einen rohen amtlichen Status auf die Stepper-Position ab.
 *
 * - Terminal-negativ (Bauantrag `abgelehnt` ODER Förderantrag
 *   `abgelehnt/zurückgezogen`) → Station 3 (Fachprüfung) + `terminal`.
 * - Codes 34/36 → 2 (Vollständigkeit), unabhängig von der Kategorie.
 * - `offen` → 1 (Eingang).
 * - `in_pruefung` / `nachforderung` / `entscheidung` → 3 (Fachprüfung).
 * - `bewilligt` / `begleitung` → 4 (Bewilligung).
 * - `abgeschlossen` → 5 (Schluss).
 * - `sonstige` / unbekannt / leer → 1 (Eingang, Fallback).
 */
export function statusZuStepperPosition(status: unknown): StepperPosition {
  if (isAbgelehntZurueckgezogenStatus(status)) {
    // Bauantrag-`abgelehnt` (Kategorie `abgelehnt`) vs. Förderantrag
    // `abgelehnt/zurückgezogen` (Kategorie `abgeschlossen`) — nur fürs Label.
    const terminal = getStatusCategory(status) === 'abgelehnt' ? 'abgelehnt' : 'zurueckgezogen';
    return { station: 3, terminal };
  }

  const code = findeStatusCode(status)?.eintrag.code;
  if (code !== undefined && VOLLSTAENDIGKEITS_CODES.has(code)) return { station: 2 };

  switch (getStatusCategory(status)) {
    case 'offen':
      return { station: 1 };
    case 'in_pruefung':
    case 'nachforderung':
    case 'entscheidung':
      return { station: 3 };
    case 'bewilligt':
    case 'begleitung':
      return { station: 4 };
    case 'abgeschlossen':
      return { station: 5 };
    default:
      // 'sonstige' + alles Unbekannte → Eingang.
      return { station: 1 };
  }
}
