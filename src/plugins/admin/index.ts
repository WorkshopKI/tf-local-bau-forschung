import type { TeamFlowPlugin } from '@/core/types/plugin';
import { IndexManager } from './IndexManager';

export const adminPlugin: TeamFlowPlugin = {
  id: 'admin',
  name: 'Suchindex',
  icon: 'Search',
  category: 'admin',
  order: 95,
  component: IndexManager,
  adminOnly: true,
};
