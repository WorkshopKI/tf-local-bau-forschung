import type { TeamFlowPlugin } from '@/core/types/plugin';
import { IndexManager } from './IndexManager';

export const adminPlugin: TeamFlowPlugin = {
  id: 'kurator',
  name: 'Suchindex',
  icon: 'Search',
  category: 'kuration',
  order: 95,
  component: IndexManager,
  kuratorOnly: true,
};
