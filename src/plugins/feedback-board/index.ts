import type { TeamFlowPlugin } from '@/core/types/plugin';
import { FeedbackBoardPage } from './FeedbackBoardPage';

export const feedbackBoardPlugin: TeamFlowPlugin = {
  id: 'feedback-board',
  route: '/feedback-board',
  name: 'Feedback',
  icon: 'TrendingUp',
  category: 'tools',
  order: 24,
  // Nav-Eintrag „Feedback" im oberen Arbeits-Block (tools-Gruppe, nach den
  // workflow-Items). Nur sichtbar wo `features.feedback` aktiv ist.
  component: FeedbackBoardPage,
};
