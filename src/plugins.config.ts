import type { TeamFlowPlugin } from '@/core/types/plugin';
import { homePlugin } from '@/plugins/home';
import { einstellungenPlugin } from '@/plugins/einstellungen';
import { bauantraegePlugin } from '@/plugins/bauantraege';
import { dokumentePlugin } from '@/plugins/dokumente/index';
import { chatPlugin } from '@/plugins/chat';
import { suchePlugin } from '@/plugins/suche';

const allPlugins: TeamFlowPlugin[] = [
  homePlugin,
  bauantraegePlugin,
  dokumentePlugin,
  suchePlugin,
  chatPlugin,
  einstellungenPlugin,
];

const pluginFilter = import.meta.env.VITE_PLUGINS as string | undefined;

export const enabledPlugins: TeamFlowPlugin[] = pluginFilter
  ? allPlugins.filter(p => pluginFilter.split(',').includes(p.id))
  : allPlugins;
