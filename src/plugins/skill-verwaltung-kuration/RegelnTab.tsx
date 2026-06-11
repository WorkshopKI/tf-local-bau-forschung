import { useState } from 'react';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  describeRegelParams,
  skillsUsingRegel,
  type QualitaetsRegel,
  type Schweregrad,
  type SkillRegistryFile,
} from '@/core/services/skill-registry';
import { RegelEditor } from './RegelEditor';

const TYP_LABEL: Record<string, string> = {
  zeichen_max: 'Zeichen max',
  wortanzahl: 'Wortanzahl',
  satzanzahl: 'Satzanzahl',
  satzlaenge_max: 'Satzlänge',
  verbotenes_muster: 'Verbotenes Muster',
  pflicht_anfang: 'Pflicht-Anfang',
  keine_aufzaehlungen: 'Keine Aufzählungen',
};
const ADD_TYPEN = Object.keys(TYP_LABEL);
const DEFAULT_PARAMS: Record<string, Record<string, unknown>> = {
  zeichen_max: { max: 1000 },
  wortanzahl: {},
  satzanzahl: { min: 8, max: 12 },
  satzlaenge_max: { maxWoerter: 25 },
  verbotenes_muster: { muster: [], istRegex: false },
  pflicht_anfang: { text: '' },
  keine_aufzaehlungen: {},
};

function blankRegel(typ: string): QualitaetsRegel {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: TYP_LABEL[typ] ?? typ,
    typ,
    params: { ...(DEFAULT_PARAMS[typ] ?? {}) },
    schweregrad: 'fehler',
    aktiv: true,
    erstellt_am: now,
    geaendert_am: now,
  };
}

function upsert(regeln: QualitaetsRegel[], r: QualitaetsRegel): QualitaetsRegel[] {
  const i = regeln.findIndex(x => x.id === r.id);
  if (i < 0) return [...regeln, r];
  const copy = [...regeln];
  copy[i] = r;
  return copy;
}

function Switch({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled: boolean }): React.ReactElement {
  return (
    <button
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-block w-8 h-[18px] rounded-[99px] align-middle disabled:opacity-50 ${on ? 'bg-[var(--tf-text)]' : 'bg-[var(--tf-border-hover)]'}`}
    >
      <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-[99px] bg-[var(--tf-bg)] ${on ? 'left-4' : 'left-0.5'}`} />
    </button>
  );
}

function SevPill({ s }: { s: Schweregrad }): React.ReactElement {
  return (
    <span className={`text-[11px] px-2.5 py-1 rounded-[99px] ${s === 'fehler' ? 'bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]' : 'bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]'}`}>
      {s === 'fehler' ? 'Fehler' : 'Hinweis'}
    </span>
  );
}

const COLS = 'grid items-center gap-3.5 grid-cols-[150px_132px_1fr_96px_60px_110px]';

interface RegelnTabProps {
  file: SkillRegistryFile;
  canEdit: boolean;
  persist: (next: SkillRegistryFile) => Promise<void>;
}

export function RegelnTab({ file, canEdit, persist }: RegelnTabProps): React.ReactElement {
  const [editId, setEditId] = useState<string | null>(null);
  const [addTyp, setAddTyp] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const save = useAsyncAction(async (next: SkillRegistryFile) => { await persist(next); });

  const closeEditors = (): void => { setEditId(null); setAddTyp(null); setAddOpen(false); };

  const toggleAktiv = (r: QualitaetsRegel): void => {
    void save.run({ ...file, regeln: upsert(file.regeln, { ...r, aktiv: !r.aktiv, geaendert_am: new Date().toISOString() }) });
  };
  const saveRegel = (r: QualitaetsRegel): void => {
    void save.run({ ...file, regeln: upsert(file.regeln, r) }).then(closeEditors);
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
    });
  };

  return (
    <div>
      <p className="text-[13.5px] leading-[1.55] text-[var(--tf-text-secondary)] m-0 mb-5 max-w-[720px]">
        Jede Regel kodiert eine Erfahrung — sie wird automatisch geprüft und der KI als Vorgabe mitgegeben.
      </p>

      {save.error && (
        <div className="rounded p-2.5 text-[12px] mb-4" style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}>
          ⚠ {save.error}
        </div>
      )}

      <div className="rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] px-[22px] py-2 pb-4">
        <div className={`${COLS} py-3.5`}>
          {['Regel', 'Typ', 'Parameter', 'Schweregrad', 'Aktiv', 'Verwendet in'].map(h => (
            <span key={h} className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)]">{h}</span>
          ))}
        </div>

        {file.regeln.map(r => {
          const used = skillsUsingRegel(file, r.id);
          return (
            <div key={r.id}>
              <div className={`${COLS} py-[13px] border-t-[0.5px] border-[var(--tf-border)]`}>
                {canEdit
                  ? <button onClick={() => { closeEditors(); setEditId(r.id); }} className="text-left text-[13px] font-medium text-[var(--tf-text)] hover:opacity-70">{r.name}</button>
                  : <span className="text-[13px] font-medium text-[var(--tf-text)]">{r.name}</span>}
                <span><span className="text-[11px] px-2.5 py-1 rounded-[99px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">{TYP_LABEL[r.typ] ?? 'unbekannter Typ'}</span></span>
                <span className="text-[12.5px] text-[var(--tf-text-secondary)]">{describeRegelParams(r)}</span>
                <span><SevPill s={r.schweregrad} /></span>
                <span><Switch on={r.aktiv} disabled={!canEdit || save.busy} onClick={() => toggleAktiv(r)} /></span>
                <span className={`text-[12.5px] ${used.length ? 'text-[var(--tf-text-secondary)]' : 'text-[var(--tf-text-tertiary)]'}`}>{used.length ? used.join(', ') : '—'}</span>
              </div>
              {editId === r.id && (
                <RegelEditor initial={r} busy={save.busy} onSave={saveRegel} onCancel={closeEditors} onDelete={() => deleteRegel(r)} />
              )}
            </div>
          );
        })}
      </div>

      {/* Neue Regel */}
      {canEdit && (
        <div className="mt-[18px] rounded-[12px] border-[0.5px] border-dashed border-[var(--tf-border-hover)] bg-[var(--tf-bg)] p-[20px]">
          {!addOpen && !addTyp && (
            <button onClick={() => setAddOpen(true)} className="text-[13px] text-[var(--tf-primary)] hover:underline">+ Regel hinzufügen</button>
          )}
          {addOpen && !addTyp && (
            <div>
              <h3 className="text-[13px] font-medium text-[var(--tf-text)] m-0 mb-1">Neue Regel</h3>
              <p className="text-[12px] text-[var(--tf-text-tertiary)] m-0 mb-3.5">Regeltyp wählen — die passenden Parameterfelder erscheinen darunter.</p>
              <div className="flex flex-wrap gap-2">
                {ADD_TYPEN.map(t => (
                  <button key={t} onClick={() => setAddTyp(t)} className="text-[12px] px-[13px] py-[7px] rounded-[99px] border-[0.5px] border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:border-[var(--tf-border-hover)]">
                    {TYP_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {addTyp && (
            <RegelEditor initial={blankRegel(addTyp)} busy={save.busy} onSave={saveRegel} onCancel={closeEditors} />
          )}
        </div>
      )}
    </div>
  );
}
