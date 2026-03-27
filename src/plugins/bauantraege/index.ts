import type { TeamFlowPlugin } from '@/core/types/plugin';
import { BauantraegePage } from './BauantraegePage';
import { useBauantraegeStore } from './store';

export const bauantraegePlugin: TeamFlowPlugin = {
  id: 'bauantraege',
  name: 'Bauanträge',
  icon: 'Building2',
  category: 'workflow',
  order: 10,
  component: BauantraegePage,
  badge: () => {
    const count = useBauantraegeStore.getState().bauantraege.filter(v => v.status === 'neu').length;
    return count > 0 ? count : null;
  },
};
