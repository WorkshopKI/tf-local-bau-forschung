import type { TeamFlowPlugin } from '@/core/types/plugin';
import { FeedbackBoardPage } from './FeedbackBoardPage';

export const feedbackBoardPlugin: TeamFlowPlugin = {
  id: 'feedback-board',
  route: '/feedback-board',
  name: 'Feedback',
  icon: 'TrendingUp',
  category: 'tools',
  order: 75,
  component: FeedbackBoardPage,
};
