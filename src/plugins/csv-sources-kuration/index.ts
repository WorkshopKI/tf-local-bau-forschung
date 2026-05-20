import type { TeamFlowPlugin } from '@/core/types/plugin';
import { CsvSourcesPage } from './CsvSourcesPage';

export const csvSourcesAdminPlugin: TeamFlowPlugin = {
  id: 'csv-sources-kuration',
  route: '/kuration/csv-quellen',
  name: 'CSV-Quellen',
  icon: 'Database',
  category: 'kuration',
  order: 10,
  component: CsvSourcesPage,
  kuratorOnly: true,
};
