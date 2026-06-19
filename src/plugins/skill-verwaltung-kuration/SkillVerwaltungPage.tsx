import { useState } from 'react';
import { Search } from 'lucide-react';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MasterDetailLayout } from '@/components/master-detail';
import {
  resolveRegeln,
  skillsUsingRegel,
  type QualitaetsRegel,
  type SkillRecord,
  type SkillRegistryFile,
  type WorkflowStep,
} from '@/core/services/skills';
import { useSkillRegistry } from './useSkillRegistry';
import { SkillsTab } from './SkillsTab';
import { RegelnTab } from './RegelnTab';
import { WorkflowsTab } from './WorkflowsTab';
import { SkillEditor } from './SkillEditor';
import { RegelEditor } from './RegelEditor';
import { WorkflowEditor } from './WorkflowEditor';
import { SkillTestlauf } from './SkillTestlauf';
import { RegistryViewModeToggle, type RegistryViewMode } from './RegistryViewModeToggle';
import { blankRegel, upsertRegel, ADD_TYPEN, TYP_LABEL } from './regelShared';
import { blankStep, getWorkflowDef, upsertStep, withWorkflowSteps } from './workflowShared';

type TabId = 'skills' | 'regeln' | 'workflows';

const VIEW_MODE_KEY = 'teamflow_skillreg_view_mode';
const VIEW_MODES: RegistryViewMode[] = ['list', 'table', 'cards'];

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
  const fallback: Record<TabId, RegistryViewMode> = { skills: 'table', regeln: 'table', workflows: 'list' };
  try {
    const raw = localStorage.getItem(VIEW_MODE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Record<TabId, unknown>>;
    const pick = (v: unknown, def: RegistryViewMode): RegistryViewMode =>
      typeof v === 'string' && (VIEW_MODES as string[]).includes(v) ? (v as RegistryViewMode) : def;
    return { skills: pick(parsed.skills, 'table'), regeln: pick(parsed.regeln, 'table'), workflows: 'list' };
  } catch {
    return fallback;
  }
}

interface Testlauf { skill: SkillRecord; regeln: QualitaetsRegel[]; hinweis: string }

