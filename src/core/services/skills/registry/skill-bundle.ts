/**
 * Export/Import einzelner Skills als portables Bündel (Skill + zugeordnete
 * Regeln). Bewusst rein und OHNE Antragsdaten — ein Bündel enthält ausschließlich
 * kuratierte Registry-Inhalte, nie generierten Text / VB / FKZ. Konfliktbehandlung
 * beim Import: ID-Kollision → Skill wird dupliziert (neue ID); Regeln werden
 * gemerged, ohne vorhandene IDs zu überschreiben.
 */
import { resolveRegeln } from './selectors';
import { normalizeRegistryFile } from './storage';
import type { QualitaetsRegel, SkillRecord, SkillRegistryFile } from './types';

export const SKILL_BUNDLE_KIND = 'teamflow-skill-bundle';

export interface SkillBundleJson {
  kind: typeof SKILL_BUNDLE_KIND;
  version: 1;
  /** Der Skill OHNE Versions-Historie (das Zielsystem startet frisch). */
  skill: SkillRecord;
  /** Die dem Skill zugeordneten Regeln (für die Merge-Übernahme). */
  regeln: QualitaetsRegel[];
}

export interface ImportSkillBundleResult {
  file: SkillRegistryFile;
  importedSkillId: string;
  /** True, wenn die Skill-ID kollidierte und das Bündel dupliziert wurde. */
  konflikt: boolean;
  /** Regel-IDs, die neu in die Bibliothek kamen (vorhandene bleiben unberührt). */
  ergaenzteRegeln: string[];
}

/**
 * Schnürt ein portables Bündel für genau einen Skill. `null`, wenn die ID nicht
 * existiert. Die Historie wird bewusst entfernt (verlustfrei fürs Zielsystem,
 * das beim Laden eine frische Baseline anlegt).
 */
export function exportSkillBundle(file: SkillRegistryFile, skillId: string): SkillBundleJson | null {
  const skill = file.skills.find(s => s.id === skillId);
  if (!skill) return null;
  const regeln = resolveRegeln(file, skill);
  const { historie: _drop, ...skillOhneHistorie } = skill;
  return { kind: SKILL_BUNDLE_KIND, version: 1, skill: skillOhneHistorie, regeln };
}

/**
 * Validiert + normalisiert rohes JSON zu einem Bündel (über die robuste Registry-
 * Normalisierung — fehlende Felder defaulten, unbekannte bleiben). `null` bei
 * falscher Struktur.
 */
export function parseSkillBundle(raw: unknown): SkillBundleJson | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const b = raw as Record<string, unknown>;
  if (b.kind !== SKILL_BUNDLE_KIND) return null;
  const probe = normalizeRegistryFile({
    version: 1,
    updated_at: '',
    skills: [b.skill],
    regeln: Array.isArray(b.regeln) ? b.regeln : [],
  });
  if (!probe || probe.skills.length !== 1) return null;
  return { kind: SKILL_BUNDLE_KIND, version: 1, skill: probe.skills[0]!, regeln: probe.regeln };
}

/**
 * Fügt ein Bündel in eine Registry ein. ID-Kollision → Skill wird mit neuer ID
 * (`opts.newId`) und „(importiert)"-Suffix dupliziert; Regeln werden additiv
 * gemerged (vorhandene IDs NICHT überschrieben). Rein — `newId` wird injiziert.
 */
export function importSkillBundle(
  file: SkillRegistryFile,
  bundle: SkillBundleJson,
  opts: { newId: () => string },
): ImportSkillBundleResult {
  const vorhandeneRegelIds = new Set(file.regeln.map(r => r.id));
  const neueRegeln = bundle.regeln.filter(r => !vorhandeneRegelIds.has(r.id));

  const konflikt = file.skills.some(s => s.id === bundle.skill.id);
  const importedSkillId = konflikt ? opts.newId() : bundle.skill.id;
  const importedSkill: SkillRecord = {
    ...bundle.skill,
    id: importedSkillId,
    name: konflikt ? `${bundle.skill.name} (importiert)` : bundle.skill.name,
  };

  return {
    file: {
      ...file,
      skills: [...file.skills, importedSkill],
      regeln: [...file.regeln, ...neueRegeln],
    },
    importedSkillId,
    konflikt,
    ergaenzteRegeln: neueRegeln.map(r => r.id),
  };
}
