/**
 * Amtlicher Status → Position auf der ZAH-Phasen-Leiste.
 *
 * Die Stationen sind seit v2.384 die **ZAH-Phasen** des Status-Katalogs
 * (Eingang · Vollständigkeit · Prüfung · Entscheidung · Begleitung ·
 * Abgeschlossen), nicht mehr die fünf abgeleiteten Spine-Stationen. Damit zeigt
 * der Kopf dieselbe Achse, nach der Filter, Cockpit und Erklärung gruppieren —
 * und die PL kann einen Code umhängen, ohne dass jemand Code anfasst.
 *
 * **Marker sind keine Stufe.** 29 Irrläufer, 88 Sonderstatus, 93/94
 * Partner-Kennzeichen laufen bewusst neben dem Verfahren. Sie bekommen deshalb
 * `station: null` und werden als Kennzeichen neben der Leiste gerendert — eine
 * Station „Irrläufer" hätte behauptet, sie seien ein Verfahrensschritt.
 *
 * **Terminal-negativ** (`abgelehnt` bzw. `abgelehnt/zurückgezogen`) bleibt ein
 * Abbruch mit X-Rendering, jetzt an der Abgeschlossen-Station: dorthin gehört
 * der Vorgang fachlich, und die alte Sonderposition „Abbruch in der Fachprüfung"
 * war eine Eigenheit der Spine-Achse.
 *
 * Vergleiche laufen über den Code-Katalog und die Kategorie-Helper, nie gegen
 * Status-Literale (Pitfall #12).
 */
import { getStatusCategory, isAbgelehntZurueckgezogenStatus } from '@/core/utils/status-canonical';
// Direktimporte auf die Quellmodule, NICHT über das Barrel `@/core/status` — das
// zieht `snapshot.ts` mit und damit einen Laufzeit-Zyklus (Zyklen-Wächter).
import { zahPhaseFuerStatusText, codeFuerStatusText } from '@/core/status/kategorie-ableitung';
import { ZAH_PHASEN_REIHENFOLGE, ZAH_PHASE_LABEL, SEED_MARKER_CODES } from '@/core/status/zah-phasen';
import type { ZahPhaseId } from '@/core/status/typen';

/** Die Stationen in Verfahrens-Reihenfolge — aus dem Katalog, nicht dupliziert. */
export const STEPPER_STATIONS: readonly string[] =
  ZAH_PHASEN_REIHENFOLGE.map(id => ZAH_PHASE_LABEL[id]);

/** 1-basierte Station; `null` = keine (Marker oder Status nicht im Katalog). */
export type StepperStation = number | null;

export interface StepperPosition {
  /** Aktive Station 1…6, `null` bei Marker/unbekannt. */
  station: StepperStation;
  /** Gesetzt bei final-negativem Ausgang → X-Rendering statt Ring. */
  terminal?: 'abgelehnt' | 'zurueckgezogen';
  /**
   * Marker-Status: läuft neben dem Verfahren. Trägt das Label für das
   * Kennzeichen neben der Leiste.
   */
  marker?: boolean;
}

/** Station einer Phase (1-basiert). */
function stationVon(phase: ZahPhaseId): number {
  return ZAH_PHASEN_REIHENFOLGE.indexOf(phase) + 1;
}

/**
 * Bildet einen rohen amtlichen Status auf die Stepper-Position ab.
 *
 * - Marker (29/88/93/94) → `station: null`, `marker: true`.
 * - Terminal-negativ → Abgeschlossen-Station + `terminal`.
 * - Sonst die Station der ZAH-Phase.
 * - Status ohne Katalog-Treffer → `station: null` (nicht Station 1: „wir wissen
 *   es nicht" ist etwas anderes als „ganz am Anfang").
 */
export function statusZuStepperPosition(status: unknown): StepperPosition {
  const code = codeFuerStatusText(status);
  if (code !== null && SEED_MARKER_CODES.has(code)) return { station: null, marker: true };

  if (isAbgelehntZurueckgezogenStatus(status)) {
    // Nur fürs Label: Kategorie `abgelehnt` (aus einer kuratierten Fassung) vs.
    // der amtliche `abgelehnt/zurückgezogen` (Kategorie `abgeschlossen`).
    const terminal = getStatusCategory(status) === 'abgelehnt' ? 'abgelehnt' : 'zurueckgezogen';
    return { station: stationVon('abgeschlossen'), terminal };
  }

  const phase = zahPhaseFuerStatusText(status);
  if (phase !== null) return { station: stationVon(phase) };

  // Unkuratierte Werte ohne amtlichen Code werden über die Kategorie
  // eingeordnet, damit der Stepper dort nicht leer bleibt.
  return { station: stationAusKategorie(status) };
}

/** Fallback für unkuratierte Werte ohne amtlichen Code. */
function stationAusKategorie(status: unknown): StepperStation {
  switch (getStatusCategory(status)) {
    case 'offen': return stationVon('eingang');
    case 'nachforderung': return stationVon('vollstaendigkeit');
    case 'in_pruefung': return stationVon('pruefung');
    case 'entscheidung': return stationVon('entscheidung');
    case 'bewilligt':
    case 'begleitung': return stationVon('begleitung');
    case 'abgeschlossen':
    case 'abgelehnt': return stationVon('abgeschlossen');
    default: return null;   // `sonstige`/leer: keine Aussage, keine Station
  }
}
