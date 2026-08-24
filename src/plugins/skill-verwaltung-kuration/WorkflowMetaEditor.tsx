import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ArtefaktTyp, SkillRegistryFile, WorkflowDef, WorkflowEbene } from '@/core/services/skills';
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

/** Anzeige-Name einer Regel-ID; eine ID ohne Record wird als solche gezeigt. */
function regelName(file: SkillRegistryFile, id: string): string {
  return file.regeln.find(r => r.id === id)?.name ?? `${id} (fehlt)`;
}
/** Anzeige-Name eines Prüfers — mit Vermerk, wenn er stillgelegt ist. */
function prueferLabel(file: SkillRegistryFile, id: string): string {
  const s = file.skills.find(x => x.id === id);
  if (!s) return `${id} (fehlt)`;
  return s.aktiv === false ? `${s.name} (aus)` : s.name;
}

export function WorkflowMetaEditor({ file, def, canEdit, isSeed, onSaveMeta, onToggleFreigabe, onToggleAktiv, onDelete }: {
  file: SkillRegistryFile;
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

      {/* Was dieser Workflow JEDEM seiner Schritte auferlegt. Read-only: der Satz
          ändert sich selten (das ist sein Zweck), aber er darf nicht unsichtbar sein —
          sonst suchte man die vier Regeln bei den Abschnitten, wo sie nicht mehr
          stehen. Geändert wird er am Skill (Abwahl) oder in der registry.json. */}
      {(def.standardRegelIds?.length || def.pruefer?.length) && (
        <div className="mt-3.5 flex flex-col gap-1.5 border-t-[0.5px] border-[var(--tf-border)] pt-3">
          {def.standardRegelIds && def.standardRegelIds.length > 0 && (
            <p className="text-[11.5px] leading-[1.5] text-[var(--tf-text-tertiary)] m-0">
              <span className="text-[var(--tf-text-secondary)]">Standardsatz</span> — gilt für jeden
              Schritt, sofern der Abschnitt ihn nicht abwählt:{' '}
              {def.standardRegelIds.map(id => regelName(file, id)).join(' · ')}
            </p>
          )}
          {def.pruefer && def.pruefer.length > 0 && (
            <p className="text-[11.5px] leading-[1.5] text-[var(--tf-text-tertiary)] m-0">
              <span className="text-[var(--tf-text-secondary)]">Prüfer</span> — läuft nach jeder
              Erzeugung: {def.pruefer.map(id => prueferLabel(file, id)).join(' · ')}
            </p>
          )}
        </div>
      )}

      {typGeaendert && (
        <p className="text-[11.5px] text-[var(--tf-warning-text)] mt-2.5">
          Typ/Ebene-Wechsel ändert die Laufzeit-Auswahl + Vorlagen-Zuordnung — erst mit „Speichern" wirksam.
        </p>
      )}

      {canEdit && (
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!dirty}
            onClick={() => onSaveMeta({ ...def, name: name.trim() || def.name, artefaktTyp, ebene })}
          >
            Speichern
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onToggleFreigabe(def)}
          >
            {entwurf ? 'Freigeben' : 'Auf Entwurf zurückstellen'}
          </Button>
          <span className="flex-1" />
          {isSeed ? (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--tf-text-tertiary)]">
              <Lock size={12} aria-hidden />
              Seed-Workflow — nicht löschbar, nur deaktivierbar
            </span>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDelete(def)}
              className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)]"
            >
              Löschen
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
