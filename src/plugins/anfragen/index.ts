import type { TeamFlowPlugin } from '@/core/types/plugin';
import { AnfragenPage } from './AnfragenPage';

export const anfragenPlugin: TeamFlowPlugin = {
  id: 'anfragen',
  route: '/anfragen',
  featureFlag: 'anfragen',
  name: 'E-Mail Anfragen',
  icon: 'Mail',
  category: 'erprobung',
  order: 42,
  component: AnfragenPage,
  kuratorOnly: false,
};

// Die team-weiten Modul-Einstellungen („E-Mail Anfragen: Einstellungen",
// `/kuration/anfragen`) sind seit v4.34 kein eigenes Plugin mehr, sondern das
// Panel „Dienste" im Kuration-Hub. Ein Menuepunkt fuer ein einziges Textfeld
// war die Sichtbarkeit nicht wert; gelesen und geschrieben wird weiter ueber
// `./settings.ts`.
