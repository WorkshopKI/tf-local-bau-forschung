import type { TeamFlowPlugin } from '@/core/types/plugin';
import { useDokumenteStore } from './store';
import { DokumenteListe } from './DokumenteListe';
import { DokumentPreview } from './DokumentPreview';
import { DokumentSidePanel } from './DokumentSidePanel';

function DokumentePage(): React.ReactElement {
  const selectedId = useDokumenteStore(s => s.selectedId);
  const viewingFullDoc = useDokumenteStore(s => s.viewingFullDoc);

  // „Öffnen"-Modus: Fullscreen-Markdown-View statt Liste/Side-Panel.
  if (viewingFullDoc && selectedId) {
    return <DokumentPreview />;
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-60px)] overflow-hidden">
      <DokumenteListe narrow={!!selectedId} />
      {selectedId ? <DokumentSidePanel /> : null}
    </div>
  );
}

export const dokumentePlugin: TeamFlowPlugin = {
  id: 'dokumente',
  route: '/dokumente',
  featureFlag: 'dokumente',
  name: 'Dokumente',
  icon: 'FileText',
  category: 'tools',
  order: 30,
  component: DokumentePage,
};
