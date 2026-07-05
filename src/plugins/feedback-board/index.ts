import type { TeamFlowPlugin } from '@/core/types/plugin';
import { FeedbackBoardPage } from './FeedbackBoardPage';

export const feedbackBoardPlugin: TeamFlowPlugin = {
  id: 'feedback-board',
  route: '/feedback-board',
  name: 'Feedback',
  icon: 'TrendingUp',
  category: 'tools',
  order: 75,
  // Kein Nav-Eintrag mehr (Journey-Paket 1): das Board wird über den Feedback-
  // Dialog (Footer-Icon → „Feedback-Board →") erreicht. Route bleibt registriert,
  // damit bestehende Bookmarks/Deep-Links weiter auflösen.
  hideFromNav: true,
  component: FeedbackBoardPage,
};
