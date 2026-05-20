import type { TeamFlowPlugin } from '@/core/types/plugin';
import { StateInspectorPanel } from './StateInspectorPanel';

export const devStateInspectorPlugin: TeamFlowPlugin = {
  id: 'dev-state-inspector',
  route: '/dev-state-inspector',
  featureFlag: 'devFixtures',
  name: 'DEV: State',
  icon: 'Microscope',
  category: 'kuration',
  order: 98,
  component: StateInspectorPanel,
  kuratorOnly: false,
};
