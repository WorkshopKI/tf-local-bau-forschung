import { useState } from 'react';
import { Lock } from 'lucide-react';
import type { ArtefaktTyp, WorkflowDef, WorkflowEbene } from '@/core/services/skills';
import { ARTEFAKT_TYP_LABEL, EBENE_LABEL } from './workflowShared';
import { Switch } from './regelShared';

/**
 * Metadaten-Editor des gewählten Workflows: Name, Artefakt-Typ, Ebene, Aktiv-
 * Toggle, Freigabe-Umschaltung und Löschen/Deaktivieren. Name/Typ/Ebene brauchen
 * ein explizites „Speichern" (bumpt die Version); Aktiv/Freigabe sind Sofort-
 * Aktionen. Pro `def.id` neu gemountet (Aufrufer setzt `key`), damit der lokale
 * Entwurf beim Workflow-Wechsel frisch startet.
 */

const SELECT = 'text-[13px] px-2.5 py-2 rounded-[8px] border-[0.5px] border-[var(--tf-border-hover)] bg-[var(--tf-bg)] text-[var(--tf-text)] outline-none focus:border-[var(--tf-primary)] disabled:opacity-70';
const FIELD_LABEL = 'block text-[10.5px] font-medium uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)] mb-2';
const ARTEFAKT_OPTIONS = Object.keys(ARTEFAKT_TYP_LABEL) as ArtefaktTyp[];
const EBENE_OPTIONS = Object.keys(EBENE_LABEL) as WorkflowEbene[];

export function WorkflowMetaEditor({ def, canEdit, isSeed, onSaveMeta, onToggleFreigabe, onToggleAktiv, onDelete }: {
  def: WorkflowDef;
  canEdit: boolean;
  isSeed: boolean;
  onSaveMeta: (def: WorkflowDef) => void;
  onToggleFreigabe: (def: WorkflowDef) => void;
  onToggleAktiv: (def: WorkflowDef) => void;
  onDelete: (def: WorkflowDef) => void;
}): React.ReactElement {
  const [name, setName] = useState(def.name);
  const [artefaktTyp, setArtefaktTyp] = useState<ArtefaktTyp>(def.artefaktTyp ?? 'ga');
  const [ebene, setEbene] = useState<WorkflowEbene>(def.ebene ?? 'verbund');
  const ro = !canEdit;

  const dirty = name !== def.name || artefaktTyp !== (def.artefaktTyp ?? 'ga') || ebene !== (def.ebene ?? 'verbund');
  const typGeaendert = artefaktTyp !== (def.artefaktTyp ?? 'ga') || ebene !== (def.ebene ?? 'verbund');
  const entwurf = def.freigabe === 'entwurf';
  const aktiv = def.aktiv !== false;

  return (
    <div className="rounded-[10px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] p-3.5">
      <div className="flex flex-wrap gap-x-8 gap-y-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className={FIELD_LABEL}>Name</label>
          <input
            value={name}
            disabled={ro}
            onChange={e => setName(e.target.value)}
            className={`${SELECT} w-full`}
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>Artefakt-Typ</label>
          <select value={artefaktTyp} disabled={ro} onChange={e => setArtefaktTyp(e.target.value as ArtefaktTyp)} className={SELECT}>
            {ARTEFAKT_OPTIONS.map(t => <option key={t} value={t}>{ARTEFAKT_TYP_LABEL[t]}</option>)}
          </select>
        </div>
        <div>
          <label className={FIELD_LABEL}>Ebene</label>
          <select value={ebene} disabled={ro} onChange={e => setEbene(e.target.value as WorkflowEbene)} className={SELECT}>
            {EBENE_OPTIONS.map(e => <option key={e} value={e}>{EBENE_LABEL[e]}</option>)}
          </select>
        </div>
        <div>
          <label className={FIELD_LABEL}>Aktiv</label>
          <Switch on={aktiv} disabled={ro} onClick={() => onToggleAktiv(def)} />
        </div>
      </div>

      {typGeaendert && (
        <p className="text-[11.5px] text-[var(--tf-warning-text)] mt-2.5">
          Typ/Ebene-Wechsel ändert die Laufzeit-Auswahl + Vorlagen-Zuordnung — erst mit „Speichern" wirksam.
        </p>
      )}

      {canEdit && (
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!dirty}
            onClick={() => onSaveMeta({ ...def, name: name.trim() || def.name, artefaktTyp, ebene })}
            className="text-[12.5px] px-3.5 py-1.5 rounded-[8px] bg-[var(--tf-text)] text-[var(--tf-bg)] hover:opacity-85 disabled:opacity-40"
          >
            Speichern
          </button>
          <button
            type="button"
            onClick={() => onToggleFreigabe(def)}
            className="text-[12.5px] px-3.5 py-1.5 rounded-[8px] border-[0.5px] border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:border-[var(--tf-border-hover)]"
          >
            {entwurf ? 'Freigeben' : 'Auf Entwurf zurückstellen'}
          </button>
          <span className="flex-1" />
          {isSeed ? (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--tf-text-tertiary)]">
              <Lock size={12} aria-hidden />
              Seed-Workflow — nicht löschbar, nur deaktivierbar
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onDelete(def)}
              className="text-[12.5px] px-3.5 py-1.5 rounded-[8px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)]"
            >
              Löschen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
