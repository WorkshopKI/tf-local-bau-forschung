import type { TeamFlowPlugin } from '@/core/types/plugin';
import { ProgrammeAdminPage } from './ProgrammeAdminPage';

export const programmeAdminPlugin: TeamFlowPlugin = {
  id: 'programme-kuration',
  name: 'Programme',
  icon: 'FolderCog',
  category: 'kuration',
  order: 80,
  component: ProgrammeAdminPage,
  kuratorOnly: true,
};
