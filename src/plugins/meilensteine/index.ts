/**
 * „Fristen & Meilensteine" — Bearbeitungs-Meilensteine je Verbund, gemessen ab
 * Antragseingang, mit Prognose zur 3-Monats-Gesamtfrist.
 *
 * Zweite Achse neben dem amtlichen Status: der Status sagt WO ein Verbund steht,
 * dieses Modul sagt, ob er dort rechtzeitig steht. Der Plan ist kuratierte
 * Team-Daten auf dem Daten-Share — die PL pflegt ihn, alle lesen ihn.
 *
 * Doku: docs/architecture/meilensteine.md
 */
import type { TeamFlowPlugin } from '@/core/types/plugin';
import { MeilensteinePage } from './MeilensteinePage';

export const meilensteinePlugin: TeamFlowPlugin = {
  id: 'meilensteine',
  route: '/meilensteine',
  featureFlag: 'meilensteinMonitoring',
  name: 'Fristen & Meilensteine',
  icon: 'Milestone',
  category: 'erprobung',
  order: 40,
  component: MeilensteinePage,
};

export { MeilensteinePage } from './MeilensteinePage';
