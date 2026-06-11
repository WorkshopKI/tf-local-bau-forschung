import type { SkillRecord, SkillRegistryFile } from '@/core/services/skill-registry';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Erste bis zu drei nicht-leeren Zeilen des Prompts als Anriss. */
function promptAnriss(template: string): string {
  const lines = template.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 3);
  return lines.join('\n') + (template.trim() ? ' …' : '');
}

interface SkillsTabProps {
  file: SkillRegistryFile;
  canEdit: boolean;
  onEdit: (skill: SkillRecord) => void;
  onTestlauf: (skill: SkillRecord) => void;
  onDuplicate: (skill: SkillRecord) => void;
  onDelete: (skill: SkillRecord) => void;
}

export function SkillsTab({ file, canEdit, onEdit, onTestlauf, onDuplicate, onDelete }: SkillsTabProps): React.ReactElement {
  if (file.skills.length === 0) {
    return (
      <p className="text-[13.5px] text-[var(--tf-text-secondary)] py-6">
        Noch keine Skills. Lege den ersten an →
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3.5">
      {file.skills.map(skill => (
        <div key={skill.id} className="rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] p-[20px]">
          <h2 className="text-[15px] font-medium text-[var(--tf-text)] m-0">{skill.name}</h2>
          {skill.beschreibung && (
            <p className="text-[13.5px] leading-[1.55] text-[var(--tf-text-secondary)] mt-1.5">{skill.beschreibung}</p>
          )}
          <p className="text-[12px] text-[var(--tf-text-tertiary)] mt-2">
            Version&nbsp;{skill.version}
            <span className="px-1">·</span>geändert {formatDate(skill.geaendert_am)}
            <span className="px-1">·</span>{skill.regelIds.length} {skill.regelIds.length === 1 ? 'Regel' : 'Regeln'} zugeordnet
          </p>
          <pre className="mt-3.5 rounded-[8px] bg-[var(--tf-bg-secondary)] px-3.5 py-3 font-mono text-[12.5px] leading-[1.65] text-[var(--tf-text-secondary)] whitespace-pre-wrap m-0">
            {promptAnriss(skill.promptTemplate)}
          </pre>
          <div className="mt-4 pt-3.5 border-t-[0.5px] border-[var(--tf-border)] flex items-center gap-3">
            <button onClick={() => onEdit(skill)} className="text-[13px] text-[var(--tf-text)] hover:opacity-70">
              {canEdit ? 'Bearbeiten' : 'Ansehen'}
            </button>
            <span className="text-[var(--tf-text-tertiary)] text-[12px]">·</span>
            <button onClick={() => onTestlauf(skill)} className="text-[13px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]">
              Testlauf
            </button>
            {canEdit && (
              <>
                <span className="text-[var(--tf-text-tertiary)] text-[12px]">·</span>
                <button onClick={() => onDuplicate(skill)} className="text-[13px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]">
                  Duplizieren
                </button>
              </>
            )}
            <span className="flex-1" />
            {canEdit && (
              <button onClick={() => onDelete(skill)} className="text-[13px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)]">
                Löschen
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
