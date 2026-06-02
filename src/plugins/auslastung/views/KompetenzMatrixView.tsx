/**
 * KompetenzMatrixView (v2.16) — Tab „Kompetenzen" des Auslastungs-Moduls.
 *
 * Tab-Shell für die PL-Kompetenz-Vorbelegung (dichte Skill-Matrix, Design-
 * Handoff-Port). Erzeugt das geteilte `useKompetenzMatrixModel` und reicht es
 * an Toolbar (Speichern) + Matrix (Zell-Edits) durch — so teilen beide einen
 * Draft. Die Toolbar (Lead + XLSX-Upload + Speichern) steht immer, damit auch
 * im Empty-State (noch kein Schema) hochgeladen werden kann.
 */
import { useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { useKompetenzMatrixModel } from '../hooks/useKompetenzMatrixModel';
import { KompetenzImportDialog } from '../components/KompetenzImportDialog';
import { MatrixToolbar } from '../components/kompetenz/MatrixToolbar';
import { KompetenzMatrix } from '../components/kompetenz/KompetenzMatrix';

export function KompetenzMatrixView(): React.ReactElement {
  const storage = useStorage();
  const cache = useAntraegeCache();
  const schema = useAuslastungData(s => s.data.config.kompetenzSchema);
  const model = useKompetenzMatrixModel(storage);
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <MatrixToolbar model={model} onOpenUpload={() => setUploadOpen(true)} />

      {schema && schema.length > 0 ? (
        <KompetenzMatrix model={model} schema={schema} />
      ) : (
        <div className="rounded-[12px] p-8 text-center" style={{ border: '0.5px dashed var(--tf-border)' }}>
          <p className="text-[13px] text-[var(--tf-text-secondary)] mb-1">Noch keine Kompetenz-Matrix vorhanden.</p>
          <p className="text-[12px] text-[var(--tf-text-tertiary)]">
            Lade die PL-Kompetenz-XLSX hoch — danach erscheint hier die editierbare Tabelle.
          </p>
        </div>
      )}

      <KompetenzImportDialog open={uploadOpen} anonymMap={cache.anonymMap} onClose={() => setUploadOpen(false)} />
    </div>
  );
}
