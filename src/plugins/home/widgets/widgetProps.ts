/**
 * Gemeinsamer Props-Vertrag zwischen HomeWidgetStack und den Widget-Wrappern
 * (eigene Datei, damit Stack ↔ Wrapper keine Laufzeit-Zyklen bilden).
 */
import type { DashboardData } from '../useDashboardData';
import type { WidgetInstanz } from './types';

/** Von HomePage EINMAL berechnete, geteilte Daten — Widgets rufen
 *  useDashboardData nicht selbst auf (13k-Antraege-Aggregation nur einmal). */
export interface HomeWidgetContext {
  data: DashboardData;
  /** Initiale Zeilen-Anzahl „Meine Anträge" (Profil, geklemmt 5–15). */
  initialCount: number;
}

export interface WidgetProps {
  instanz: WidgetInstanz;
  ctx: HomeWidgetContext;
  onToggleEingeklappt: () => Promise<void>;
}
