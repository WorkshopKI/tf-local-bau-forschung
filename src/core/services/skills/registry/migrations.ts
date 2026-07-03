/**
 * Einmalige, marker-gesicherte Registry-Migrationen für Bestands-Shares.
 *
 * Hintergrund: `mergeMissingSeeds` ergänzt nur FEHLENDE Seeds und überschreibt
 * bestehende Einträge NIE (schützt kuratierte Edits). Damit greift eine geänderte
 * Seed-Voreinstellung (z.B. der nach dem Recall-Gate auf `aktiv: true` gesetzte
 * Anonymisierer) NICHT auf einem Share, dessen `registry.json` den Skill bereits
 * mit `aktiv: false` trägt. Diese Reconciliation holt das einmalig nach.
 *
 * Marker in `SkillRegistryFile.angewandteMigrationen`: läuft GENAU EINMAL pro
 * Share. Ist der Marker gesetzt, wird NICHTS mehr angefasst — eine spätere bewusste
 * Deaktivierung durch den Kurator bleibt damit erhalten (wird nicht re-aktiviert).
 */
import { ANFRAGE_ANONYMISIEREN_SKILL_ID } from './anfrage-anonymisieren.seed';
import type { SkillRegistryFile } from './types';

/** ID der einmaligen Anonymisierer-Freischaltung (Recall-Gate bestanden 2026-07-03). */
export const ANFRAGE_ANON_AKTIV_MIGRATION = 'anfrage-anon-aktiv-2026-07';

export interface ReconcileResult {
  file: SkillRegistryFile;
  /** True, wenn dieser Lauf etwas geändert hat und der Aufrufer zurückschreiben soll. */
  geaendert: boolean;
}

/**
 * Wendet ausstehende einmalige Migrationen an. Aktuell: Anonymisierer-Skill von
 * `aktiv: false` → `true` (nur wenn der Marker fehlt). Der Marker wird IMMER beim
 * ersten Lauf gesetzt (auch wenn der Skill bereits aktiv/abwesend ist), damit die
 * Migration danach nie wieder eine spätere Deaktivierung überschreibt.
 */
export function reconcileEinmaligeAktivierungen(file: SkillRegistryFile): ReconcileResult {
  const bereits = file.angewandteMigrationen ?? [];
  if (bereits.includes(ANFRAGE_ANON_AKTIV_MIGRATION)) return { file, geaendert: false };

  const skills = file.skills.map(s =>
    s.id === ANFRAGE_ANONYMISIEREN_SKILL_ID && s.aktiv === false ? { ...s, aktiv: true } : s,
  );
  return {
    file: { ...file, skills, angewandteMigrationen: [...bereits, ANFRAGE_ANON_AKTIV_MIGRATION] },
    geaendert: true,
  };
}
