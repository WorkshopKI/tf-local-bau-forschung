/**
 * Dev-only Inline-Werkstatt: bearbeitet den aktiven GA-Workflow (Struktur +
 * Schritt-Konfiguration + Skill-Prompt/Regeln) direkt in der Gutachten-Ansicht —
 * ohne Kontextwechsel ins Kuration-Plugin. Reine Wiederverwendung der vorhandenen
 * Bausteine (WorkflowsTab / WorkflowEditor / SkillEditor / buildWorkflowMutations /
 * Leave-Guard) in einem kanonischen `Dialog`. Persistiert über `useSkillRegistry`;
 * nach jedem erfolgreichen Persist ruft es `onChanged()` → die laufende Ansicht
 * lädt die Registry frisch (`reloadRegistry`).
 *
 * Gating erfolgt am Aufrufer (`isDevContext()`); der Dialog selbst rendert nur.
 */
import { useCallback, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  exportSkillBundle,
  exportWorkflowBundle,
  type SkillRecord,
  type SkillRegistryFile,
  type WorkflowDef,
  type WorkflowStep,
} from '@/core/services/skills';
import { downloadAsFile } from '@/core/services/search/eval/eval-export';
import { useSkillRegistry } from '@/plugins/skill-verwaltung-kuration/useSkillRegistry';
import { buildWorkflowMutations } from '@/plugins/skill-verwaltung-kuration/workflowMutations';
import { blankStep, getWorkflowById, getWorkflowDef } from '@/plugins/skill-verwaltung-kuration/workflowShared';
import { WorkflowsTab } from '@/plugins/skill-verwaltung-kuration/WorkflowsTab';
import { WorkflowEditor } from '@/plugins/skill-verwaltung-kuration/WorkflowEditor';
import { SkillEditor } from '@/plugins/skill-verwaltung-kuration/SkillEditor';
import { SkillImportDialog } from '@/plugins/skill-verwaltung-kuration/SkillImportDialog';
import { WorkflowImportDialog } from '@/plugins/skill-verwaltung-kuration/WorkflowImportDialog';
import { useEditorLeaveGuard } from '@/plugins/skill-verwaltung-kuration/editorGuard';
import { UnsavedChangesDialog } from '@/plugins/skill-verwaltung-kuration/UnsavedChangesDialog';

type Detail =
  | { kind: 'step'; step: WorkflowStep; isNew: boolean }
  | { kind: 'skill'; skillId: string }
  | null;

interface WorkflowWerkstattDialogProps {
  /** Der aktive GA-Workflow (aus dem laufenden Gutachten-Flow) — Startauswahl. */
  aktiverWorkflowId: string;
  /** Optional direkt in den Skill-Editor eines Schritts springen (Stift am aktiven Schritt). */
  initialSkillId?: string;
  onClose: () => void;
  /** Nach jedem erfolgreichen Persist — die Gutachten-Ansicht lädt die Registry frisch. */
  onChanged: () => void;
  /** Sekundäraktionen (Regeln verwalten / Testlauf) öffnen das volle Kuration-Tool. */
  onNavigateKuration: (target: { skillId?: string }) => void;
}

function slugify(name: string, fallback: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || fallback;
}

