import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Search, Info } from 'lucide-react';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/Tooltip';
import { MasterDetailLayout } from '@/components/master-detail';
import {
  resolveRegeln,
  skillsUsingRegel,
  exportSkillBundle,
  type ArtefaktTyp,
  type QualitaetsRegel,
  type SkillRecord,
  type SkillRegistryFile,
  type WorkflowDef,
  type WorkflowEbene,
  type WorkflowStep,
} from '@/core/services/skills';
import { downloadAsFile } from '@/core/services/search/eval/eval-export';
import { useSkillRegistry } from './useSkillRegistry';
import { useSkillAggregat } from './useSkillAggregat';
import { SkillsTab } from './SkillsTab';
import { SkillImportDialog } from './SkillImportDialog';
import { RegelnTab } from './RegelnTab';
import { WorkflowsTab } from './WorkflowsTab';
import { SkillEditor } from './SkillEditor';
import { RegelEditor } from './RegelEditor';
import { WorkflowEditor } from './WorkflowEditor';
import { SkillTestlaufPanel } from './SkillTestlauf';
import { SkillEvalPanel } from './SkillEvalPanel';
import { isDevFixturesEnabled } from '@/config/feature-flags';
import { RegistryViewModeToggle, type RegistryViewMode } from './RegistryViewModeToggle';
import { blankRegel, upsertRegel, ADD_TYPEN, TYP_LABEL } from './regelShared';
import { blankStep, blankWorkflow, getWorkflowById, getWorkflowDef, upsertStep, upsertWorkflowDef, withWorkflowSteps } from './workflowShared';
import { useEditorLeaveGuard } from './editorGuard';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';

type TabId = 'skills' | 'regeln' | 'workflows' | 'eval';

const VIEW_MODE_KEY = 'teamflow_skillreg_view_mode';
const VIEW_MODES: RegistryViewMode[] = ['list', 'table', 'cards'];

/** Kurz-Hilfe je Tab — als Info-Icon neben der Suchleiste statt als Intro-Absatz
 *  (spart vertikalen Platz, der Nutzer sieht die Tabelle sofort). */
const TAB_HELP: Partial<Record<TabId, string>> = {
  regeln: 'Jede Regel kodiert eine Erfahrung — sie wird automatisch geprüft und der KI als Vorgabe mitgegeben.',
};

function blankSkill(): SkillRecord {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: 'Neuer Skill',
    beschreibung: '',
    version: 1,
    promptTemplate: '',
    modifiers: { neu: '', kuerzer: '', laenger: '' },
    regelIds: [],
    slots: ['stammdaten', 'vbMarkdown'],
    geaendert_am: now,
  };
}

