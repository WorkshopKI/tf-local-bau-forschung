import type { TeamFlowPlugin } from '@/core/types/plugin';
import { FeedbackKurationRedirect } from './FeedbackKurationRedirect';

/**
 * @deprecated Nur noch ein Redirect (v2.364). Das frühere Kurator-Dashboard
 * („Kuration → Feedback", 5 Tabs) ist im Feedback-Board aufgegangen: die
 * Ticket-Felder hängen am Ticket selbst, Inbox/FAQ/Sponsoring/Einstellungen im
 * Verwaltungs-Dialog des Boards. Damit gibt es EINE Feedback-Oberfläche.
 *
 * `category: 'tools'` statt `'kuration'`: die Route soll in JEDER Variante
 * erreichbar bleiben (die kuration-Kategorie wird in pl/prod/as vom
 * `kuratorMenus`-Flag komplett herausgefiltert). `hideFromNav` nimmt den Eintrag
 * aus Sidebar UND Befehlssuche, ohne die Route zu deregistrieren.
 */
export const feedbackAdminPlugin: TeamFlowPlugin = {
  id: 'feedback-kuration',
  route: '/kuration/feedback',
  featureFlag: 'feedback',
  name: 'Feedback',
  icon: 'MessageSquare',
  category: 'tools',
  order: 90,
  hideFromNav: true,
  component: FeedbackKurationRedirect,
};