export function SkillVerwaltungPage(): React.ReactElement {
  const reg = useSkillRegistry();
  const [tab, setTab] = useState<TabId>('skills');
  const [search, setSearch] = useState('');
  const [viewModes, setViewModes] = useState<Record<TabId, RegistryViewMode>>(loadViewModes);
  const [editingSkill, setEditingSkill] = useState<{ skill: SkillRecord; isNew: boolean } | null>(null);
  const [editingRegel, setEditingRegel] = useState<{ regel: QualitaetsRegel | null; isNew: boolean } | null>(null);
  const [editingStep, setEditingStep] = useState<{ step: WorkflowStep; isNew: boolean } | null>(null);
  const [testlauf, setTestlauf] = useState<Testlauf | null>(null);
  const save = useAsyncAction(async (next: SkillRegistryFile) => { await reg.persist(next); });

  if (reg.loading || !reg.file) {
    return <div className="px-8 py-10 text-[13.5px] text-[var(--tf-text-secondary)]">Laden…</div>;
  }
  const file = reg.file;
  const viewMode = viewModes[tab];

  const setViewMode = (mode: RegistryViewMode): void => {
    setViewModes(prev => {
      const next = { ...prev, [tab]: mode };
      try { localStorage.setItem(VIEW_MODE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const changeTab = (id: TabId): void => { setTab(id); setSearch(''); };

  const testlaufModal = testlauf && (
    <SkillTestlauf skill={testlauf.skill} regeln={testlauf.regeln} hinweis={testlauf.hinweis} onClose={() => setTestlauf(null)} />
  );

  // — Skill-Aktionen —
  const openTestlaufForSaved = (skill: SkillRecord): void =>
    setTestlauf({ skill, regeln: resolveRegeln(file, skill), hinweis: `v${skill.version}` });
  const duplicateSkill = (skill: SkillRecord): void => {
    const now = new Date().toISOString();
    const copy: SkillRecord = { ...skill, id: crypto.randomUUID(), name: `${skill.name} (Kopie)`, version: 1, geaendert_am: now };
    void save.run({ ...file, skills: [...file.skills, copy] });
  };
  const removeSkill = (skill: SkillRecord): void => {
    if (!window.confirm(`Skill „${skill.name}" wirklich löschen?`)) return;
    void save.run({ ...file, skills: file.skills.filter(s => s.id !== skill.id) });
  };

  // — Regel-Aktionen —
  const toggleAktiv = (r: QualitaetsRegel): void => {
    void save.run({ ...file, regeln: upsertRegel(file.regeln, { ...r, aktiv: !r.aktiv, geaendert_am: new Date().toISOString() }) });
  };
  const saveRegel = (r: QualitaetsRegel): void => {
    void save.run({ ...file, regeln: upsertRegel(file.regeln, r) }).then(() => setEditingRegel(null));
  };
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

  // — Workflow-Schritt-Aktionen (eine WorkflowDef in v1; Version-Bump pro Persist) —
  const saveStep = async (step: WorkflowStep): Promise<void> => {
    const steps = upsertStep(getWorkflowDef(file).steps, step);
    await reg.persist(withWorkflowSteps(file, steps));
  };
  const changeSteps = (steps: WorkflowStep[]): void => {
    void save.run(withWorkflowSteps(file, steps));
  };
  const deleteStep = (step: WorkflowStep): void => {
    void save.run(withWorkflowSteps(file, getWorkflowDef(file).steps.filter(s => s.id !== step.id)))
      .then(() => setEditingStep(null));
  };

  // — Detail-Slot (Editor) fürs Master-Detail-Split — die frühere Vollseiten-
  //   Ersetzung der Liste ist seit v2.91 durch das Split-Layout abgelöst. Der
  //   Editor wird rechts neben der Liste gerendert; `closeEditor` (Back/Escape)
  //   räumt die Selektion. Editor-Inhalt bringt eigenen Scroll mit (Detail-Pane
  //   des Shells ist overflow-hidden). —
  const hasDetail = !!(editingSkill || editingRegel || editingStep);
  const closeEditor = (): void => { setEditingSkill(null); setEditingRegel(null); setEditingStep(null); };

  let detail: React.ReactNode;
  if (editingSkill) {
    detail = (
      <div className="h-full overflow-y-auto">
        <div className="px-8 py-9">
          <SkillEditor
            file={file}
            skill={editingSkill.skill}
            isNew={editingSkill.isNew}
            canEdit={reg.canEdit}
            persist={reg.persist}
            onBack={closeEditor}
            onManageRegeln={() => { closeEditor(); changeTab('regeln'); }}
            onTestlauf={(skill, regeln, hinweis) => setTestlauf({ skill, regeln, hinweis })}
          />
        </div>
      </div>
    );
  } else if (editingRegel) {
    const { regel, isNew } = editingRegel;
    detail = (
      <div className="h-full overflow-y-auto">
        <div className="px-8 py-9 max-w-[900px]">
          <button onClick={closeEditor} className="text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] mb-4">← Skill-Verwaltung</button>
          {regel === null
            ? <RegelTypPicker onPick={typ => setEditingRegel({ regel: blankRegel(typ), isNew: true })} />
            : (
              <RegelEditor
                initial={regel}
                canEdit={reg.canEdit}
                busy={save.busy}
                onSave={saveRegel}
                onCancel={closeEditor}
                onDelete={isNew ? undefined : () => deleteRegel(regel)}
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
            file={file}
            step={editingStep.step}
            isNew={editingStep.isNew}
            canEdit={reg.canEdit}
            onSave={saveStep}
            onBack={closeEditor}
            onDelete={editingStep.isNew ? undefined : () => deleteStep(editingStep.step)}
          />
        </div>
      </div>
    );
  }

  const addLabel = tab === 'skills' ? '+ Neuer Skill' : tab === 'regeln' ? '+ Neue Regel' : '+ Neuer Schritt';
  const searchPlaceholder = tab === 'skills'
    ? 'Skills durchsuchen (Name, Beschreibung, Prompt)'
    : 'Regeln durchsuchen (Name, Typ, Parameter)';
  const addAction = (): void => {
    if (tab === 'skills') setEditingSkill({ skill: blankSkill(), isNew: true });
    else if (tab === 'regeln') setEditingRegel({ regel: null, isNew: true });
    else setEditingStep({ step: blankStep(), isNew: true });
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
              {([['skills', 'Skills', file.skills.length], ['regeln', 'Qualitätsregeln', file.regeln.length], ['workflows', 'Workflows', getWorkflowDef(file).steps.length]] as const).map(([id, label, count]) => {
                const isActive = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => changeTab(id)}
                    className={`pb-2.5 text-[14px] whitespace-nowrap cursor-pointer transition-colors ${
                      isActive
                        ? 'text-[var(--tf-text)] font-medium border-b-2 border-[var(--tf-text)] -mb-px'
                        : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
                    }`}
                  >
                    {label} <span className="text-[12px] text-[var(--tf-text-tertiary)]">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 shrink-0 pb-2 ml-auto">
              {tab !== 'workflows' && <RegistryViewModeToggle value={viewMode} onChange={setViewMode} />}
              {reg.canEdit && (
                <Button variant="outline" size="sm" onClick={addAction} className="h-8 whitespace-nowrap">
                  {addLabel}
                </Button>
              )}
            </div>
          </div>

          {/* Suche (für Skills/Regeln; der Workflow hat wenige, geordnete Schritte) */}
          {tab !== 'workflows' && (
            <div className="mt-2 pb-3 flex items-center gap-3">
              <div className="relative flex-1 min-w-0 max-w-[640px]">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)] pointer-events-none" />
                <Input
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-7 h-8 w-full text-[12.5px]"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inhalt — Master (Liste) links, Detail (Editor) rechts via Split-Shell */}
      <MasterDetailLayout
        listWidthKey="teamflow_skillreg_narrow_width"
        onCloseDetail={closeEditor}
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

        {tab === 'skills' ? (
          <SkillsTab
            file={file}
            canEdit={reg.canEdit}
            search={search}
            viewMode={viewMode}
            onEdit={skill => setEditingSkill({ skill, isNew: false })}
            onTestlauf={openTestlaufForSaved}
            onDuplicate={duplicateSkill}
            onDelete={removeSkill}
          />
        ) : tab === 'regeln' ? (
          <RegelnTab
            file={file}
            canEdit={reg.canEdit}
            busy={save.busy}
            search={search}
            viewMode={viewMode}
            onEdit={regel => setEditingRegel({ regel, isNew: false })}
            onToggleAktiv={toggleAktiv}
          />
        ) : (
          <WorkflowsTab
            file={file}
            canEdit={reg.canEdit}
            onEditStep={step => setEditingStep({ step, isNew: false })}
            onChangeSteps={changeSteps}
          />
        )}
          </div>
        )}
      />
      {testlaufModal}
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
