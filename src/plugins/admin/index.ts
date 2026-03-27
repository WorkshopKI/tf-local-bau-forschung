import type { TeamFlowPlugin } from '@/core/types/plugin';
import { IndexManager } from './IndexManager';

export const adminPlugin: TeamFlowPlugin = {
  id: 'admin',
  name: 'Admin',
  icon: 'Shield',
  category: 'admin',
  order: 95,
  component: IndexManager,
  adminOnly: true,
};
