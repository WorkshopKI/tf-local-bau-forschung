import type { TeamFlowPlugin } from '@/core/types/plugin';
import { EinstellungenPage } from './EinstellungenPage';

export const einstellungenPlugin: TeamFlowPlugin = {
  id: 'einstellungen',
  name: 'Einstellungen',
  icon: 'Settings',
  category: 'tools',
  order: 90,
  component: EinstellungenPage,
};
