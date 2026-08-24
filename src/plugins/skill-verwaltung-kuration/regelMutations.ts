/**
 * Geteilte Regel-Mutations-Aktionen für die Skill-Verwaltung UND die Inline-
 * Werkstatt in der Gutachten-Ansicht. Reine Fabrik ohne React-Hooks — Persistenz
 * und UI-Nachaktionen werden injiziert, damit beide Aufrufer denselben Zweig
 * nutzen (Schwester von [buildWorkflowMutations](./workflowMutations.ts)).
 *
 * Zwei Persist-Wege bewusst getrennt (wie dort):
 *  - `persist` roh + awaitbar (wirft) → `persistRegel` (Leave-Guard-Pfad des RegelEditor).
 *  - `run` fire-and-forget mit Busy/Error-Tracking (`useAsyncAction.run`) → alles andere.
 *
 * Das Detail, das eine Kopie verlöre: `deleteRegel` putzt die `regelIds` ALLER
 * Skills mit. Eine verwaiste Zuordnung würde beim nächsten `resolveRegeln` still
 * verschwinden — der Skill sähe unverändert aus und prüfte trotzdem anders.
 */
import { upsertRegel } from './regelShared';
import { skillsUsingRegel, type QualitaetsRegel, type SkillRegistryFile } from '@/core/services/skills';

export interface RegelMutationDeps {
  file: SkillRegistryFile;
  /** Roher, awaitbarer Persist (wirft bei Fehler) — für den Leave-Guard-Pfad. */
  persist: (next: SkillRegistryFile) => Promise<void>;
  /** Fire-and-forget-Persist mit Busy/Error-Tracking (`useAsyncAction.run`). */
  run: (next: SkillRegistryFile) => Promise<void>;
  /** Nach erfolgreichem Speichern — Editor schließen bzw. zum Skill zurück. */
  onGespeichert?: () => void;
  /** Nach erfolgreichem Löschen. */
  onGeloescht?: () => void;
}

export interface RegelMutations {
  toggleAktiv: (r: QualitaetsRegel) => void;
  saveRegel: (r: QualitaetsRegel) => void;
  persistRegel: (r: QualitaetsRegel) => Promise<void>;
  deleteRegel: (r: QualitaetsRegel) => void;
}

export function buildRegelMutations(deps: RegelMutationDeps): RegelMutations {
  const { file, persist, run, onGespeichert, onGeloescht } = deps;
  const mitRegel = (r: QualitaetsRegel): SkillRegistryFile => ({ ...file, regeln: upsertRegel(file.regeln, r) });

  return {
    toggleAktiv: (r) => {
      void run(mitRegel({ ...r, aktiv: !r.aktiv, geaendert_am: new Date().toISOString() }));
    },
    saveRegel: (r) => {
      void run(mitRegel(r)).then(() => onGespeichert?.());
    },
    persistRegel: (r) => persist(mitRegel(r)),
    deleteRegel: (r) => {
      const used = skillsUsingRegel(file, r.id);
      const msg = used.length > 0
        ? `Regel „${r.name}" wird in ${used.length} Skill(s) verwendet: ${used.join(', ')}.\nWirklich löschen? Die Zuordnung wird dort entfernt.`
        : `Regel „${r.name}" wirklich löschen?`;
      if (!window.confirm(msg)) return;
      void run({
        ...file,
        regeln: file.regeln.filter(x => x.id !== r.id),
        skills: file.skills.map(s => ({ ...s, regelIds: s.regelIds.filter(id => id !== r.id) })),
        // Auch aus dem Standardsatz: eine gelöschte Regel, die dort stehen bliebe, wäre
        // eine ID, die auf nichts zeigt — `resolveRegeln` ließe sie still fallen, und
        // der nächste Kurator suchte den Grund im falschen Feld.
        ...(file.workflows
          ? { workflows: file.workflows.map(w => (
              w.standardRegelIds?.includes(r.id)
                ? { ...w, standardRegelIds: w.standardRegelIds.filter(id => id !== r.id) }
                : w
            )) }
          : {}),
      }).then(() => onGeloescht?.());
    },
  };
}
