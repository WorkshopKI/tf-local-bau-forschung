import type { TeamFlowPlugin } from '@/core/types/plugin';
import { AnfragenPage } from './AnfragenPage';

export const anfragenPlugin: TeamFlowPlugin = {
  id: 'anfragen',
  route: '/anfragen',
  featureFlag: 'anfragen',
  name: 'Anfragen',
  icon: 'Mail',
  category: 'workflow',
  order: 6,
  component: AnfragenPage,
  kuratorOnly: false,
};
