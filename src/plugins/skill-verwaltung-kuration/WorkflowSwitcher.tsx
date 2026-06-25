import type { SkillRegistryFile, WorkflowDef } from '@/core/services/skills';
import { ARTEFAKT_TYP_LABEL, istSeedWorkflow } from './workflowShared';

/**
 * Auswahl-Leiste aller WorkflowDefs der Registry: pro Eintrag Name +
 * Artefakt-Typ-Badge + Status (Entwurf/Freigegeben, Inaktiv). Seeds zuerst,
 * dann alphabetisch. Reine Auswahl — Anlegen/Metadaten/Freigeben/Löschen (Phase 3)
 * leben separat.
 */

/** Stabile Sortierung: geseedete Workflows zuerst, dann nach Name. */
function sortWorkflows(workflows: readonly WorkflowDef[]): WorkflowDef[] {
  return [...workflows].sort((a, b) => {
    const sa = istSeedWorkflow(a.id) ? 0 : 1;
    const sb = istSeedWorkflow(b.id) ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });
}

export function WorkflowSwitcher({ file, selectedId, onSelect }: {
  file: SkillRegistryFile;
  selectedId: string;
  onSelect: (id: string) => void;
}): React.ReactElement {
  const workflows = sortWorkflows(file.workflows ?? []);

  return (
    <div className="flex flex-wrap gap-2">
      {workflows.map(w => {
        const aktiv = w.aktiv !== false;
        const entwurf = w.freigabe === 'entwurf';
        const isSelected = w.id === selectedId;
        return (
          <button
            key={w.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(w.id)}
            className={`flex items-center gap-2 text-left px-3 py-2 rounded-[10px] border-[0.5px] ${
              isSelected
                ? 'border-[var(--tf-primary)] bg-[var(--tf-primary-soft)]'
                : 'border-[var(--tf-border)] bg-[var(--tf-bg)] hover:border-[var(--tf-border-hover)]'
            }`}
          >
            <span className="text-[13px] font-medium text-[var(--tf-text)]">{w.name}</span>
            <span className="text-[10.5px] px-1.5 py-0.5 rounded-[5px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">
              {ARTEFAKT_TYP_LABEL[w.artefaktTyp ?? 'ga']}
            </span>
            <span className={`text-[11px] ${entwurf ? 'text-[var(--tf-warning-text)]' : 'text-[var(--tf-text-tertiary)]'}`}>
              {entwurf ? 'Entwurf' : 'Freigegeben'}
            </span>
            {!aktiv && <span className="text-[11px] text-[var(--tf-danger-text)]">Inaktiv</span>}
          </button>
        );
      })}
    </div>
  );
}
