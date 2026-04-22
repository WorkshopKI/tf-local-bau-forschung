import type { TeamFlowPlugin } from '@/core/types/plugin';
import { FeedbackAdminPage } from './FeedbackAdminPage';

export const feedbackAdminPlugin: TeamFlowPlugin = {
  id: 'feedback-kuration',
  name: 'Feedback',
  icon: 'MessageSquare',
  category: 'kuration',
  order: 90,
  component: FeedbackAdminPage,
  kuratorOnly: true,
};
