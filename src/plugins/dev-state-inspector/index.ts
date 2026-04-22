import type { TeamFlowPlugin } from '@/core/types/plugin';
import { StateInspectorPanel } from './StateInspectorPanel';

export const devStateInspectorPlugin: TeamFlowPlugin = {
  id: 'dev-state-inspector',
  name: 'DEV: State',
  icon: 'Microscope',
  category: 'kuration',
  order: 98,
  component: StateInspectorPanel,
  kuratorOnly: false,
};
