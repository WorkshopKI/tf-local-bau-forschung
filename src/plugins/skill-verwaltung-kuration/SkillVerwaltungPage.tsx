import { useState } from 'react';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { resolveRegeln, type QualitaetsRegel, type SkillRecord, type SkillRegistryFile } from '@/core/services/skill-registry';
import { useSkillRegistry } from './useSkillRegistry';
import { SkillsTab } from './SkillsTab';
import { RegelnTab } from './RegelnTab';
import { SkillEditor } from './SkillEditor';
import { SkillTestlauf } from './SkillTestlauf';

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

interface Testlauf { skill: SkillRecord; regeln: QualitaetsRegel[]; hinweis: string }

export function SkillVerwaltungPage(): React.ReactElement {
  const reg = useSkillRegistry();
  const [tab, setTab] = useState<'skills' | 'regeln'>('skills');
  const [editing, setEditing] = useState<{ skill: SkillRecord; isNew: boolean } | null>(null);
  const [testlauf, setTestlauf] = useState<Testlauf | null>(null);
  const save = useAsyncAction(async (next: SkillRegistryFile) => { await reg.persist(next); });

  if (reg.loading || !reg.file) {
    return <div className="px-10 py-10 text-[13.5px] text-[var(--tf-text-secondary)]">Laden…</div>;
  }
  const file = reg.file;

  const testlaufModal = testlauf && (
    <SkillTestlauf skill={testlauf.skill} regeln={testlauf.regeln} hinweis={testlauf.hinweis} onClose={() => setTestlauf(null)} />
  );

  const openTestlaufForSaved = (skill: SkillRecord): void =>
    setTestlauf({ skill, regeln: resolveRegeln(file, skill), hinweis: `v${skill.version}` });

  const duplicate = (skill: SkillRecord): void => {
    const now = new Date().toISOString();
    const copy: SkillRecord = { ...skill, id: crypto.randomUUID(), name: `${skill.name} (Kopie)`, version: 1, geaendert_am: now };
    void save.run({ ...file, skills: [...file.skills, copy] });
  };
  const remove = (skill: SkillRecord): void => {
    if (!window.confirm(`Skill „${skill.name}" wirklich löschen?`)) return;
    void save.run({ ...file, skills: file.skills.filter(s => s.id !== skill.id) });
  };

  if (editing) {
    return (
      <>
        <div className="px-10 py-9">
          <SkillEditor
            file={file}
            skill={editing.skill}
            isNew={editing.isNew}
            canEdit={reg.canEdit}
            persist={reg.persist}
            onBack={() => setEditing(null)}
            onManageRegeln={() => { setEditing(null); setTab('regeln'); }}
            onTestlauf={(skill, regeln, hinweis) => setTestlauf({ skill, regeln, hinweis })}
          />
        </div>
        {testlaufModal}
      </>
    );
  }

  return (
    <>
      <div className="px-10 py-10 max-w-[1040px]">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[22px] font-medium m-0 mb-1.5 tracking-[-0.005em]">Skill-Verwaltung</h1>
            <div className="text-[11px] text-[var(--tf-text-tertiary)]">Änderungen gelten für alle Nutzer</div>
          </div>
          {tab === 'skills' && reg.canEdit && (
            <button
              onClick={() => setEditing({ skill: blankSkill(), isNew: true })}
              className="text-[13px] px-4 py-2 rounded-[8px] border-[0.5px] border-[var(--tf-border-hover)] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] whitespace-nowrap"
            >
              + Neuer Skill
            </button>
          )}
        </div>

        {!reg.canEdit && (
          <div className="mt-4 text-[12.5px] text-[var(--tf-text-secondary)] rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] px-3.5 py-2.5">
            Kurator-Modus nicht aktiv — Skills und Regeln sind nur lesbar. Sandbox-Testläufe sind möglich.
          </div>
        )}
        {reg.stale && (
          <div className="mt-2 text-[12.5px] rounded-[8px] px-3.5 py-2.5" style={{ background: 'var(--tf-warning-bg)', color: 'var(--tf-warning-text)' }}>
            Offline — angezeigter Stand stammt aus dem lokalen Zwischenspeicher.
          </div>
        )}

        {/* Tab-Pills */}
        <div className="inline-flex gap-1.5 mt-6 mb-5">
          {([['skills', 'Skills', file.skills.length], ['regeln', 'Qualitätsregeln', file.regeln.length]] as const).map(([id, label, count]) => (
            <button
              key={id}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}
              className={`text-[12.5px] px-3.5 py-[7px] rounded-[99px] border-[0.5px] inline-flex items-center gap-1.5 ${tab === id ? 'bg-[var(--tf-text)] text-[var(--tf-bg)] border-transparent' : 'bg-transparent text-[var(--tf-text-secondary)] border-[var(--tf-border)] hover:border-[var(--tf-border-hover)]'}`}
            >
              {label} <span className="text-[11px] opacity-65">{count}</span>
            </button>
          ))}
        </div>

        {save.error && (
          <div className="rounded p-2.5 text-[12px] mb-4" style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}>⚠ {save.error}</div>
        )}

        {tab === 'skills'
          ? <SkillsTab file={file} canEdit={reg.canEdit} onEdit={skill => setEditing({ skill, isNew: false })} onTestlauf={openTestlaufForSaved} onDuplicate={duplicate} onDelete={remove} />
          : <RegelnTab file={file} canEdit={reg.canEdit} persist={reg.persist} />}
      </div>
      {testlaufModal}
    </>
  );
}