function loadViewModes(): Record<TabId, RegistryViewMode> {
  const fallback: Record<TabId, RegistryViewMode> = { skills: 'table', regeln: 'table', workflows: 'list', eval: 'list' };
  try {
    const raw = localStorage.getItem(VIEW_MODE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Record<TabId, unknown>>;
    const pick = (v: unknown, def: RegistryViewMode): RegistryViewMode =>
      typeof v === 'string' && (VIEW_MODES as string[]).includes(v) ? (v as RegistryViewMode) : def;
    return { skills: pick(parsed.skills, 'table'), regeln: pick(parsed.regeln, 'table'), workflows: 'list', eval: 'list' };
  } catch {
    return fallback;
  }
}

interface Testlauf { skill: SkillRecord; regeln: QualitaetsRegel[]; hinweis: string }

export function SkillVerwaltungPage(): React.ReactElement {
  const reg = useSkillRegistry();
  const agg = useSkillAggregat();
  const [tab, setTab] = useState<TabId>('skills');
  const [search, setSearch] = useState('');
  const [viewModes, setViewModes] = useState<Record<TabId, RegistryViewMode>>(loadViewModes);
  const [editingSkill, setEditingSkill] = useState<{ skill: SkillRecord; isNew: boolean; initialView?: 'bearbeiten' | 'versionen' } | null>(null);
  const [editingRegel, setEditingRegel] = useState<{ regel: QualitaetsRegel | null; isNew: boolean } | null>(null);
  const [editingStep, setEditingStep] = useState<{ step: WorkflowStep; isNew: boolean } | null>(null);
  // Gewählter Workflow im Workflows-Tab (null → Default-Def `zim-ep`). Nach Render
  // gegen die aktuelle Registry geklemmt (Auswahl kann nach Löschen verschwinden).
  const [selectedWorkflowIdRaw, setSelectedWorkflowId] = useState<string | null>(null);
  const [testlauf, setTestlauf] = useState<Testlauf | null>(null);
  const [importing, setImporting] = useState(false);
  const save = useAsyncAction(async (next: SkillRegistryFile) => { await reg.persist(next); });
  // Leave-Guard: jede Aktion, die den offenen Editor verlässt, läuft durch
  // `guard.guardLeave`; bei ungespeicherten Änderungen erscheint die Nachfrage.
  const guard = useEditorLeaveGuard();

  // Deep-Link (Provenienz aus dem Gutachten-Flow): `/kuration/skill-verwaltung/<skillId>`
  // öffnet den passenden Skill-Editor, sobald die Registry geladen ist.
  const { skillId: routeSkillId } = useParams<{ skillId?: string }>();
  const [searchParams] = useSearchParams();
  const deepLinkRef = useRef<string | null>(null);
  useEffect(() => {
    if (!routeSkillId || !reg.file) return;
    if (deepLinkRef.current === routeSkillId) return;
    const skill = reg.file.skills.find(s => s.id === routeSkillId);
    if (skill) {
      deepLinkRef.current = routeSkillId;
      const initialView = searchParams.get('view') === 'versionen' ? 'versionen' : 'bearbeiten';
      setTab('skills');
      setEditingSkill({ skill, isNew: false, initialView });
    }
  }, [routeSkillId, reg.file, searchParams]);

  if (reg.loading || !reg.file) {
    return <div className="px-8 py-10 text-[13.5px] text-[var(--tf-text-secondary)]">Laden…</div>;
  }
  const file = reg.file;
  const viewMode = viewModes[tab];
  // Klemmung: stale/leere Auswahl fällt auf die Default-Def (`zim-ep`) zurück.
  const selectedWorkflowId = (selectedWorkflowIdRaw && getWorkflowById(file, selectedWorkflowIdRaw))
    ? selectedWorkflowIdRaw
    : getWorkflowDef(file).id;

  const setViewMode = (mode: RegistryViewMode): void => {
    setViewModes(prev => {
      const next = { ...prev, [tab]: mode };
      try { localStorage.setItem(VIEW_MODE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const changeTab = (id: TabId): void => { setTab(id); setSearch(''); };

  // — Skill-Aktionen —
  // Testlauf aus Liste/Karte öffnet den Skill im Editor + den Testlauf-Panel
  // daneben (Detail-Split, kein Modal).
  const openTestlaufForSaved = (skill: SkillRecord): void => {
    guard.guardLeave(() => {
      setEditingSkill({ skill, isNew: false });
      setTestlauf({ skill, regeln: resolveRegeln(file, skill), hinweis: `v${skill.version}` });
    });
  };
  const duplicateSkill = (skill: SkillRecord): void => {
    const now = new Date().toISOString();
    const copy: SkillRecord = { ...skill, id: crypto.randomUUID(), name: `${skill.name} (Kopie)`, version: 1, geaendert_am: now };
    void save.run({ ...file, skills: [...file.skills, copy] });
  };
  const removeSkill = (skill: SkillRecord): void => {
    if (!window.confirm(`Skill „${skill.name}" wirklich löschen?`)) return;
    void save.run({ ...file, skills: file.skills.filter(s => s.id !== skill.id) });
  };
  const exportSkill = (skill: SkillRecord): void => {
    const bundle = exportSkillBundle(file, skill.id);
    if (!bundle) return;
    const slug = skill.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'skill';
    downloadAsFile(JSON.stringify(bundle, null, 2), `skill-${slug}.json`, 'application/json');
  };

  // — Regel-Aktionen —
  const toggleAktiv = (r: QualitaetsRegel): void => {
    void save.run({ ...file, regeln: upsertRegel(file.regeln, { ...r, aktiv: !r.aktiv, geaendert_am: new Date().toISOString() }) });
  };
  const saveRegel = (r: QualitaetsRegel): void => {
    void save.run({ ...file, regeln: upsertRegel(file.regeln, r) }).then(() => setEditingRegel(null));
  };
  // Roher Persist (wirft bei Fehler, schließt NICHT) — für die Leave-Guard-Nachfrage.
  const persistRegel = (r: QualitaetsRegel): Promise<void> =>
    reg.persist({ ...file, regeln: upsertRegel(file.regeln, r) });
  const deleteRegel = (r: QualitaetsRegel): void => {
    const used = skillsUsingRegel(file, r.id);
    const msg = used.length > 0
      ? `Regel „${r.name}" wird in ${used.length} Skill(s) verwendet: ${used.join(', ')}.\nWirklich löschen? Die Zuordnung wird dort entfernt.`
      : `Regel „${r.name}" wirklich löschen?`;
    if (!window.confirm(msg)) return;
    void save.run({
      ...file,
      regeln: file.regeln.filter(x => x.id !== r.id),
      skills: file.skills.map(s => ({ ...s, regelIds: s.regelIds.filter(id => id !== r.id) })),
    }).then(() => setEditingRegel(null));
  };

  // — Workflow-Schritt-Aktionen (Ziel-Def = `selectedWorkflowId`; Version-Bump pro Persist) —
  const selectedWorkflowDef = (): WorkflowDef => getWorkflowById(file, selectedWorkflowId) ?? getWorkflowDef(file);
  const saveStep = async (step: WorkflowStep): Promise<void> => {
    const steps = upsertStep(selectedWorkflowDef().steps, step);
    await reg.persist(withWorkflowSteps(file, selectedWorkflowId, steps));
  };
  const changeSteps = (steps: WorkflowStep[]): void => {
    void save.run(withWorkflowSteps(file, selectedWorkflowId, steps));
  };
  const deleteStep = (step: WorkflowStep): void => {
    void save.run(withWorkflowSteps(file, selectedWorkflowId, selectedWorkflowDef().steps.filter(s => s.id !== step.id)))
      .then(() => setEditingStep(null));
  };

  // — Workflow-Management (Anlegen/Metadaten/Freigeben/Aktiv/Löschen) —
  const createWorkflow = (name: string, artefaktTyp: ArtefaktTyp, ebene: WorkflowEbene): void => {
    const w = blankWorkflow({ name: name.trim() || 'Neuer Workflow', artefaktTyp, ebene });
    void save.run(upsertWorkflowDef(file, w)).then(() => setSelectedWorkflowId(w.id));
  };
  const saveWorkflowMeta = (def: WorkflowDef): void => {
    void save.run(upsertWorkflowDef(file, { ...def, version: def.version + 1 }));
  };
  const toggleWorkflowAktiv = (def: WorkflowDef): void => {
    void save.run(upsertWorkflowDef(file, { ...def, aktiv: def.aktiv === false, version: def.version + 1 }));
  };
  const toggleWorkflowFreigabe = (def: WorkflowDef): void => {
    if (def.freigabe !== 'entwurf'
      && !window.confirm(`„${def.name}" auf Entwurf zurückstellen? Der Workflow verschwindet dann in pl/prod/as — nur dev sieht Entwürfe.`)) return;
    const freigabe = def.freigabe === 'entwurf' ? 'freigegeben' : 'entwurf';
    void save.run(upsertWorkflowDef(file, { ...def, freigabe, version: def.version + 1 }));
  };
  const deleteWorkflow = (def: WorkflowDef): void => {
    if (!window.confirm(`Workflow „${def.name}" wirklich löschen? (eigener Workflow, kein Seed)`)) return;
    const others = (file.workflows ?? []).filter(w => w.id !== def.id);
    void save.run({ ...file, workflows: others }).then(() => setSelectedWorkflowId(null));
  };

  // — Detail-Slot (Editor) fürs Master-Detail-Split — die frühere Vollseiten-
  //   Ersetzung der Liste ist seit v2.91 durch das Split-Layout abgelöst. Der
  //   Editor wird rechts neben der Liste gerendert; `closeEditor` (Back/Escape)
  //   räumt die Selektion. Editor-Inhalt bringt eigenen Scroll mit (Detail-Pane
  //   des Shells ist overflow-hidden). —
  const hasDetail = !!(editingSkill || editingRegel || editingStep);
  // closeEditor = roh (für interne Post-Aktions-Schließungen nach erfolgreichem
  // Persist/Delete — dann ist nichts mehr dirty). requestClose = nutzer-initiiertes
  // Verlassen (Zurück/Escape) → durch die Leave-Guard-Nachfrage.
  const closeEditor = (): void => { setEditingSkill(null); setEditingRegel(null); setEditingStep(null); setTestlauf(null); };
  const requestClose = (): void => guard.guardLeave(closeEditor);

  let detail: React.ReactNode;
  if (editingSkill) {
    detail = (
      <div className="h-full overflow-y-auto">
        <div className="px-8 py-9 flex flex-col xl:flex-row gap-8 items-start">
          <div className="flex-1 min-w-0 w-full">
            <SkillEditor
              key={editingSkill.skill.id}
              file={file}
              skill={editingSkill.skill}
              isNew={editingSkill.isNew}
              canEdit={reg.canEdit}
              agg={agg}
              initialView={editingSkill.initialView}
              persist={reg.persist}
              onBack={requestClose}
              onGuardStateChange={guard.reportState}
              onManageRegeln={() => guard.guardLeave(() => { closeEditor(); changeTab('regeln'); })}
              onTestlauf={(skill, regeln, hinweis) => setTestlauf({ skill, regeln, hinweis })}
            />
          </div>
          {testlauf && (
            <div className="flex-1 min-w-0 w-full xl:max-w-[560px]">
              <SkillTestlaufPanel
                skill={testlauf.skill}
                regeln={testlauf.regeln}
                hinweis={testlauf.hinweis}
                onClose={() => setTestlauf(null)}
              />
            </div>
          )}
        </div>
      </div>
    );
  } else if (editingRegel) {
    const { regel, isNew } = editingRegel;
    detail = (
      <div className="h-full overflow-y-auto">
        <div className="px-8 py-9 max-w-[900px]">
          <button onClick={requestClose} className="text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] mb-4">← Skill-Verwaltung</button>
          {regel === null
            ? <RegelTypPicker onPick={typ => setEditingRegel({ regel: blankRegel(typ), isNew: true })} />
            : (
              <RegelEditor
                key={regel.id}
                initial={regel}
                canEdit={reg.canEdit}
                busy={save.busy}
                onSave={saveRegel}
                onCancel={requestClose}
                onDelete={isNew ? undefined : () => deleteRegel(regel)}
                onPersist={persistRegel}
                onGuardStateChange={guard.reportState}
              />
            )}
        </div>
      </div>
    );
  } else if (editingStep) {
    detail = (
      <div className="h-full overflow-y-auto">
        <div className="px-8 py-9">
          <WorkflowEditor
            key={editingStep.step.id}
            file={file}
            workflowId={selectedWorkflowId}
            step={editingStep.step}
            isNew={editingStep.isNew}
            canEdit={reg.canEdit}
            onSave={saveStep}
            onBack={requestClose}
            onGuardStateChange={guard.reportState}
            onDelete={editingStep.isNew ? undefined : () => deleteStep(editingStep.step)}
          />
        </div>
      </div>
    );
  }

  // Eval-Tab nur im dev-Build (features.devFixtures) — fiktive Skill-Eval-GUI.
  const tabDefs: Array<[TabId, string, number | null]> = [
    ['skills', 'Skills', file.skills.length],
    ['regeln', 'Qualitätsregeln', file.regeln.length],
    ['workflows', 'Workflows', file.workflows?.length ?? 0],
  ];
  if (isDevFixturesEnabled()) tabDefs.push(['eval', 'Skill-Eval', null]);

  const showSearch = tab === 'skills' || tab === 'regeln';
  const addLabel = tab === 'skills' ? '+ Neuer Skill' : tab === 'regeln' ? '+ Neue Regel' : '+ Neuer Schritt';
  const searchPlaceholder = tab === 'skills'
    ? 'Skills durchsuchen (Name, Beschreibung, Prompt)'
    : 'Regeln durchsuchen (Name, Typ, Parameter)';
  const addAction = (): void => {
    guard.guardLeave(() => {
      if (tab === 'skills') setEditingSkill({ skill: blankSkill(), isNew: true });
      else if (tab === 'regeln') setEditingRegel({ regel: null, isNew: true });
      else setEditingStep({ step: blankStep(), isNew: true });
    });
  };

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-60px)] overflow-hidden">
      {/* Header — volle Breite mit Unterkanten-Border, Inhalts-Box max-w-6xl px-8 */}
      <div className="shrink-0 pt-4 pb-0" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
        <div className="max-w-6xl px-8">
          <div className="mb-3">
            <h1 className="text-[22px] font-medium text-[var(--tf-text)] leading-tight">Skill-Verwaltung</h1>
            <div className="text-[11px] text-[var(--tf-text-tertiary)] mt-0.5">Änderungen gelten für alle Nutzer</div>
          </div>

          {/* Unterstrich-Tabs links, Aktionen rechts */}
          <div className="flex items-end gap-4">
            <div className="flex items-end gap-5 min-w-0 overflow-x-auto overflow-y-hidden">
              {tabDefs.map(([id, label, count]) => {
                const isActive = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => guard.guardLeave(() => changeTab(id))}
                    className={`pb-2.5 text-[14px] whitespace-nowrap cursor-pointer transition-colors ${
                      isActive
                        ? 'text-[var(--tf-text)] font-medium border-b-2 border-[var(--tf-text)] -mb-px'
                        : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
                    }`}
                  >
                    {label}{count != null && <span className="text-[12px] text-[var(--tf-text-tertiary)]"> {count}</span>}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 shrink-0 pb-2 ml-auto">
              {showSearch && <RegistryViewModeToggle value={viewMode} onChange={setViewMode} />}
              {tab === 'skills' && reg.canEdit && (
                <Button variant="outline" size="sm" onClick={() => setImporting(true)} className="h-8 whitespace-nowrap">
                  Importieren
                </Button>
              )}
              {tab !== 'eval' && reg.canEdit && (
                <Button variant="outline" size="sm" onClick={addAction} className="h-8 whitespace-nowrap">
                  {addLabel}
                </Button>
              )}
            </div>
          </div>

          {/* Suche (für Skills/Regeln; Workflow + Eval haben keine Listen-Suche) */}
          {showSearch && (
            <div className="mt-2 pb-3 flex items-center gap-2">
              <div className="relative flex-1 min-w-0 max-w-[640px]">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)] pointer-events-none" />
                <Input
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-7 h-8 w-full text-[12.5px]"
                />
              </div>
              {TAB_HELP[tab] && (
                <Tooltip text={TAB_HELP[tab]!}>
                  <button
                    type="button"
                    aria-label="Info"
                    className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-[6px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-hover)] transition-colors cursor-help"
                  >
                    <Info size={15} />
                  </button>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Inhalt — Master (Liste) links, Detail (Editor) rechts via Split-Shell */}
      <MasterDetailLayout
        listWidthKey="teamflow_skillreg_narrow_width"
        onCloseDetail={requestClose}
        detail={detail}
        list={(
          <div className={hasDetail ? 'px-4 py-6' : 'max-w-6xl px-8 py-6'}>
        {!reg.canEdit && (
          <div className="mb-4 text-[12.5px] text-[var(--tf-text-secondary)] rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] px-3.5 py-2.5">
            Kurator-Modus nicht aktiv — Skills und Regeln sind nur lesbar. Sandbox-Testläufe sind möglich.
          </div>
        )}
        {reg.stale && (
          <div className="mb-4 text-[12.5px] rounded-[8px] px-3.5 py-2.5" style={{ background: 'var(--tf-warning-bg)', color: 'var(--tf-warning-text)' }}>
            Offline — angezeigter Stand stammt aus dem lokalen Zwischenspeicher.
          </div>
        )}
        {save.error && (
          <div className="rounded p-2.5 text-[12px] mb-4" style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}>⚠ {save.error}</div>
        )}

        {tab === 'eval' ? (
          <SkillEvalPanel registry={file} />
        ) : tab === 'skills' ? (
          <SkillsTab
            file={file}
            canEdit={reg.canEdit}
            search={search}
            viewMode={viewMode}
            agg={agg}
            onEdit={skill => guard.guardLeave(() => setEditingSkill({ skill, isNew: false }))}
            onTestlauf={openTestlaufForSaved}
            onDuplicate={duplicateSkill}
            onDelete={removeSkill}
            onExport={exportSkill}
          />
        ) : tab === 'regeln' ? (
          <RegelnTab
            file={file}
            canEdit={reg.canEdit}
            busy={save.busy}
            search={search}
            viewMode={viewMode}
            onEdit={regel => guard.guardLeave(() => setEditingRegel({ regel, isNew: false }))}
            onToggleAktiv={toggleAktiv}
          />
        ) : (
          <WorkflowsTab
            file={file}
            canEdit={reg.canEdit}
            selectedId={selectedWorkflowId}
            onSelectWorkflow={id => guard.guardLeave(() => setSelectedWorkflowId(id))}
            onEditStep={step => guard.guardLeave(() => setEditingStep({ step, isNew: false }))}
            onChangeSteps={changeSteps}
            onCreateWorkflow={createWorkflow}
            onSaveWorkflowMeta={saveWorkflowMeta}
            onToggleFreigabe={toggleWorkflowFreigabe}
            onToggleAktiv={toggleWorkflowAktiv}
            onDeleteWorkflow={deleteWorkflow}
          />
        )}
          </div>
        )}
      />
      {importing && (
        <SkillImportDialog
          file={file}
          persist={reg.persist}
          onClose={() => setImporting(false)}
        />
      )}
      <UnsavedChangesDialog {...guard.dialog} />
    </div>
  );
}

/** Typ-Auswahl für eine neue Regel — die passenden Parameterfelder erscheinen
 *  danach im RegelEditor. */
function RegelTypPicker({ onPick }: { onPick: (typ: string) => void }): React.ReactElement {
  return (
    <div>
      <h2 className="text-[20px] font-medium text-[var(--tf-text)] m-0">Neue Regel</h2>
      <p className="text-[12.5px] text-[var(--tf-text-tertiary)] mt-1.5 mb-4">
        Regeltyp wählen — die passenden Parameterfelder erscheinen danach.
      </p>
      <div className="flex flex-wrap gap-2">
        {ADD_TYPEN.map(t => (
          <button
            key={t}
            onClick={() => onPick(t)}
            className="text-[12.5px] px-[13px] py-[7px] rounded-[99px] border-[0.5px] border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:border-[var(--tf-border-hover)]"
          >
            {TYP_LABEL[t]}
          </button>
        ))}
      </div>
    </div>
  );
}
