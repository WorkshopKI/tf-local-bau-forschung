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
  exportSkillBundle,
  exportWorkflowBundle,
  type QualitaetsRegel,
  type SkillRecord,
  type SkillRegistryFile,
  type WorkflowDef,
  type WorkflowStep,
} from '@/core/services/skills';
import { downloadAsFile } from '@/core/services/search/eval/eval-export';
import { useSkillRegistry } from './useSkillRegistry';
import { useSkillAggregat } from './useSkillAggregat';
import { SkillsTab } from './SkillsTab';
import { SkillImportDialog } from './SkillImportDialog';
import { WorkflowImportDialog } from './WorkflowImportDialog';
import { RegelnTab } from './RegelnTab';
import { WorkflowsTab } from './WorkflowsTab';
import { SkillEditor } from './SkillEditor';
import { RegelEditor } from './RegelEditor';
import { WorkflowEditor } from './WorkflowEditor';
import { SkillTestlaufPanel } from './SkillTestlauf';
import { SkillEvalPanel } from './SkillEvalPanel';
import { TextbausteineTab } from './TextbausteineTab';
import { isDevFixturesEnabled } from '@/config/feature-flags';
import { ViewModeToggle, type ViewMode as RegistryViewMode } from '@/components/ui/ViewModeToggle';
import { blankRegel, ADD_TYPEN, TYP_LABEL } from './regelShared';
import { blankStep, getWorkflowById, getWorkflowDef } from './workflowShared';
import { buildWorkflowMutations } from './workflowMutations';
import { buildRegelMutations } from './regelMutations';
import { useEditorLeaveGuard } from './editorGuard';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { DetailKopf } from './DetailKopf';
import { PersoenlichePanel } from './PersoenlichePanel';
import { useSkillTweak } from './useSkillTweak';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';

type TabId = 'skills' | 'regeln' | 'workflows' | 'textbausteine' | 'eval';

/**
 * EIN Detail-Zustand statt dreier paralleler States. Vorher hielten
 * `editingSkill`/`editingRegel`/`editingStep` unabhängig voneinander Werte und
 * wurden als if/else-Kette gerendert — der Skill gewann immer, sodass das Anwählen
 * einer Regel bei offenem Skill-Editor die Detail-Ansicht NICHT wechselte. Als
 * diskriminierte Union ist das strukturell ausgeschlossen.
 */
type DetailZustand =
  | { art: 'skill'; skill: SkillRecord; isNew: boolean; initialView?: 'bearbeiten' | 'versionen' }
  | { art: 'regel'; regel: QualitaetsRegel | null; isNew: boolean }
  | { art: 'step'; step: WorkflowStep; isNew: boolean };

/** Kontext-Label der Detail-Kopfzeile je Detail-Art. */
const DETAIL_LABEL: Record<DetailZustand['art'], string> = {
  skill: 'Skill',
  regel: 'Qualitätsregel',
  step: 'Workflow-Schritt',
};

/** Bearbeitungs-Ebene eines Skills: geteilte Registry vs. persönlicher Ordner. */
type SkillEbene = 'team' | 'persoenlich';

