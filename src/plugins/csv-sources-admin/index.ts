import type { TeamFlowPlugin } from '@/core/types/plugin';
import { CsvSourcesPage } from './CsvSourcesPage';

export const csvSourcesAdminPlugin: TeamFlowPlugin = {
  id: 'csv-sources-kuration',
  name: 'CSV-Quellen',
  icon: 'Database',
  category: 'kuration',
  order: 81,
  component: CsvSourcesPage,
  kuratorOnly: true,
};
