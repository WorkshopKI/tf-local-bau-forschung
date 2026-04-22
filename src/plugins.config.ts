import type { TeamFlowPlugin } from '@/core/types/plugin';
import { homePlugin } from '@/plugins/home';
import { einstellungenPlugin } from '@/plugins/einstellungen';
import { bauantraegePlugin } from '@/plugins/bauantraege';
import { dokumentePlugin } from '@/plugins/dokumente/index';
import { chatPlugin } from '@/plugins/chat';
import { suchePlugin } from '@/plugins/suche';
import { adminPlugin } from '@/plugins/admin';
import { feedbackAdminPlugin } from '@/plugins/feedback';
import { feedbackBoardPlugin } from '@/plugins/feedback-board';
import { devInfrastructureTestPlugin } from '@/plugins/dev-infrastructure-test';
import { devStateInspectorPlugin } from '@/plugins/dev-state-inspector';
import { antraegePlugin } from '@/plugins/antraege';
import { programmeAdminPlugin } from '@/plugins/programme-admin';
import { csvSourcesAdminPlugin } from '@/plugins/csv-sources-admin';
import { filterAdminPlugin } from '@/plugins/filter-admin';
import { unterprogrammeAdminPlugin } from '@/plugins/unterprogramme-admin';
import { features } from '@/config/feature-flags';

const allPlugins: TeamFlowPlugin[] = [
  homePlugin,
  antraegePlugin,
  bauantraegePlugin,
  dokumentePlugin,
  suchePlugin,
  chatPlugin,
  feedbackBoardPlugin,
  einstellungenPlugin,
  adminPlugin,
  programmeAdminPlugin,
  csvSourcesAdminPlugin,
  unterprogrammeAdminPlugin,
  filterAdminPlugin,
  feedbackAdminPlugin,
  devInfrastructureTestPlugin,
  devStateInspectorPlugin,
];

const pluginFilter = import.meta.env.VITE_PLUGINS as string | undefined;

function passesFeatureFlags(p: TeamFlowPlugin): boolean {
  // features.kuratorMenus: blendet komplette Kurator-Kategorie aus.
  // WICHTIG: Dieser Build-Time-Filter reicht allein NICHT. Das Flag muss
  // zusätzlich zur Runtime in EinstellungenPage (Toggle-Sichtbarkeit) und
  // ShellLayout (isKurator-Ableitung) konsultiert werden, sonst kann ein
  // Nutzer den Kurator-Modus via Profile-Toggle in einer Variante
  // `kuratorMenus: false` aktivieren und würde damit jeden künftigen Plugin
  // sehen, der `kuratorOnly: true` aber eine andere `category` trägt.
  // Siehe isKuratorMenusEnabled() in feature-flags.ts.
  if (!features.kuratorMenus && p.category === 'kuration') return false;

  // features.feedback: entfernt sowohl Board als auch Kurator-Verwaltung
  if (!features.feedback && (p.id === 'feedback-kuration' || p.id === 'feedback-board')) {
    return false;
  }

  // features.volltextsuche: entfernt User-Suche und Suchindex-Kuration
  if (!features.volltextsuche && (p.id === 'suche' || p.id === 'kurator')) {
    return false;
  }

  // features.devInfraPanel: entfernt Dev-Test-Harness
  if (!features.devInfraPanel && p.id === 'dev-infrastructure-test') return false;

  // features.devFixtures: entfernt State-Inspector (Fixture-Sibling, nur mit Fixtures sinnvoll)
  if (!features.devFixtures && p.id === 'dev-state-inspector') return false;

  // Bereichs-Menüs: pro Flag das zugehörige Plugin filtern.
  if (!features.antraege && p.id === 'antraege') return false;
  if (!features.bauantraege && p.id === 'bauantraege') return false;
  if (!features.dokumente && p.id === 'dokumente') return false;

  return true;
}

const configFiltered = allPlugins.filter(passesFeatureFlags);

export const enabledPlugins: TeamFlowPlugin[] = pluginFilter
  ? configFiltered.filter(p => pluginFilter.split(',').includes(p.id))
  : configFiltered;
