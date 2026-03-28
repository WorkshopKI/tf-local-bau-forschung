import type { TeamFlowPlugin } from '@/core/types/plugin';
import { useForschungStore } from './store';
import { ForschungListe } from './ForschungListe';
import { ForschungDetail } from './ForschungDetail';

function ForschungPage(): React.ReactElement {
  const selectedId = useForschungStore(s => s.selectedId);
  return selectedId ? <ForschungDetail /> : <ForschungListe />;
}

export const forschungPlugin: TeamFlowPlugin = {
  id: 'forschung',
  name: 'Forschung',
  icon: 'FlaskConical',
  category: 'workflow',
  order: 20,
  component: ForschungPage,
};
