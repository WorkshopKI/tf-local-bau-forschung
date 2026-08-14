import type { TeamFlowPlugin } from '@/core/types/plugin';
import { KurationPage } from './KurationPage';

/**
 * Der Kuration-Hub (v4.34): eine Seite statt bisher sieben Sidebar-Eintraege.
 *
 * `order: 10` haelt ihn an der Spitze seiner Gruppe — er ist der Einstieg, die
 * eigenstaendig gebliebenen Seiten (CSV-Quellen, Dokument-Review) stehen
 * darunter. Alte `/kuration/<seite>`-Lesezeichen fangen die Redirects in
 * `src/core/routes.ts` und landen im passenden Panel.
 *
 * Seiten-Hilfe: `docs/feedback-kontext/kuration.md` — dasselbe Doc, das die
 * uebrigen Kuration-Seiten teilen.
 */
export const kurationPlugin: TeamFlowPlugin = {
  id: 'kuration',
  route: '/kuration',
  name: 'Kuration',
  icon: 'FolderCog',
  category: 'kuration',
  order: 10,
  kuratorOnly: true,
  component: KurationPage,
};
