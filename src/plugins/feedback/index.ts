import type { TeamFlowPlugin } from '@/core/types/plugin';
import { FeedbackAdminPage } from './FeedbackAdminPage';

export const feedbackAdminPlugin: TeamFlowPlugin = {
  id: 'feedback-admin',
  name: 'Feedback',
  icon: 'MessageSquare',
  category: 'admin',
  order: 90,
  component: FeedbackAdminPage,
  adminOnly: true,
};