// Key-Bump `_v2`: der Default steht auf „Tabelle" (informationsdichteste Ansicht),
// gewonnen hätte sonst der alte, in localStorage gespeicherte 'list'-Eintrag.
const VIEW_MODE_KEY = 'teamflow_skillreg_view_mode_v2';
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
  const fallback: Record<TabId, RegistryViewMode> = { skills: 'table', regeln: 'table', workflows: 'list', textbausteine: 'list', eval: 'list' };
  try {
    const raw = localStorage.getItem(VIEW_MODE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Record<TabId, unknown>>;
    const pick = (v: unknown, def: RegistryViewMode): RegistryViewMode =>
      typeof v === 'string' && (VIEW_MODES as string[]).includes(v) ? (v as RegistryViewMode) : def;
    return { skills: pick(parsed.skills, 'table'), regeln: pick(parsed.regeln, 'table'), workflows: 'list', textbausteine: 'list', eval: 'list' };
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
  const [detailZustand, setDetail] = useState<DetailZustand | null>(null);
  // Ebene des offenen Skill-Details: „Team" = geteilte Registry (Kurator/PL),
  // „Persönlich" = eigener Ordner (jeder Nutzer). Beim Öffnen immer „Team".
  const [skillEbene, setSkillEbene] = useState<SkillEbene>('team');
  const tweakCtl = useSkillTweak(detailZustand?.art === 'skill' ? detailZustand.skill.id : null);
  // Gewählter Workflow im Workflows-Tab (null → Default-Def `zim-ep`). Nach Render
  // gegen die aktuelle Registry geklemmt (Auswahl kann nach Löschen verschwinden).
  const [selectedWorkflowIdRaw, setSelectedWorkflowId] = useState<string | null>(null);
  const [testlauf, setTestlauf] = useState<Testlauf | null>(null);
  const [importing, setImporting] = useState(false);
  const [importingWorkflow, setImportingWorkflow] = useState(false);
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
      setDetail({ art: 'skill', skill, isNew: false, initialView });
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

  // closeEditor = roh (für interne Post-Aktions-Schließungen nach erfolgreichem
  // Persist/Delete — dann ist nichts mehr dirty). requestClose = nutzer-initiiertes
  // Verlassen (X/Escape) → durch die Leave-Guard-Nachfrage.
  const closeEditor = (): void => { setDetail(null); setTestlauf(null); setSkillEbene('team'); };
  const requestClose = (): void => guard.guardLeave(closeEditor);

  // Tabwechsel schließt das Detail mit: ein Editor, der nicht zur sichtbaren Liste
  // gehört, blockierte sonst die Auswahl in der neuen Liste (der Skill-Editor
  // überdeckte die angewählte Regel). Aufrufer laufen bereits durch `guardLeave`.
  const changeTab = (id: TabId): void => { setTab(id); setSearch(''); closeEditor(); };

  // — Skill-Aktionen —
  // Testlauf aus Liste/Karte öffnet den Skill im Editor + den Testlauf-Panel
  // daneben (Detail-Split, kein Modal).
  const openTestlaufForSaved = (skill: SkillRecord): void => {
    guard.guardLeave(() => {
      setDetail({ art: 'skill', skill, isNew: false });
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

  // — Regel-Aktionen über die geteilte Fabrik (DRY mit der Inline-Werkstatt in
  //   der Gutachten-Ansicht — dort werden dieselben Regeln bearbeitet). —
  const { toggleAktiv, saveRegel, persistRegel, deleteRegel } = buildRegelMutations({
    file,
    persist: reg.persist,
    run: save.run,
    onGespeichert: closeEditor,
    onGeloescht: closeEditor,
  });

  // — Workflow-Aktionen (Schritte + Management) über die geteilte Fabrik (DRY mit
  //   dem dev-Inline-Editor in der Gutachten-Werkstatt). Ziel-Def = `selectedWorkflowId`. —
  const mut = buildWorkflowMutations({
    file,
    selectedWorkflowId,
    persist: reg.persist,
    run: save.run,
    onWorkflowCreated: id => setSelectedWorkflowId(id),
    onWorkflowDeleted: () => setSelectedWorkflowId(null),
    onStepDeleted: closeEditor,
  });
  const exportWorkflow = (def: WorkflowDef): void => {
    const bundle = exportWorkflowBundle(file, def.id);
    if (!bundle) return;
    const slug = def.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'workflow';
    downloadAsFile(JSON.stringify(bundle, null, 2), `workflow-${slug}.json`, 'application/json');
  };

  // — Detail-Slot (Editor) fürs Master-Detail-Split — die frühere Vollseiten-
  //   Ersetzung der Liste ist seit v2.91 durch das Split-Layout abgelöst. Der
  //   Editor wird rechts neben der Liste gerendert. Die Kopfzeile (`DetailKopf`)
  //   sitzt AUSSERHALB des scrollenden Bereichs — das Schließen-X bleibt damit
  //   beim Scrollen stehen. —
  const hasDetail = detailZustand !== null;

  let detailInhalt: React.ReactNode;
  if (detailZustand?.art === 'skill' && skillEbene === 'persoenlich') {
    detailInhalt = (
      <div className="px-8 py-7 max-w-[900px]">
        <PersoenlichePanel
          key={detailZustand.skill.id}
          file={file}
          skill={detailZustand.skill}
          tweak={tweakCtl.tweak}
          loading={tweakCtl.loading}
          onSave={tweakCtl.save}
          onRemove={tweakCtl.remove}
        />
      </div>
    );
  } else if (detailZustand?.art === 'skill') {
    const { skill, isNew, initialView } = detailZustand;
    detailInhalt = (
      <div className="px-8 py-7 flex flex-col xl:flex-row gap-8 items-start">
        <div className="flex-1 min-w-0 w-full">
          <SkillEditor
            key={skill.id}
            file={file}
            skill={skill}
            isNew={isNew}
            canEdit={reg.canEdit}
            agg={agg}
            initialView={initialView}
            persist={reg.persist}
            onBack={requestClose}
            onSaved={closeEditor}
            onGuardStateChange={guard.reportState}
            onManageRegeln={() => guard.guardLeave(() => changeTab('regeln'))}
            onTestlauf={(s, regeln, hinweis) => setTestlauf({ skill: s, regeln, hinweis })}
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
    );
  } else if (detailZustand?.art === 'regel') {
    const { regel, isNew } = detailZustand;
    detailInhalt = (
      <div className="px-8 py-7 max-w-[900px]">
        {regel === null
          ? <RegelTypPicker onPick={typ => setDetail({ art: 'regel', regel: blankRegel(typ), isNew: true })} />
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
    );
  } else if (detailZustand?.art === 'step') {
    const { step, isNew } = detailZustand;
    detailInhalt = (
      <div className="px-8 py-7">
        <WorkflowEditor
          key={step.id}
          file={file}
          workflowId={selectedWorkflowId}
          step={step}
          isNew={isNew}
          canEdit={reg.canEdit}
          onSave={mut.saveStep}
          onBack={requestClose}
          onSaved={closeEditor}
          onGuardStateChange={guard.reportState}
          onDelete={isNew ? undefined : () => mut.deleteStep(step)}
        />
      </div>
    );
  }

  const detail = detailZustand && (
    <div className="h-full flex flex-col">
      <DetailKopf label={DETAIL_LABEL[detailZustand.art]} onClose={requestClose}>
        {/* Team | Persönlich nur am Skill: die Team-Ebene ist der geteilte
            Registry-Stand (Kurator/PL), die persönliche liegt im eigenen Ordner
            und ist für JEDEN Nutzer änderbar. Ein neuer, noch ungespeicherter
            Skill hat noch keine persönliche Ebene. */}
        {detailZustand.art === 'skill' && !detailZustand.isNew && (
          <EbenenWahl wert={skillEbene} onChange={e => guard.guardLeave(() => setSkillEbene(e))} />
        )}
      </DetailKopf>
      <div className="flex-1 min-h-0 overflow-y-auto">{detailInhalt}</div>
    </div>
  );

  // Eval-Tab nur im dev-Build (features.devFixtures) — fiktive Skill-Eval-GUI.
  const tabDefs: Array<[TabId, string, number | null]> = [
    ['skills', 'Skills', file.skills.length],
    ['regeln', 'Qualitätsregeln', file.regeln.length],
    ['workflows', 'Workflows', file.workflows?.length ?? 0],
    ['textbausteine', 'Textbausteine', null],
  ];
  if (isDevFixturesEnabled()) tabDefs.push(['eval', 'Skill-Eval', null]);

  const showSearch = tab === 'skills' || tab === 'regeln';
  const addLabel = tab === 'skills' ? '+ Neuer Skill' : tab === 'regeln' ? '+ Neue Regel' : '+ Neuer Schritt';
  const searchPlaceholder = tab === 'skills'
    ? 'Skills durchsuchen (Name, Beschreibung, Prompt)'
    : 'Regeln durchsuchen (Name, Typ, Parameter)';
  const addAction = (): void => {
    guard.guardLeave(() => {
      if (tab === 'skills') setDetail({ art: 'skill', skill: blankSkill(), isNew: true });
      // Typ-Auswahl nur zeigen, wenn es überhaupt etwas zu wählen gibt — die
      // Umfangs-/Form-Typen sind seit v2.296 Skill-Vorgaben, nicht mehr Bibliothek.
      else if (tab === 'regeln') {
        setDetail(ADD_TYPEN.length === 1
          ? { art: 'regel', regel: blankRegel(ADD_TYPEN[0]!), isNew: true }
          : { art: 'regel', regel: null, isNew: true });
      }
      else setDetail({ art: 'step', step: blankStep(), isNew: true });
    });
  };

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-60px)] overflow-hidden">
      {/* Header — volle Breite mit Unterkanten-Border, Inhalts-Box max-w-6xl px-8.
          Die TITELZEILE steht davor über die ganze Blattbreite: der Hilfe-Knopf
          gehört an den rechten Blattrand (ui-muster.md, Guard
          `hilfe-knopf-am-blattrand`). */}
      <div className="shrink-0 pt-4 pb-0" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
        <div className="px-8">
          <div className="mb-3 flex items-start gap-3">
            <div className="min-w-0">
              <h1 className="text-[22px] font-medium text-[var(--tf-text)] leading-tight">Skill-Verwaltung</h1>
              <div className="text-[11px] text-[var(--tf-text-tertiary)] mt-0.5">Änderungen gelten für alle Nutzer</div>
            </div>
            <div className="ml-auto shrink-0"><SeitenHilfeButton pluginId="skill-verwaltung-kuration" /></div>
          </div>
        </div>
        <div className="max-w-6xl px-8">
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
                        ? 'text-[var(--tf-primary)] font-medium border-b-2 border-[var(--tf-primary)] -mb-px'
                        : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
                    }`}
                  >
                    {label}{count != null && <span className="text-[12px] text-[var(--tf-text-tertiary)]"> {count}</span>}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 shrink-0 pb-2 ml-auto">
              {showSearch && <ViewModeToggle value={viewMode} onChange={setViewMode} />}
              {tab === 'skills' && reg.canEdit && (
                <Button variant="outline" size="sm" onClick={() => setImporting(true)} className="h-8 whitespace-nowrap">
                  Importieren
                </Button>
              )}
              {tab !== 'eval' && tab !== 'textbausteine' && reg.canEdit && (
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
        ) : tab === 'textbausteine' ? (
          <TextbausteineTab />
        ) : tab === 'skills' ? (
          <SkillsTab
            file={file}
            canEdit={reg.canEdit}
            search={search}
            viewMode={viewMode}
            agg={agg}
            onEdit={skill => guard.guardLeave(() => setDetail({ art: 'skill', skill, isNew: false }))}
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
            onEdit={regel => guard.guardLeave(() => setDetail({ art: 'regel', regel, isNew: false }))}
            onToggleAktiv={toggleAktiv}
          />
        ) : (
          <WorkflowsTab
            file={file}
            canEdit={reg.canEdit}
            selectedId={selectedWorkflowId}
            onSelectWorkflow={id => guard.guardLeave(() => setSelectedWorkflowId(id))}
            onEditStep={step => guard.guardLeave(() => setDetail({ art: 'step', step, isNew: false }))}
            onChangeSteps={mut.changeSteps}
            onCreateWorkflow={mut.createWorkflow}
            onSaveWorkflowMeta={mut.saveWorkflowMeta}
            onToggleFreigabe={mut.toggleWorkflowFreigabe}
            onToggleAktiv={mut.toggleWorkflowAktiv}
            onDeleteWorkflow={mut.deleteWorkflow}
            onExportWorkflow={exportWorkflow}
            onImportWorkflow={() => setImportingWorkflow(true)}
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
      {importingWorkflow && (
        <WorkflowImportDialog
          file={file}
          persist={reg.persist}
          onClose={() => setImportingWorkflow(false)}
          onImported={id => { setImportingWorkflow(false); setTab('workflows'); setSelectedWorkflowId(id); }}
        />
      )}
      <UnsavedChangesDialog {...guard.dialog} />
    </div>
  );
}

/**
 * Team- vs. persönliche Ebene eines Skills. Zwei Segmente statt Dropdown — die
 * Wahl ist binär und soll den Speicherort sofort lesbar machen.
 */
function EbenenWahl({ wert, onChange }: {
  wert: SkillEbene; onChange: (e: SkillEbene) => void;
}): React.ReactElement {
  const titel: Record<SkillEbene, string> = {
    team: 'Gilt für alle Nutzer — änderbar mit Kurator-/PL-Schreibrecht.',
    persoenlich: 'Gilt nur für Sie — gespeichert in Ihrem persönlichen Ordner.',
  };
  return (
    <span className="inline-flex rounded-[7px] border-[0.5px] border-[var(--tf-border)] overflow-hidden">
      {(['team', 'persoenlich'] as SkillEbene[]).map(e => (
        <button
          key={e}
          type="button"
          title={titel[e]}
          aria-pressed={wert === e}
          onClick={() => onChange(e)}
          className={`text-[11.5px] px-2.5 py-1 transition-colors cursor-pointer ${
            wert === e
              ? 'bg-[var(--tf-primary)] text-white'
              : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
          }`}
        >
          {e === 'team' ? 'Team' : 'Persönlich'}
        </button>
      ))}
    </span>
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
