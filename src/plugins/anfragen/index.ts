import type { TeamFlowPlugin } from '@/core/types/plugin';
import { AnfragenPage } from './AnfragenPage';
import { AnfragenEinstellungenPage } from './AnfragenEinstellungenPage';

export const anfragenPlugin: TeamFlowPlugin = {
  id: 'anfragen',
  route: '/anfragen',
  featureFlag: 'anfragen',
  name: 'E-Mail Anfragen',
  icon: 'Mail',
  category: 'erprobung',
  order: 42,
  component: AnfragenPage,
  kuratorOnly: false,
};

/**
 * Kuration: team-weite Modul-Einstellungen (z.B. ZIM-FAQ-Assistent-URL).
 *
 * Der Name MUSS sich von `anfragenPlugin` unterscheiden: in einem Build mit
 * Kurator-Menüs stehen beide gleichzeitig in der Seitenleiste (Gruppen „In
 * Erprobung" und „Kuration") und trugen bis v2.371 denselben Text und dasselbe
 * Icon — zwei nicht unterscheidbare Einträge mit verschiedenen Zielen.
 */
export const anfragenKurationPlugin: TeamFlowPlugin = {
  id: 'anfragen-kuration',
  route: '/kuration/anfragen',
  featureFlag: 'anfragen',
  name: 'E-Mail Anfragen: Einstellungen',
  icon: 'Mail',
  category: 'kuration',
  order: 30,
  component: AnfragenEinstellungenPage,
  kuratorOnly: true,
};
