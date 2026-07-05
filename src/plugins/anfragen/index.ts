import type { TeamFlowPlugin } from '@/core/types/plugin';
import { AnfragenPage } from './AnfragenPage';
import { AnfragenEinstellungenPage } from './AnfragenEinstellungenPage';

export const anfragenPlugin: TeamFlowPlugin = {
  id: 'anfragen',
  route: '/anfragen',
  featureFlag: 'anfragen',
  name: 'E-Mail-Anfragen',
  icon: 'Mail',
  category: 'workflow',
  order: 6,
  component: AnfragenPage,
  kuratorOnly: false,
};

/** Kuration: team-weite Modul-Einstellungen (z.B. ZIM-FAQ-Assistent-URL). */
export const anfragenKurationPlugin: TeamFlowPlugin = {
  id: 'anfragen-kuration',
  route: '/kuration/anfragen',
  featureFlag: 'anfragen',
  name: 'E-Mail-Anfragen',
  icon: 'Mail',
  category: 'kuration',
  order: 30,
  component: AnfragenEinstellungenPage,
  kuratorOnly: true,
};
