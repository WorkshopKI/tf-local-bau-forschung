import type { TeamFlowPlugin } from '@/core/types/plugin';
import { ChatRedirect } from './ChatRedirect';

export const chatPlugin: TeamFlowPlugin = {
  id: 'chat',
  route: '/chat',
  name: 'Chat',
  icon: 'MessageSquare',
  category: 'workflow',
  order: 9,
  // Phase 4 (Journey-Paket 1): Der Chat lebt als andockendes „Assistent"-Panel
  // in der Suche ([ChatPanelHost](./ChatPanelHost.tsx)). Kein Nav-Eintrag mehr
  // (`hideFromNav`), aber die Route bleibt als @deprecated Redirect erreichbar
  // (Feld-Bookmarks) und leitet auf `/suche?assistent=1`.
  hideFromNav: true,
  component: ChatRedirect,
};
