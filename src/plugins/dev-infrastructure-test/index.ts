import type { TeamFlowPlugin } from '@/core/types/plugin';
import { DevPanel } from './DevPanel';

export const devInfrastructureTestPlugin: TeamFlowPlugin = {
  id: 'dev-infrastructure-test',
  route: '/dev-infrastructure-test',
  featureFlag: 'devInfraPanel',
  name: 'DEV: Infra',
  icon: 'FlaskConical',
  category: 'werkbank',
  order: 99,
  component: DevPanel,
  kuratorOnly: false,
};
