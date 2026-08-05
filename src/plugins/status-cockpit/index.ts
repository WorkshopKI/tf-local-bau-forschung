/**
 * **Vorgangs-Regeln** — die Grundlagen, auf denen Status, Fristen und To-dos
 * beruhen: Statuswerte, Kürzel des Fachsystems, To-do-Kaskade.
 *
 * Eigenständiges Plugin über dem Status-Katalog (`src/core/status/`): macht die
 * früher hartkodierten Tabellen zu kuratierbaren, versionierten Team-Daten.
 *
 * **Anzeigename und Ordnername fallen bewusst auseinander.** Der Ordner heißt
 * weiter `status-cockpit`, die Route `/status-cockpit`, die Plugin-Id ebenso —
 * eine Umbenennung im Code wäre eine große Änderungsmenge ohne Nutzen und bräche
 * Lesezeichen. Sichtbar geändert hat sich mit v2.412 nur der Name: unter
 * „Status-Katalog" vermutete niemand die Regeln, und das Paar
 * *Vorgangs-Board* / *Vorgangs-Regeln* macht im Namen sichtbar, dass das eine
 * die To-dos zeigt, die das andere definiert. `order: 46` hält die beiden in
 * der Navigation nebeneinander (Board 45).
 *
 * Doku: docs/architecture/vorgangssystem.md, docs/status-system/README.md.
 */
import type { TeamFlowPlugin } from '@/core/types/plugin';
import { StatusCockpitPage } from './StatusCockpitPage';

export const statusCockpitPlugin: TeamFlowPlugin = {
  id: 'status-cockpit',
  route: '/status-cockpit',
  featureFlag: 'statusCockpit',
  name: 'Vorgangs-Regeln',
  icon: 'ListChecks',
  category: 'erprobung',
  order: 46,
  component: StatusCockpitPage,
};

export { StatusCockpitPage } from './StatusCockpitPage';
