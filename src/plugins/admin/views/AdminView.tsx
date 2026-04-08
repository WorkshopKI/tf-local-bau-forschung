import { useStorage } from '@/core/hooks/useStorage';
import { DirectoriesStep } from '../steps/DirectoriesStep';
import { DocumentsStep } from '../steps/DocumentsStep';
import { IndexStep } from '../steps/IndexStep';
import { EvalSection } from '../eval/EvalSection';
import { SeedContent } from '../IndexHelpers';

interface AdminViewProps {
  chunkCount: number;
  docCount: number;
  activeModelId: string;
  seeded: boolean;
  seeding: boolean;
  seedProgress: string;
  indexOutdated: boolean;
  hasGPU: boolean;
  setDocCount: (n: number) => void;
  setChunkCount: (n: number) => void;
  setLastUpdate: (s: string | null) => void;
  setActiveModelIdState: (id: string) => void;
  setIndexModelId: (s: string | null) => void;
  setSeeded: (v: boolean) => void;
  setSeeding: (v: boolean) => void;
  setSeedProgress: (v: string) => void;
  setNewDocsCount: (n: number) => void;
}

function AdminPanel({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="py-4" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[11px] uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)]">
          {title}
        </span>
        {subtitle && (
          <span className="text-[11px] text-[var(--tf-text-tertiary)]">{subtitle}</span>
        )}
      </div>
      {children}
    </div>
  );
}

export function AdminView({
  chunkCount, docCount, activeModelId,
  seeded, seeding, seedProgress, indexOutdated, hasGPU,
  setDocCount, setChunkCount, setLastUpdate, setActiveModelIdState,
  setIndexModelId, setSeeded, setSeeding, setSeedProgress, setNewDocsCount,
}: AdminViewProps): React.ReactElement {
  const storage = useStorage();
  const directories = storage.getDirectories();
  const dirSubtitle = directories.length > 0
    ? `${directories.length} verbunden`
    : 'Nicht verbunden';

  const docSubtitle = docCount > 0 ? `${docCount} Dokumente` : 'Keine Dokumente';

  const indexSubtitle = chunkCount > 0
    ? `${chunkCount} Chunks`
    : 'Nicht indexiert';

  const seedSubtitle = seeded ? '40 Vorg\u00e4nge \u00b7 60 Dokumente' : 'Nicht vorhanden';

  return (
    <div>
      {/* Panel 1: Verzeichnisse */}
      <AdminPanel title="Verzeichnisse" subtitle={dirSubtitle}>
        <DirectoriesStep />
      </AdminPanel>

      {/* Panel 2: Dokumente */}
      <AdminPanel title="Dokumente" subtitle={docSubtitle}>
        <DocumentsStep
          docCount={docCount} setDocCount={setDocCount}
          setSeeded={setSeeded}
          setChunkCount={setChunkCount} setLastUpdate={setLastUpdate}
          setIndexModelId={setIndexModelId} setNewDocsCount={setNewDocsCount}
        />
      </AdminPanel>

      {/* Panel 3: Suchindex */}
      <AdminPanel title="Suchindex" subtitle={indexSubtitle}>
        <IndexStep
          activeModelId={activeModelId} setActiveModelIdState={setActiveModelIdState}
          setIndexModelId={setIndexModelId}
          setChunkCount={setChunkCount}
          docCount={docCount} setLastUpdate={setLastUpdate}
          indexOutdated={indexOutdated} setNewDocsCount={setNewDocsCount}
          hasGPU={hasGPU}
        />
      </AdminPanel>

      {/* Panel 4: Qualitaetscheck */}
      <AdminPanel title="Qualitätscheck">
        <EvalSection chunkCount={chunkCount} modelId={activeModelId} />
      </AdminPanel>

      {/* Panel 5: Testdaten */}
      <AdminPanel title="Testdaten" subtitle={seedSubtitle}>
        <SeedContent
          storage={storage} seeded={seeded} seeding={seeding}
          seedProgress={seedProgress} setSeeded={setSeeded}
          setSeeding={setSeeding} setSeedProgress={setSeedProgress}
          setDocCount={setDocCount}
        />
      </AdminPanel>
    </div>
  );
}
