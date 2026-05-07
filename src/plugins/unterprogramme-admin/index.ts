import type { TeamFlowPlugin } from '@/core/types/plugin';
import { UnterprogrammeAdminPage } from './UnterprogrammeAdminPage';

export const unterprogrammeAdminPlugin: TeamFlowPlugin = {
  id: 'unterprogramme-kuration',
  name: 'Unterprogramme',
  icon: 'Layers',
  category: 'kuration',
  order: 82,
  component: UnterprogrammeAdminPage,
  kuratorOnly: true,
};
