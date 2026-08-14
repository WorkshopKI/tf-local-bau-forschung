import type { TeamFlowPlugin } from '@/core/types/plugin';
import { KurationPage } from './KurationPage';
import { KURATION_SEITENNAME } from './kurationPanels';

/**
 * Der Kuration-Hub (v4.34): eine Seite statt bisher sieben Sidebar-Eintraege.
 *
 * `order: 10` haelt ihn an der Spitze seiner Gruppe — er ist der Einstieg,
 * Dokument-Review als eigene Arbeitsflaeche steht darunter. Alte
 * `/kuration/<seite>`-Lesezeichen fangen die Redirects in `src/core/routes.ts`
 * und landen im passenden Panel.
 *
 * Die Id bleibt `kuration` (Route, Kontext-Doc, Feature-Gate haengen daran);
 * nur der ANGEZEIGTE Name kommt aus `KURATION_SEITENNAME` — siehe dort, warum
 * er nicht wie seine Sidebar-Gruppe heisst.
 *
 * Seiten-Hilfe: `docs/feedback-kontext/kuration.md` — dasselbe Doc, das die
 * uebrigen Kuration-Seiten teilen.
 */
export const kurationPlugin: TeamFlowPlugin = {
  id: 'kuration',
  route: '/kuration',
  name: KURATION_SEITENNAME,
  icon: 'FolderCog',
  category: 'kuration',
  order: 10,
  kuratorOnly: true,
  component: KurationPage,
};
