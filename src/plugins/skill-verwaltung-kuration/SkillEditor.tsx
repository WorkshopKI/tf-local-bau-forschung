import { useState } from 'react';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  buildPromptVorgaben,
  resolveRegeln,
  describeRegelParams,
  type QualitaetsRegel,
  type SkillModifierKey,
  type SkillRecord,
  type SkillRegistryFile,
} from '@/core/services/skill-registry';

const SLOT_EXPL: Record<string, string> = {
  stammdaten: 'FKZ, Firmenname, Akronym und Antragstyp aus den TeamFlow-Stammdaten.',
  vbMarkdown: 'Volltext der Vorhabensbeschreibung (Markdown) aus dem DMS.',
};
const MOD_LABEL: Record<SkillModifierKey, string> = { neu: 'Neu', kuerzer: 'Kürzer', laenger: 'Länger' };

function upsertSkill(skills: SkillRecord[], s: SkillRecord): SkillRecord[] {
  const i = skills.findIndex(x => x.id === s.id);
  if (i < 0) return [...skills, s];
  const copy = [...skills];
  copy[i] = s;
  return copy;
}

interface SkillEditorProps {
  file: SkillRegistryFile;
  skill: SkillRecord;
  isNew: boolean;
  canEdit: boolean;
  persist: (next: SkillRegistryFile) => Promise<void>;
  onBack: () => void;
  onManageRegeln: () => void;
  onTestlauf: (skill: SkillRecord, regeln: QualitaetsRegel[], hinweis: string) => void;
}

