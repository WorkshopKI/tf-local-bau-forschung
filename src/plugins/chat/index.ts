import type { TeamFlowPlugin } from '@/core/types/plugin';
import { ChatView } from './ChatView';

export const chatPlugin: TeamFlowPlugin = {
  id: 'chat',
  name: 'Chat',
  icon: 'MessageSquare',
  category: 'tools',
  order: 50,
  component: ChatView,
};
