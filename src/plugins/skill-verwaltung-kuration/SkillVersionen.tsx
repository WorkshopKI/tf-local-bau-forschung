/**
 * „Versionen"-Reiter des Skill-Editors: bounded Historie (newest-first) mit Diff
 * gegen die jeweilige Vorversion + Rollback (alten Stand als NEUE Version). Rein
 * darstellend — die Rollback-Mutation (`rollbackSkill`) + Persistenz liegen im
 * Editor/Page.
 */
import { useState } from 'react';
import { RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import {
  diffSkillVersions,
  type SkillModifierKey,
  type SkillRecord,
  type SkillVersionsDiff,
  type SkillVersionSnapshot,
} from '@/core/services/skills';
import { formatDate } from './registryFormat';

const MOD_LABEL: Record<SkillModifierKey, string> = { neu: 'Neu', kuerzer: 'Kürzer', laenger: 'Länger' };

interface SkillVersionenProps {
  skill: SkillRecord;
  canEdit: boolean;
  onRollback: (snapshot: SkillVersionSnapshot) => void;
}

export function SkillVersionen({ skill, canEdit, onRollback }: SkillVersionenProps): React.ReactElement {
  const historie = skill.historie ?? [];
  if (historie.length <= 1) {
    return (
      <p className="text-[12.5px] text-[var(--tf-text-tertiary)] py-4">
        Noch keine früheren Versionen. Sobald der Skill bearbeitet wird, erscheint hier die Historie (max. 10 Stände) mit Diff und Rollback.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      {historie.map((snap, i) => {
        const vor = historie[i + 1];
        const diff = vor ? diffSkillVersions(vor, snap) : null;
        const istAktuell = i === 0;
        return (
          <VersionEintrag
            key={`${snap.version}-${i}`}
            snap={snap}
            diff={diff}
            istAktuell={istAktuell}
            canRollback={!istAktuell && canEdit}
            onRollback={() => onRollback(snap)}
          />
        );
      })}
    </div>
  );
}

interface VersionEintragProps {
  snap: SkillVersionSnapshot;
  diff: SkillVersionsDiff | null;
  istAktuell: boolean;
  canRollback: boolean;
  onRollback: () => void;
}

function VersionEintrag({ snap, diff, istAktuell, canRollback, onRollback }: VersionEintragProps): React.ReactElement {
  const [open, setOpen] = useState(istAktuell);
  const hatDiff = !!diff && !diff.unveraendert;
  return (
    <div className="rounded-[10px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)]">
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          disabled={!hatDiff}
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--tf-text)] disabled:opacity-60"
        >
          {hatDiff ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-3.5" />}
          <span className="font-medium">v{snap.version}</span>
          {istAktuell && <span className="text-[10.5px] px-1.5 py-0.5 rounded-[5px] bg-[var(--tf-primary-light)] text-[var(--tf-primary)]">aktuell</span>}
        </button>
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          {formatDate(snap.geaendert_am)}{snap.userId ? ` · ${snap.userId}` : ''}
        </span>
        <span className="flex-1" />
        {canRollback && (
          <button
            type="button"
            onClick={onRollback}
            className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-[8px] border-[0.5px] border-[var(--tf-border-hover)] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-hover)]"
          >
            <RotateCcw size={12} />
            Zurücksetzen
          </button>
        )}
      </div>
      {snap.begruendung && (
        <div className="px-3.5 pb-2 -mt-1 text-[12px] text-[var(--tf-text-secondary)] italic">„{snap.begruendung}"</div>
      )}
      {open && hatDiff && diff && (
        <div className="px-3.5 pb-3.5 pt-1 border-t-[0.5px] border-[var(--tf-border)]">
          <DiffView diff={diff} />
        </div>
      )}
      {open && !hatDiff && (
        <div className="px-3.5 pb-3 text-[12px] text-[var(--tf-text-tertiary)]">Keine inhaltliche Änderung gegenüber der Vorversion.</div>
      )}
    </div>
  );
}

function DiffView({ diff }: { diff: SkillVersionsDiff }): React.ReactElement {
  const geaenderteZeilen = diff.template.filter(z => z.typ !== 'gleich');
  return (
    <div className="flex flex-col gap-3 mt-1">
      {geaenderteZeilen.length > 0 && (
        <div>
          <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] mb-1.5">Prompt-Vorlage</div>
          <pre className="rounded-[8px] bg-[var(--tf-bg-secondary)] px-3 py-2.5 font-mono text-[12px] leading-[1.6] m-0 whitespace-pre-wrap overflow-x-auto">
            {geaenderteZeilen.map((z, i) => (
              <div
                key={i}
                style={{
                  color: z.typ === 'hinzu' ? 'var(--tf-success-text)' : 'var(--tf-danger-text)',
                  background: z.typ === 'hinzu' ? 'var(--tf-success-bg)' : 'var(--tf-danger-bg)',
                }}
                className="px-1 rounded-[3px]"
              >
                {z.typ === 'hinzu' ? '+ ' : '− '}{z.text || ' '}
              </div>
            ))}
          </pre>
        </div>
      )}
      {(diff.regeln.hinzu.length > 0 || diff.regeln.weg.length > 0) && (
        <div className="text-[12px] text-[var(--tf-text-secondary)]">
          <span className="text-[var(--tf-text-tertiary)]">Regeln:</span>{' '}
          {diff.regeln.hinzu.map(id => <span key={id} className="mr-1.5" style={{ color: 'var(--tf-success-text)' }}>+{id}</span>)}
          {diff.regeln.weg.map(id => <span key={id} className="mr-1.5" style={{ color: 'var(--tf-danger-text)' }}>−{id}</span>)}
        </div>
      )}
      {diff.modifiers.length > 0 && (
        <div className="text-[12px] text-[var(--tf-text-secondary)]">
          <span className="text-[var(--tf-text-tertiary)]">Modifikatoren geändert:</span> {diff.modifiers.map(k => MOD_LABEL[k]).join(', ')}
        </div>
      )}
      {(diff.qsKriterien.hinzu.length > 0 || diff.qsKriterien.weg.length > 0) && (
        <div className="text-[12px] text-[var(--tf-text-secondary)] flex flex-col gap-0.5">
          <span className="text-[var(--tf-text-tertiary)]">Abnahme-Kriterien:</span>
          {diff.qsKriterien.hinzu.map(k => (
            <span key={`+${k}`} style={{ color: 'var(--tf-success-text)' }}>+ {k}</span>
          ))}
          {diff.qsKriterien.weg.map(k => (
            <span key={`-${k}`} style={{ color: 'var(--tf-danger-text)' }}>− {k}</span>
          ))}
        </div>
      )}
    </div>
  );
}