export function WorkflowWerkstattDialog({
  aktiverWorkflowId, initialSkillId, onClose, onChanged, onNavigateKuration,
}: WorkflowWerkstattDialogProps): React.ReactElement {
  const reg = useSkillRegistry();
  const guard = useEditorLeaveGuard();
  const [selectedWorkflowIdRaw, setSelectedWorkflowId] = useState<string | null>(aktiverWorkflowId);
  const [detail, setDetail] = useState<Detail>(initialSkillId ? { kind: 'skill', skillId: initialSkillId } : null);
  const [skillImport, setSkillImport] = useState(false);
  const [workflowImport, setWorkflowImport] = useState(false);

  // Persist + Reload der laufenden Ansicht in EINEM Weg (roh, awaitbar, wirft).
  const persistAndReload = useCallback(async (next: SkillRegistryFile): Promise<void> => {
    await reg.persist(next);
    onChanged();
  }, [reg.persist, onChanged]);
  const save = useAsyncAction(persistAndReload);

  const requestCloseDialog = (): void => guard.guardLeave(onClose);
  const backToList = (): void => guard.guardLeave(() => setDetail(null));

  if (reg.loading || !reg.file) {
    return (
      <Dialog open onClose={onClose} size="xl" title="Workflow-Werkstatt (dev)">
        <div className="px-2 py-8 text-[13.5px] text-[var(--tf-text-secondary)]">Laden…</div>
      </Dialog>
    );
  }
  const file = reg.file;
  // Auswahl gegen die aktuelle Registry klemmen (stale/gelöscht → Default `zim-ep`).
  const selectedWorkflowId = (selectedWorkflowIdRaw && getWorkflowById(file, selectedWorkflowIdRaw))
    ? selectedWorkflowIdRaw
    : getWorkflowDef(file).id;

  const mut = buildWorkflowMutations({
    file,
    selectedWorkflowId,
    persist: persistAndReload,
    run: save.run,
    onWorkflowCreated: id => setSelectedWorkflowId(id),
    onWorkflowDeleted: () => setSelectedWorkflowId(null),
    onStepDeleted: () => setDetail(null),
  });

  const exportWorkflow = (def: WorkflowDef): void => {
    const bundle = exportWorkflowBundle(file, def.id);
    if (!bundle) return;
    downloadAsFile(JSON.stringify(bundle, null, 2), `workflow-${slugify(def.name, 'workflow')}.json`, 'application/json');
  };
  const exportSkill = (skill: SkillRecord): void => {
    const bundle = exportSkillBundle(file, skill.id);
    if (!bundle) return;
    downloadAsFile(JSON.stringify(bundle, null, 2), `skill-${slugify(skill.name, 'skill')}.json`, 'application/json');
  };

  let body: React.ReactNode;
  if (detail?.kind === 'skill') {
    const skill = file.skills.find(s => s.id === detail.skillId);
    body = skill ? (
      <div>
        <div className="flex justify-end mb-2">
          <Button variant="ghost" size="sm" onClick={() => exportSkill(skill)} className="gap-1.5">
            <Download size={13} /> Skill exportieren
          </Button>
        </div>
        <SkillEditor
          key={skill.id}
          file={file}
          skill={skill}
          isNew={false}
          canEdit={reg.canEdit}
          agg={null}
          persist={persistAndReload}
          onBack={backToList}
          onSaved={() => setDetail(null)}
          onGuardStateChange={guard.reportState}
          onManageRegeln={() => onNavigateKuration({})}
          onTestlauf={() => onNavigateKuration({ skillId: skill.id })}
        />
      </div>
    ) : (
      <div className="px-2 py-8 text-[13.5px] text-[var(--tf-text-secondary)]">
        Skill „{detail.skillId}" nicht gefunden.
        <button onClick={backToList} className="ml-2 text-[var(--tf-primary)] hover:underline">← Zurück</button>
      </div>
    );
  } else if (detail?.kind === 'step') {
    const skillGesetzt = !!detail.step.skillId && file.skills.some(s => s.id === detail.step.skillId);
    body = (
      <div>
        {skillGesetzt && (
          <div className="flex justify-end mb-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => guard.guardLeave(() => setDetail({ kind: 'skill', skillId: detail.step.skillId }))}
            >
              Skill-Prompt bearbeiten →
            </Button>
          </div>
        )}
        <WorkflowEditor
          key={detail.step.id}
          file={file}
          workflowId={selectedWorkflowId}
          step={detail.step}
          isNew={detail.isNew}
          canEdit={reg.canEdit}
          onSave={mut.saveStep}
          onBack={backToList}
          onSaved={() => setDetail(null)}
          onGuardStateChange={guard.reportState}
          onDelete={detail.isNew ? undefined : () => mut.deleteStep(detail.step)}
        />
      </div>
    );
  } else {
    body = (
      <div>
        <div className="flex items-center gap-1.5 justify-end mb-3">
          <Button variant="outline" size="sm" onClick={() => guard.guardLeave(() => setDetail({ kind: 'step', step: blankStep(), isNew: true }))}>
            + Neuer Schritt
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSkillImport(true)} className="gap-1.5">
            <Upload size={13} /> Skill importieren…
          </Button>
        </div>
        <WorkflowsTab
          file={file}
          canEdit={reg.canEdit}
          selectedId={selectedWorkflowId}
          onSelectWorkflow={id => guard.guardLeave(() => setSelectedWorkflowId(id))}
          onEditStep={step => guard.guardLeave(() => setDetail({ kind: 'step', step, isNew: false }))}
          onChangeSteps={mut.changeSteps}
          onCreateWorkflow={mut.createWorkflow}
          onSaveWorkflowMeta={mut.saveWorkflowMeta}
          onToggleFreigabe={mut.toggleWorkflowFreigabe}
          onToggleAktiv={mut.toggleWorkflowAktiv}
          onDeleteWorkflow={mut.deleteWorkflow}
          onExportWorkflow={exportWorkflow}
          onImportWorkflow={() => setWorkflowImport(true)}
        />
      </div>
    );
  }

  return (
    <Dialog
      open
      onClose={requestCloseDialog}
      size="xl"
      title="Workflow-Werkstatt (dev)"
      description="Prompts + Schritte des aktiven Gutachten-Workflows bearbeiten. Änderungen gelten registry-weit für alle Nutzer."
    >
      {save.error && (
        <div className="rounded p-2.5 text-[12px] mb-3" style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}>⚠ {save.error}</div>
      )}
      {body}
      {skillImport && (
        <SkillImportDialog
          file={file}
          persist={persistAndReload}
          onClose={() => setSkillImport(false)}
        />
      )}
      {workflowImport && (
        <WorkflowImportDialog
          file={file}
          persist={persistAndReload}
          onClose={() => setWorkflowImport(false)}
          onImported={id => { setWorkflowImport(false); setSelectedWorkflowId(id); }}
        />
      )}
      <UnsavedChangesDialog {...guard.dialog} />
    </Dialog>
  );
}
