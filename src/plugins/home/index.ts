import type { TeamFlowPlugin } from '@/core/types/plugin';
import { HomePage } from './HomePage';

export const homePlugin: TeamFlowPlugin = {
  id: 'home',
  route: '/',
  name: 'Home',
  icon: 'House',
  category: 'workflow',
  order: 0,
  component: HomePage,
};
