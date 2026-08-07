/**
 * Die Farbe eines Statusabschnitts — **eine** Stelle, weil Bahn und Legende
 * dieselbe nennen müssen. Zwei Ableitungen wären zwei Wahrheiten, und die
 * Legende erklärte dann eine Bahn, die anders aussieht.
 *
 * Gefärbt wird nach {@link getStatusCategory}, nicht nach dem Rohstatus
 * (Pitfall #12): mehrere Rohstatus teilen sich eine Kategorie und damit einen
 * Farbton — die Farbe sagt „welche Art von Arbeit", der Text sagt „welcher
 * Status".
 */
import { getStatusCategory } from '@/core/utils/status-canonical';
import { KANBAN_LANE_ACCENT } from '@/plugins/home/widgets/kanbanLanes';

export function segmentFarbe(roh: string | undefined): string {
  return KANBAN_LANE_ACCENT[getStatusCategory(roh ?? '')];
}
