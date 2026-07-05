import type { TeamFlowPlugin } from '@/core/types/plugin';
import { SuchSeite } from './SuchSeite';

export const suchePlugin: TeamFlowPlugin = {
  id: 'suche',
  route: '/suche',
  featureFlag: 'suche',
  name: 'Suche',
  icon: 'Search',
  category: 'workflow',
  order: 8,
  component: SuchSeite,
};
