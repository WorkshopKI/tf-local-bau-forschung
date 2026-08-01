/**
 * „Vorgangs-Board" — das geteilte To-do-Board des Vorgangssystems.
 *
 * Ersetzt das private AB-XLSX-Dashboard: dieselbe Kaskade, aber als versionierte
 * Team-Regelmenge statt als WENN-Formel in einer Mappe. Drei Sichten desselben
 * Regelsatzes — eigene Aufgaben, Warten auf andere, kein Treffer.
 *
 * **Eigenes Plugin statt einer View der Förderanträge-Liste**: die Gruppierung
 * nach To-do-Wert plus Rollen-Sichten passt nicht in die `predicate`-Form von
 * `antraege/views.ts`, und `AntraegePage` ist bereits die Master/Detail-Ausnahme
 * der Layout-Schicht.
 *
 * Doku: docs/architecture/vorgangssystem.md (Abschnitt 6.5)
 */
import type { TeamFlowPlugin } from '@/core/types/plugin';
import { VorgangsBoardPage } from './VorgangsBoardPage';

export const vorgangsBoardPlugin: TeamFlowPlugin = {
  id: 'vorgangs-board',
  route: '/vorgangs-board',
  featureFlag: 'vorgangssystem',
  name: 'Vorgangs-Board',
  icon: 'ListTodo',
  category: 'erprobung',
  order: 45,
  component: VorgangsBoardPage,
};

export { VorgangsBoardPage } from './VorgangsBoardPage';
