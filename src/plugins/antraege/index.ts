import type { TeamFlowPlugin } from '@/core/types/plugin';
import { AntraegePage } from './AntraegePage';

export const antraegePlugin: TeamFlowPlugin = {
  id: 'antraege',
  name: 'Förderanträge',
  icon: 'FileText',
  category: 'workflow',
  order: 2,
  component: AntraegePage,
  kuratorOnly: false,
};