export function SkillEditor({ file, skill, isNew, canEdit, persist, onBack, onManageRegeln, onTestlauf }: SkillEditorProps): React.ReactElement {
  const [draft, setDraft] = useState<SkillRecord>(skill);
  const nextVersion = isNew ? draft.version : skill.version + 1;
  const dirty = JSON.stringify(draft) !== JSON.stringify(skill);

  const assignedRegeln = resolveRegeln(file, draft);
  const vorgaben = buildPromptVorgaben(assignedRegeln);

  const save = useAsyncAction(async () => {
    const updated: SkillRecord = { ...draft, version: nextVersion, geaendert_am: new Date().toISOString() };
    await persist({ ...file, skills: upsertSkill(file.skills, updated) });
  }, { onSuccess: onBack });

  const toggleRegel = (id: string): void =>
    setDraft(d => ({ ...d, regelIds: d.regelIds.includes(id) ? d.regelIds.filter(x => x !== id) : [...d.regelIds, id] }));

  const ro = !canEdit;
  const inputCls = 'w-full rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-transparent outline-none focus:border-[var(--tf-primary)] disabled:opacity-70';

  return (
    <div className="max-w-[900px]">
      <button onClick={onBack} className="text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] mb-4">← Skill-Verwaltung</button>
      <div className="flex items-baseline gap-2.5">
        <input
          value={draft.name}
          disabled={ro}
          onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
          className="text-[20px] font-medium text-[var(--tf-text)] bg-transparent outline-none border-b border-transparent focus:border-[var(--tf-border-hover)] disabled:opacity-100"
        />
        <span className="text-[11px] px-2 py-0.5 rounded-[99px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">v{skill.version}</span>
      </div>
      <input
        value={draft.beschreibung}
        disabled={ro}
        placeholder="Kurzbeschreibung…"
        onChange={e => setDraft(d => ({ ...d, beschreibung: e.target.value }))}
        className="text-[12px] text-[var(--tf-text-tertiary)] bg-transparent outline-none mt-1.5 mb-6 w-full"
      />

      <div className="rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] p-[24px]">
        {/* Prompt-Vorlage */}
        <Section>Prompt-Vorlage</Section>
        <textarea
          value={draft.promptTemplate}
          disabled={ro}
          rows={16}
          onChange={e => setDraft(d => ({ ...d, promptTemplate: e.target.value }))}
          className={`${inputCls} bg-[var(--tf-bg-secondary)] px-[18px] py-4 font-mono text-[12.5px] leading-[1.75] text-[var(--tf-text)] resize-y`}
        />
        <div className="mt-3 flex flex-col gap-1.5">
          {draft.slots.map(slot => (
            <div key={slot} className="flex items-baseline gap-2.5">
              <span className="font-mono text-[11.5px] bg-[var(--tf-primary-light)] text-[var(--tf-primary)] rounded-[5px] px-[7px] py-1 flex-shrink-0">{`{{${slot}}}`}</span>
              <span className="text-[11px] leading-[1.45] text-[var(--tf-text-tertiary)]">{SLOT_EXPL[slot] ?? 'Kontext-Slot.'}</span>
            </div>
          ))}
        </div>

        {/* Formale Vorgaben (automatisch) */}
        <div className="mt-7">
          <Section>Formale Vorgaben (automatisch)</Section>
          <p className="text-[11.5px] leading-[1.5] text-[var(--tf-text-tertiary)] m-0 mb-2.5">
            Wird aus den zugeordneten Qualitätsregeln erzeugt und dem Prompt automatisch angehängt.
          </p>
          <div className="border-l-2 border-[var(--tf-border-hover)] bg-[var(--tf-bg-secondary)] rounded-r-[8px] px-4 py-3.5">
            {vorgaben
              ? vorgaben.split('\n').filter(l => l.startsWith('- ')).map((l, i) => (
                  <div key={i} className="font-mono text-[12.5px] leading-[1.5] text-[var(--tf-text-secondary)] mb-2 last:mb-0">{l.slice(2)}</div>
                ))
              : <div className="text-[12.5px] text-[var(--tf-text-tertiary)]">Keine aktiven Regeln zugeordnet.</div>}
          </div>
        </div>

        {/* Modifikatoren */}
        <div className="mt-7">
          <Section>Modifikatoren</Section>
          <div className="flex flex-col gap-3">
            {(['neu', 'kuerzer', 'laenger'] as SkillModifierKey[]).map(k => (
              <div key={k} className="grid grid-cols-[76px_1fr] items-start gap-3.5">
                <span className="text-[13px] font-medium text-[var(--tf-text)] pt-2">{MOD_LABEL[k]}</span>
                <textarea
                  value={draft.modifiers[k]}
                  disabled={ro}
                  rows={2}
                  onChange={e => setDraft(d => ({ ...d, modifiers: { ...d.modifiers, [k]: e.target.value } }))}
                  className={`${inputCls} px-[11px] py-2 text-[12.5px] leading-[1.55] text-[var(--tf-text-secondary)] resize-y`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Zugeordnete Qualitätsregeln */}
        <div className="mt-7">
          <Section>Zugeordnete Qualitätsregeln</Section>
          <div className="flex flex-col">
            {file.regeln.map(r => {
              const checked = draft.regelIds.includes(r.id);
              return (
                <label key={r.id} className="flex items-center gap-3 py-[11px] border-t-[0.5px] border-[var(--tf-border)] first:border-t-0 cursor-pointer">
                  <input type="checkbox" checked={checked} disabled={ro} onChange={() => toggleRegel(r.id)} />
                  <span className="text-[13px] text-[var(--tf-text)]">{r.name}</span>
                  <span className="ml-auto font-mono text-[12px] text-[var(--tf-text-tertiary)]">{describeRegelParams(r)}</span>
                </label>
              );
            })}
            {file.regeln.length === 0 && <p className="text-[12.5px] text-[var(--tf-text-tertiary)] py-2">Noch keine Regeln in der Bibliothek.</p>}
          </div>
          <button onClick={onManageRegeln} className="text-[12.5px] text-[var(--tf-primary)] hover:underline mt-3.5">Regeln verwalten →</button>
        </div>

        {save.error && (
          <div className="rounded p-2.5 text-[12px] mt-5" style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}>⚠ {save.error}</div>
        )}

        {/* Fußleiste */}
        <div className="mt-6 pt-4 border-t-[0.5px] border-[var(--tf-border)] flex items-center gap-2.5">
          {canEdit && (
            <>
              <button onClick={() => { void save.run(); }} disabled={save.busy} className="text-[13px] px-4 py-2 rounded-[8px] bg-[var(--tf-text)] text-[var(--tf-bg)] hover:opacity-85 disabled:opacity-50">
                {save.busy ? 'Speichere…' : 'Speichern'}
              </button>
              <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">erzeugt Version {nextVersion}</span>
            </>
          )}
          {!canEdit && <span className="text-[12px] text-[var(--tf-text-tertiary)]">Kurator-Modus nicht aktiv — nur lesbar.</span>}
          <span className="flex-1" />
          <button
            onClick={() => onTestlauf(draft, assignedRegeln, `v${draft.version}${dirty ? ' · ungespeicherte Änderungen' : ''}`)}
            className="text-[13px] px-4 py-2 rounded-[8px] border-[0.5px] border-[var(--tf-border-hover)] text-[var(--tf-text)] hover:bg-[var(--tf-hover)]"
          >
            Testlauf
          </button>
          <button onClick={onBack} className="text-[13px] px-4 py-2 rounded-[8px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]">Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">{children}</span>
      <span className="flex-1 h-[0.5px] bg-[var(--tf-border)]" />
    </div>
  );
}
