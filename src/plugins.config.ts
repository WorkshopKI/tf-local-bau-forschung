import type { TeamFlowPlugin } from '@/core/types/plugin';
import { homePlugin } from '@/plugins/home';
import { einstellungenPlugin } from '@/plugins/einstellungen';
import { bauantraegePlugin } from '@/plugins/bauantraege';

const allPlugins: TeamFlowPlugin[] = [
  homePlugin,
  bauantraegePlugin,
  einstellungenPlugin,
];

const pluginFilter = import.meta.env.VITE_PLUGINS as string | undefined;

export const enabledPlugins: TeamFlowPlugin[] = pluginFilter
  ? allPlugins.filter(p => pluginFilter.split(',').includes(p.id))
  : allPlugins;
