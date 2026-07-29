import type { TeamFlowPlugin } from '@/core/types/plugin';
import { EinstellungenPage } from './EinstellungenPage';

/**
 * Einstellungen — seit v2.360 NICHT mehr in der Nav-Liste (`hideFromNav`),
 * sondern als Zahnrad in der Sidebar-Fußzeile neben der Versionsnummer
 * (`FooterSettingsButton`). Die Route bleibt registriert (der Router liest die
 * ungefilterte Plugin-Liste), ebenso `Strg+Umschalt+E` — dessen Registrierung
 * prüft gegen `visiblePlugins`, nicht gegen `navVisiblePlugins`. Der
 * Command-Palette-Eintrag hängt dagegen an der Nav-Liste und wird im ShellLayout
 * explizit ergänzt.
 */
export const einstellungenPlugin: TeamFlowPlugin = {
  id: 'einstellungen',
  route: '/einstellungen',
  name: 'Einstellungen',
  icon: 'Settings',
  category: 'system',
  order: 20,
  hideFromNav: true,
  component: EinstellungenPage,
};
