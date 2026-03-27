import type { TeamFlowPlugin } from '@/core/types/plugin';
import { SuchSeite } from './SuchSeite';

export const suchePlugin: TeamFlowPlugin = {
  id: 'suche',
  name: 'Suche',
  icon: 'Search',
  category: 'tools',
  order: 40,
  component: SuchSeite,
};
