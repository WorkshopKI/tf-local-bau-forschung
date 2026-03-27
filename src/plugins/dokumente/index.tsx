import type { TeamFlowPlugin } from '@/core/types/plugin';
import { useDokumenteStore } from './store';
import { DokumenteListe } from './DokumenteListe';
import { DokumentPreview } from './DokumentPreview';

function DokumentePage(): React.ReactElement {
  const selectedId = useDokumenteStore(s => s.selectedId);
  return selectedId ? <DokumentPreview /> : <DokumenteListe />;
}

export const dokumentePlugin: TeamFlowPlugin = {
  id: 'dokumente',
  name: 'Dokumente',
  icon: 'FileText',
  category: 'tools',
  order: 30,
  component: DokumentePage,
};
