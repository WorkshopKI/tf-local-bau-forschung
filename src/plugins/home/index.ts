import type { TeamFlowPlugin } from '@/core/types/plugin';
import { HomePage } from './HomePage';

export const homePlugin: TeamFlowPlugin = {
  id: 'home',
  name: 'Home',
  icon: 'House',
  category: 'tools',
  order: 0,
  component: HomePage,
};
