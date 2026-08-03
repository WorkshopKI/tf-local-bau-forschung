/**
 * Inline-Werkstatt: bearbeitet die Anweisung an die KI (Prompt · Umfang · Regeln)
 * und dahinter die Workflow-Struktur direkt in der Gutachten-Ansicht — ohne
 * Kontextwechsel ins Kuration-Plugin. Reine Wiederverwendung der vorhandenen
 * Bausteine (WorkflowsTab / WorkflowEditor / SkillEditor / RegelEditor /
 * buildWorkflowMutations / buildRegelMutations / Leave-Guard) in einem kanonischen
 * `Dialog`. Persistiert über `useSkillRegistry`; nach jedem erfolgreichen Persist
 * ruft es `onChanged()` → die laufende Ansicht lädt die Registry frisch.
 *
 * Landung ist der SKILL des offenen Abschnitts, nicht der Workflow-Baum: wer
 * mitten in einem Antrag steckt, will die Anweisung ändern, selten die Struktur
 * A–G. Die Schritt-Liste liegt einen bewussten Klick dahinter.
 *
 * Gating erfolgt am Aufrufer (`useWerkstattZugang`); der Dialog selbst rendert nur.
 */
import { useCallback, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  exportSkillBundle,
  exportWorkflowBundle,
  type QualitaetsRegel,
  type SkillRecord,
  type SkillRegistryFile,
  type WorkflowDef,
  type WorkflowStep,
} from '@/core/services/skills';
import { downloadAsFile } from '@/core/services/search/eval/eval-export';
import { useSkillRegistry } from '@/plugins/skill-verwaltung-kuration/useSkillRegistry';
import { buildWorkflowMutations } from '@/plugins/skill-verwaltung-kuration/workflowMutations';
import { buildRegelMutations } from '@/plugins/skill-verwaltung-kuration/regelMutations';
import { blankStep, getWorkflowById, getWorkflowDef } from '@/plugins/skill-verwaltung-kuration/workflowShared';
import { blankRegel, ADD_TYPEN } from '@/plugins/skill-verwaltung-kuration/regelShared';
import { WorkflowsTab } from '@/plugins/skill-verwaltung-kuration/WorkflowsTab';
import { WorkflowEditor } from '@/plugins/skill-verwaltung-kuration/WorkflowEditor';
import { SkillEditor } from '@/plugins/skill-verwaltung-kuration/SkillEditor';
import { RegelEditor } from '@/plugins/skill-verwaltung-kuration/RegelEditor';
import { SkillImportDialog } from '@/plugins/skill-verwaltung-kuration/SkillImportDialog';
import { WorkflowImportDialog } from '@/plugins/skill-verwaltung-kuration/WorkflowImportDialog';
import { useEditorLeaveGuard } from '@/plugins/skill-verwaltung-kuration/editorGuard';
import { UnsavedChangesDialog } from '@/plugins/skill-verwaltung-kuration/UnsavedChangesDialog';

type Detail =
  | { kind: 'step'; step: WorkflowStep; isNew: boolean }
  | { kind: 'skill'; skillId: string }
  // `herkunftSkillId`: nach dem Speichern führt der Weg zurück zum Skill, aus dem
  // die Regel geöffnet wurde — nicht in die Liste. Sonst verliert der Nutzer den
  // Faden mitten in der Antragsbearbeitung.
  | { kind: 'regel'; regel: QualitaetsRegel; isNew: boolean; herkunftSkillId: string }
  | null;

interface WorkflowWerkstattDialogProps {
  /** Der aktive GA-Workflow (aus dem laufenden Gutachten-Flow) — Startauswahl. */
  aktiverWorkflowId: string;
  /** Optional direkt in den Skill-Editor eines Schritts springen (Stift am aktiven Schritt). */
  initialSkillId?: string;
  onClose: () => void;
  /** Nach jedem erfolgreichen Persist — die Gutachten-Ansicht lädt die Registry frisch. */
  onChanged: () => void;
  /** Sekundäraktionen (Regel-Bibliothek / Testlauf) öffnen das volle Kuration-Tool. */
  onNavigateKuration: (target: { skillId?: string }) => void;
  /** „Nur für mich"-Gegenweg: öffnet den persönlichen Stil statt des Team-Stands. */
  onOpenPersoenlich?: () => void;
  /** Live-Vorschau des zusammengesetzten Prompts, vom Gutachten-Flow geliefert. */
  nebenPrompt?: (entwurf: SkillRecord) => React.ReactNode;
}

const DIALOG_TITEL = 'Anweisung an die KI bearbeiten';
/** Gemerkte Dialog-Größe (localStorage; UI-Pref, `file://`-tauglich). */
const GROESSE_KEY = 'teamflow_werkstatt_dialog_groesse';

function slugify(name: string, fallback: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || fallback;
}

