import type { TeamFlowPlugin } from '@/core/types/plugin';
import { EinstellungenPage } from './EinstellungenPage';

export const einstellungenPlugin: TeamFlowPlugin = {
  id: 'einstellungen',
  route: '/einstellungen',
  name: 'Einstellungen',
  icon: 'Settings',
  category: 'system',
  order: 20,
  component: EinstellungenPage,
};
