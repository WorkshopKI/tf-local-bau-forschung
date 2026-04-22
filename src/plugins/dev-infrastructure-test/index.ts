import type { TeamFlowPlugin } from '@/core/types/plugin';
import { DevPanel } from './DevPanel';

export const devInfrastructureTestPlugin: TeamFlowPlugin = {
  id: 'dev-infrastructure-test',
  name: 'DEV: Infra',
  icon: 'FlaskConical',
  category: 'kuration',
  order: 99,
  component: DevPanel,
  kuratorOnly: false,
};
