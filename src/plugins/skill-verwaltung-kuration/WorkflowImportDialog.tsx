/**
 * Import-Dialog für ein Workflow-Bündel (.json). Wählt eine Datei, validiert sie via
 * `parseWorkflowBundle`, zeigt eine Vorschau inkl. Konflikt-Hinweis und übernimmt das
 * Bündel via `importWorkflowBundle` + persist. Kanonischer `Dialog` (kein Raw-Modal).
 * Referenzierte Skills reisen mit; ID-Kollisionen werden dupliziert (nie überschrieben).
 */
import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  parseWorkflowBundle,
  importWorkflowBundle,
  type WorkflowBundleJson,
  type SkillRegistryFile,
} from '@/core/services/skills';

interface WorkflowImportDialogProps {
  file: SkillRegistryFile;
  persist: (next: SkillRegistryFile) => Promise<void>;
  onClose: () => void;
  onImported?: (workflowId: string) => void;
}

export function WorkflowImportDialog({ file, persist, onClose, onImported }: WorkflowImportDialogProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [bundle, setBundle] = useState<WorkflowBundleJson | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dateiName, setDateiName] = useState<string | null>(null);

  const konflikt = bundle ? (file.workflows ?? []).some(w => w.id === bundle.workflow.id) : false;

  const onPick = async (f: File | undefined): Promise<void> => {
    if (!f) return;
    setDateiName(f.name);
    setParseError(null);
    setBundle(null);
    try {
      const parsed = parseWorkflowBundle(JSON.parse(await f.text()));
      if (!parsed) { setParseError('Keine gültige Workflow-Bündel-Datei.'); return; }
      setBundle(parsed);
    } catch {
      setParseError('Datei ist kein gültiges JSON.');
    }
  };

  const doImport = useAsyncAction(async () => {
    if (!bundle) return;
    const res = importWorkflowBundle(file, bundle, { newId: () => crypto.randomUUID() });
    await persist(res.file);
    onImported?.(res.importedWorkflowId);
  }, { onSuccess: onClose });

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title="Workflow-Bündel importieren"
      description="Lädt einen Workflow samt referenzierten Skills und Regeln aus einer .json-Datei. Antragsdaten sind nie enthalten."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button
            variant="primary"
            disabled={!bundle}
            loading={doImport.busy}
            onClick={() => { void doImport.run(); }}
          >
            Importieren
          </Button>
        </>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={e => { void onPick(e.target.files?.[0]); }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 text-[13px] px-4 py-3 rounded-[8px] border-[0.5px] border-dashed border-[var(--tf-border-hover)] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]"
      >
        <Upload size={14} /> {dateiName ?? 'Datei wählen (.json)'}
      </button>
      {parseError && (
        <div className="rounded p-2.5 text-[12px] mt-3" style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}>⚠ {parseError}</div>
      )}
      {bundle && (
        <div className="mt-4 rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] px-3.5 py-3">
          <div className="text-[13.5px] font-medium text-[var(--tf-text)]">{bundle.workflow.name}</div>
          <div className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-1.5">
            {bundle.workflow.steps.length} {bundle.workflow.steps.length === 1 ? 'Schritt' : 'Schritte'}
            {' · '}{bundle.skills.length} {bundle.skills.length === 1 ? 'Skill' : 'Skills'}
            {' · '}{bundle.regeln.length} {bundle.regeln.length === 1 ? 'Regel' : 'Regeln'}
          </div>
          {konflikt && (
            <div className="mt-2 text-[11.5px] text-[var(--tf-warning-text)]">
              Ein Workflow mit dieser ID existiert bereits — der Import wird als Kopie („(importiert)") angelegt.
            </div>
          )}
        </div>
      )}
      {doImport.error && (
        <div className="rounded p-2.5 text-[12px] mt-3" style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}>⚠ {doImport.error}</div>
      )}
    </Dialog>
  );
}
