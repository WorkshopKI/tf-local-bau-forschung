import { Shell } from '@/core/Shell';
import { enabledPlugins } from '@/plugins.config';

export function App(): React.ReactElement {
  return <Shell plugins={enabledPlugins} />;
}
