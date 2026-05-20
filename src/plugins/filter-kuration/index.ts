import type { TeamFlowPlugin } from '@/core/types/plugin';
import { FilterAdminPage } from './FilterAdminPage';

export const filterAdminPlugin: TeamFlowPlugin = {
  id: 'filter-kuration',
  route: '/kuration/filter',
  name: 'Filter verwalten',
  icon: 'SlidersHorizontal',
  category: 'kuration',
  order: 85,
  component: FilterAdminPage,
  kuratorOnly: true,
};
