import type { SkillRegistryFile, WorkflowDef } from '@/core/services/skills';
import { istSeedWorkflow } from './workflowShared';

/**
 * Auswahl-Leiste aller WorkflowDefs der Registry: pro Eintrag NUR der Name
 * (kompakt — Typ/Freigabe/Aktiv stehen im Metadaten-Editor des gewählten
 * Workflows). Inaktive werden dezent gedämpft (gemuteter Text, keine Extra-Breite).
 * Seeds zuerst, dann alphabetisch.
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
        const isSelected = w.id === selectedId;
        return (
          <button
            key={w.id}
            type="button"
            aria-pressed={isSelected}
            title={aktiv ? w.name : `${w.name} (inaktiv)`}
            onClick={() => onSelect(w.id)}
            className={`text-left px-3 py-2 rounded-[10px] border-[0.5px] text-[13px] font-medium ${
              isSelected
                ? 'border-[var(--tf-primary)] bg-[var(--tf-primary-soft)]'
                : 'border-[var(--tf-border)] bg-[var(--tf-bg)] hover:border-[var(--tf-border-hover)]'
            } ${aktiv ? 'text-[var(--tf-text)]' : 'text-[var(--tf-text-tertiary)]'}`}
          >
            {w.name}
          </button>
        );
      })}
    </div>
  );
}
