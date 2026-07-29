import type { TeamFlowPlugin } from '@/core/types/plugin';
import { SuchSeite } from './SuchSeite';

export const suchePlugin: TeamFlowPlugin = {
  id: 'suche',
  route: '/suche',
  featureFlag: 'suche',
  name: 'Suche',
  icon: 'Search',
  // Stabil, aber seltener gebraucht als Förderanträge/Auslastung → „Werkzeuge".
  category: 'tools',
  order: 20,
  component: SuchSeite,
};
