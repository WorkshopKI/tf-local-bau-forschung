import type { TeamFlowPlugin } from '@/core/types/plugin';
import { homePlugin } from '@/plugins/home';
import { einstellungenPlugin } from '@/plugins/einstellungen';
import { dokumentePlugin } from '@/plugins/dokumente/index';
import { suchePlugin } from '@/plugins/suche';
import { feedbackBoardPlugin } from '@/plugins/feedback-board';
import { devInfrastructureTestPlugin } from '@/plugins/dev-infrastructure-test';
import { devStateInspectorPlugin } from '@/plugins/dev-state-inspector';
import { antraegePlugin } from '@/plugins/antraege';
import { anfragenPlugin } from '@/plugins/anfragen';
import { kurationPlugin } from '@/plugins/kuration';
import { auslastungPlugin } from '@/plugins/auslastung';
import { csvSourcesAdminPlugin } from '@/plugins/csv-sources-kuration';
import { dokumentReviewPlugin } from '@/plugins/dokument-review';
import { skillVerwaltungPlugin } from '@/plugins/skill-verwaltung-kuration';
import { mapFoerderfaehigPlugin } from '@/plugins/map-foerderfaehig';
import { statusCockpitPlugin } from '@/plugins/status-cockpit';
import { meilensteinePlugin } from '@/plugins/meilensteine';
import { vorgangsBoardPlugin } from '@/plugins/vorgangs-board';
import { zuKlaerenPlugin } from '@/plugins/zu-klaeren';
import { glossarPlugin } from '@/plugins/glossar';
import { features } from '@/config/feature-flags';

const allPlugins: TeamFlowPlugin[] = [
  homePlugin,
  antraegePlugin,
  anfragenPlugin,
  mapFoerderfaehigPlugin,
  meilensteinePlugin,
  vorgangsBoardPlugin,
  statusCockpitPlugin,
  auslastungPlugin,
  dokumentePlugin,
  suchePlugin,
  glossarPlugin,
  zuKlaerenPlugin,
  feedbackBoardPlugin,
  skillVerwaltungPlugin,
  einstellungenPlugin,
  kurationPlugin,
  csvSourcesAdminPlugin,
  dokumentReviewPlugin,
  devInfrastructureTestPlugin,
  devStateInspectorPlugin,
];

/**
 * Plugin-ID → Route-Pfad. Wird aus den Plugin-Definitionen (`p.route`)
 * abgeleitet — bitte NICHT diese Map manuell pflegen. Neue Plugins setzen
 * `route` direkt in ihrer Plugin-Definition; sie tauchen dann automatisch
 * hier auf.
 *
 * Konsumenten:
 *   - `src/core/routes.ts` (pluginIdToRoute / routeToPluginId)
 *   - `src/core/Router.tsx` (flatRoutePluginIds → React-Router-Children)
 */
export const PLUGIN_ROUTES: Record<string, string> = Object.fromEntries(
  allPlugins.map(p => [p.id, p.route]),
);

/**
 * Plugin-IDs mit "einfacher" Route (keine eigene Sub-Routen-Struktur wie
 * `antraege/verbund/:verbundId`). Diese werden im Router als simple
 * `{ path, element }`-Children registriert.
 *
 * Plugins MIT Custom-Route-Handlern (home, antraege) werden im Router
 * explizit verdrahtet und sind hier ausgenommen.
 */
const PLUGINS_WITH_CUSTOM_ROUTE = new Set(['home', 'antraege']);
export const FLAT_ROUTE_PLUGIN_IDS: string[] = allPlugins
  .filter(p => !PLUGINS_WITH_CUSTOM_ROUTE.has(p.id))
  .map(p => p.id);

/**
 * Build-Time-Flag-Filter. Eindampfung gegenueber dem fruehen Stand mit ~15
 * verstreuten if-Statements:
 *
 *   1. Kategorie `kuration` wird global vom `kuratorMenus`-Flag gegated.
 *   2. Jedes Plugin trägt optional ein `featureFlag` in seiner Definition;
 *      ist es gesetzt und auf `false`, wird das Plugin gefiltert.
 *
 * Neue Plugins brauchen keinen Eintrag mehr hier — `featureFlag` im Plugin
 * selbst setzen genuegt. Doppelplugins (z.B. `dokument-review` +
 * `dokumentenquellen-kuration` beide unter `dokumentenscan`) funktionieren
 * automatisch.
 *
 * Hinweis: Der Build-Time-Filter reicht allein NICHT fuer Kuration-Sichtbarkeit
 * — Runtime-Toggle `profile.is_kurator` wird zusaetzlich in `ShellLayout`
 * berücksichtigt.
 */
function passesFeatureFlags(p: TeamFlowPlugin): boolean {
  if (!features.kuratorMenus && p.category === 'kuration') return false;
  if (p.featureFlag && !features[p.featureFlag]) return false;
  return true;
}

const configFiltered = allPlugins.filter(passesFeatureFlags);

const pluginFilter = import.meta.env.VITE_PLUGINS as string | undefined;

export const enabledPlugins: TeamFlowPlugin[] = pluginFilter
  ? configFiltered.filter(p => pluginFilter.split(',').includes(p.id))
  : configFiltered;
