/**
 * Status-Cockpit — Statuswerte kuratieren, Wirkung simulieren, versionieren.
 *
 * Eigenständiges Werkzeug-Plugin über dem Status-Katalog (`src/core/status/`):
 * macht die früher hartkodierte Status→Kategorie/Spine-Map zu kuratierbaren,
 * versionierten Daten. Gerätelokal — Portabilität nur über JSON-Export/Import.
 *
 * Doku: docs/architecture/ (Status-System neu).
 */
import type { TeamFlowPlugin } from '@/core/types/plugin';
import { StatusCockpitPage } from './StatusCockpitPage';

export const statusCockpitPlugin: TeamFlowPlugin = {
  id: 'status-cockpit',
  route: '/status-cockpit',
  featureFlag: 'statusCockpit',
  name: 'Status-Katalog',
  icon: 'ListChecks',
  category: 'tools',
  order: 8,
  component: StatusCockpitPage,
};

export { StatusCockpitPage } from './StatusCockpitPage';
