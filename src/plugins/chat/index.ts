import type { TeamFlowPlugin } from '@/core/types/plugin';
import { ChatView } from './ChatView';

export const chatPlugin: TeamFlowPlugin = {
  id: 'chat',
  route: '/chat',
  name: 'Chat',
  icon: 'MessageSquare',
  // Temporär in der Arbeits-Gruppe unter Suche (Journey-Paket 1, Phase 1).
  // Phase 4 setzt `hideFromNav` und verlegt den Chat als Assistenten-Panel in
  // die Suche; der Nav-Eintrag verschwindet dann, die Route bleibt erreichbar.
  category: 'workflow',
  order: 9,
  component: ChatView,
};