/**
 * Steht permanent über dem Inhalt, nicht als `description` unter dem Titel: dort
 * wurde der Satz überlesen. Er trägt BEIDE Richtungen — was hier geändert wird,
 * gilt für alle; wer nur seinen eigenen Ton verschieben will, hat einen anderen Ort.
 */
function GeltungsBand({ onOpenPersoenlich }: { onOpenPersoenlich?: () => void }): React.ReactElement {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] px-[14px] py-2.5">
      <span className="text-[12px] text-[var(--tf-text-secondary)]">
        Änderungen hier gelten <strong className="font-medium text-[var(--tf-text)]">für alle Nutzer</strong> und
        wirken beim nächsten Erzeugen. Freigegebene Abschnitte bleiben unverändert.
      </span>
      {onOpenPersoenlich && (
        <button
          type="button"
          onClick={onOpenPersoenlich}
          className="ml-auto text-[12px] text-[var(--tf-primary)] hover:underline whitespace-nowrap"
        >
          Nur für Sie? → Persönlicher Stil
        </button>
      )}
    </div>
  );
}

export function WorkflowWerkstattDialog({
  aktiverWorkflowId, initialSkillId, onClose, onChanged, onNavigateKuration, onOpenPersoenlich, nebenPrompt,
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
      <Dialog open onClose={onClose} size="2xl" align="top" title={DIALOG_TITEL}>
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

  // Regel-Aktionen über dieselbe Fabrik wie die Verwaltungsseite (kein zweiter
  // Zweig — insbesondere putzt `deleteRegel` die `regelIds` aller Skills mit).
  // Zurück geht es zum Skill, aus dem die Regel geöffnet wurde.
  const zurueckZumSkill = (): void => {
    setDetail(d => (d?.kind === 'regel' ? { kind: 'skill', skillId: d.herkunftSkillId } : null));
  };
  const regelMut = buildRegelMutations({
    file,
    persist: persistAndReload,
    run: save.run,
    onGespeichert: zurueckZumSkill,
    onGeloescht: zurueckZumSkill,
  });
  const oeffneRegel = (skillId: string, regel: QualitaetsRegel, isNew: boolean): void =>
    guard.guardLeave(() => setDetail({ kind: 'regel', regel, isNew, herkunftSkillId: skillId }));

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
  if (detail?.kind === 'regel') {
    const { regel, isNew, herkunftSkillId } = detail;
    const herkunft = file.skills.find(s => s.id === herkunftSkillId);
    body = (
      <div>
        <div className="mb-3 flex items-center gap-2 text-[12.5px] text-[var(--tf-text-secondary)]">
          <button onClick={zurueckZumSkill} className="text-[var(--tf-primary)] hover:underline">
            ← {herkunft ? herkunft.name : 'Zurück'}
          </button>
          <span className="text-[var(--tf-text-tertiary)]">·</span>
          <span>Regel {isNew ? 'anlegen' : 'bearbeiten'}</span>
        </div>
        <RegelEditor
          key={regel.id}
          initial={regel}
          busy={save.busy}
          canEdit={reg.canEdit}
          onSave={regelMut.saveRegel}
          onCancel={zurueckZumSkill}
          onPersist={regelMut.persistRegel}
          onGuardStateChange={guard.reportState}
          {...(isNew ? {} : { onDelete: () => regelMut.deleteRegel(regel) })}
        />
      </div>
    );
  } else if (detail?.kind === 'skill') {
    const skill = file.skills.find(s => s.id === detail.skillId);
    body = skill ? (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={backToList}
            className="text-[12.5px] text-[var(--tf-primary)] hover:underline"
            title="Schritte und Workflows des Gutachtens"
          >
            ← Alle Schritte
          </button>
          <Button variant="ghost" size="sm" onClick={() => exportSkill(skill)} className="gap-1.5 ml-auto">
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
          onEditRegel={r => oeffneRegel(skill.id, r, false)}
          onNeueRegel={() => oeffneRegel(skill.id, blankRegel(ADD_TYPEN[0] ?? 'verbotenes_muster'), true)}
          {...(nebenPrompt ? { nebenPrompt } : {})}
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
      size="2xl"
      align="top"
      resizable
      resizeStorageKey={GROESSE_KEY}
      // Langer Bearbeitungs-Dialog: ein Klick daneben darf den Entwurf nicht
      // wegwerfen. Escape und das X bleiben (mit Leave-Guard) wirksam.
      dismissOnOverlayClick={false}
      title={DIALOG_TITEL}
      description="Prompt, Umfang und Regeln des Abschnitts — dahinter die Schritte des Gutachtens."
    >
      {save.error && (
        <div className="rounded p-2.5 text-[12px] mb-3" style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}>⚠ {save.error}</div>
      )}
      <GeltungsBand {...(onOpenPersoenlich ? { onOpenPersoenlich } : {})} />
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
