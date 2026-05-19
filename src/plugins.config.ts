import type { TeamFlowPlugin } from '@/core/types/plugin';
import { homePlugin } from '@/plugins/home';
import { einstellungenPlugin } from '@/plugins/einstellungen';
import { bauantraegePlugin } from '@/plugins/bauantraege';
import { dokumentePlugin } from '@/plugins/dokumente/index';
import { chatPlugin } from '@/plugins/chat';
import { suchePlugin } from '@/plugins/suche';
import { adminPlugin } from '@/plugins/kurator';
import { feedbackAdminPlugin } from '@/plugins/feedback';
import { feedbackBoardPlugin } from '@/plugins/feedback-board';
import { devInfrastructureTestPlugin } from '@/plugins/dev-infrastructure-test';
import { devStateInspectorPlugin } from '@/plugins/dev-state-inspector';
import { antraegePlugin } from '@/plugins/antraege';
import { auslastungPlugin } from '@/plugins/auslastung';
import { programmeAdminPlugin } from '@/plugins/programme-kuration';
import { csvSourcesAdminPlugin } from '@/plugins/csv-sources-kuration';
import { filterAdminPlugin } from '@/plugins/filter-kuration';
import { dokumentenquellenKurationPlugin } from '@/plugins/dokumentenquellen-kuration';
import { dokumentReviewPlugin } from '@/plugins/dokument-review';
import { features } from '@/config/feature-flags';

const allPlugins: TeamFlowPlugin[] = [
  homePlugin,
  antraegePlugin,
  bauantraegePlugin,
  auslastungPlugin,
  dokumentePlugin,
  suchePlugin,
  chatPlugin,
  feedbackBoardPlugin,
  einstellungenPlugin,
  adminPlugin,
  programmeAdminPlugin,
  csvSourcesAdminPlugin,
  dokumentenquellenKurationPlugin,
  filterAdminPlugin,
  feedbackAdminPlugin,
  dokumentReviewPlugin,
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

  // features.feedback: entfernt Kurator-Feedback-Verwaltung (Master-Switch).
  // Das User-Plugin "Feedback-Board" hat zusätzlich features.feedbackBoard
  // (siehe unten) — so kann eine Variante die Kurator-Verwaltung freischalten,
  // ohne dass User das Board in der Sidebar sehen.
  if (!features.feedback && p.id === 'feedback-kuration') return false;
  if (!features.feedbackBoard && p.id === 'feedback-board') return false;

  // features.volltextsuche: gated den Suchindex-Kurator (Master-Switch für die
  // Such-Pipeline). Das User-Plugin "Suche" hat zusätzlich features.suche —
  // damit eine kurator-Variante den Index pflegen kann, ohne dass das User-
  // Suche-Plugin in der Sidebar erscheint.
  if (!features.volltextsuche && p.id === 'kurator') return false;
  if (!features.suche && p.id === 'suche') return false;

  // features.chat: User-Plugin Chat.
  if (!features.chat && p.id === 'chat') return false;

  // features.dokumentenscan: entfernt Phase-2-Review-Queue + DMS-Quellen-Verwaltung
  if (!features.dokumentenscan && p.id === 'dokument-review') return false;
  if (!features.dokumentenscan && p.id === 'dokumentenquellen-kuration') return false;

  // features.devInfraPanel: entfernt Dev-Test-Harness
  if (!features.devInfraPanel && p.id === 'dev-infrastructure-test') return false;

  // features.devFixtures: entfernt State-Inspector (Fixture-Sibling, nur mit Fixtures sinnvoll)
  if (!features.devFixtures && p.id === 'dev-state-inspector') return false;

  // Bereichs-Menüs: pro Flag das zugehörige Plugin filtern.
  if (!features.antraege && p.id === 'antraege') return false;
  if (!features.bauantraege && p.id === 'bauantraege') return false;
  if (!features.dokumente && p.id === 'dokumente') return false;
  if (!features.auslastung && p.id === 'auslastung') return false;

  return true;
}

const configFiltered = allPlugins.filter(passesFeatureFlags);

export const enabledPlugins: TeamFlowPlugin[] = pluginFilter
  ? configFiltered.filter(p => pluginFilter.split(',').includes(p.id))
  : configFiltered;
