/**
 * Einmalige, marker-gesicherte Registry-Migrationen für Bestands-Shares.
 *
 * Hintergrund: `mergeMissingSeeds` ergänzt nur FEHLENDE Seeds und überschreibt
 * bestehende Einträge NIE (schützt kuratierte Edits). Damit greift eine geänderte
 * Seed-Voreinstellung NICHT auf einem Share, dessen `registry.json` den Skill bereits
 * trägt. Diese Reconciliation holt solche Änderungen einmalig nach.
 *
 * Jede Migration hat einen **Marker** in `SkillRegistryFile.angewandteMigrationen`:
 * läuft GENAU EINMAL pro Share. Ist der Marker gesetzt, wird NICHTS mehr angefasst —
 * eine spätere bewusste Kurator-Änderung bleibt damit erhalten. Alle Migrationen sind
 * so gebaut, dass sie kuratierte Edits NIEMALS überschreiben (Wert-/Template-Gleichheit
 * gegen den bekannten Alt-Seed-Stand als Guard).
 */
import { ANFRAGE_ANONYMISIEREN_SKILL_ID } from './anfrage-anonymisieren.seed';
import {
  KURZFASSUNG_SKILL_ID,
  AUSGANGSLAGE_SKILL_ID,
  buildKurzfassungPrompt,
  abschnittTemplate,
  B_ABSCHNITT_OPTS,
} from './seed';
import type { SkillRecord, SkillRegistryFile } from './types';

/** ID der einmaligen Anonymisierer-Freischaltung (Recall-Gate bestanden 2026-07-03). */
export const ANFRAGE_ANON_AKTIV_MIGRATION = 'anfrage-anon-aktiv-2026-07';

/** ID des Beleg→Satz-Kontrakt-Rollouts für A + B (Journey-Paket 4, Eval-Gate akzeptiert). */
export const GA_BELEG_KONTRAKT_MIGRATION = 'ga-beleg-kontrakt-2026-07';

export interface ReconcileResult {
  file: SkillRegistryFile;
  /** True, wenn dieser Lauf etwas geändert hat und der Aufrufer zurückschreiben soll. */
  geaendert: boolean;
  /** Die Marker der in diesem Lauf angewandten Migrationen (für Audit/Anzeige). */
  angewandt: string[];
}

/** Anonymisierer-Skill `aktiv: false` → `true` (No-op, wenn bereits aktiv/abwesend). */
function applyAnonAktiv(skills: SkillRecord[]): SkillRecord[] {
  return skills.map(s =>
    s.id === ANFRAGE_ANONYMISIEREN_SKILL_ID && s.aktiv === false ? { ...s, aktiv: true } : s,
  );
}

/**
 * Beleg→Satz-Kontrakt für A + B nachziehen — ABER NUR, wenn der Share-Stand exakt
 * das Vor-Paket-4-Template trägt (`buildKurzfassungPrompt(false)` / `abschnittTemplate(
 * B_ABSCHNITT_OPTS)`). Weicht der Template-Text ab (= kuratiert editiert), bleibt der
 * Skill UNBERÜHRT. Version wird auf mind. 2 gehoben.
 */
function applyBelegKontrakt(skills: SkillRecord[]): SkillRecord[] {
  const altA = buildKurzfassungPrompt(false);
  const neuA = buildKurzfassungPrompt(true);
  const altB = abschnittTemplate({ ...B_ABSCHNITT_OPTS });
  const neuB = abschnittTemplate({ ...B_ABSCHNITT_OPTS, belegKontrakt: true });
  return skills.map(s => {
    if (s.id === KURZFASSUNG_SKILL_ID && s.promptTemplate === altA) {
      return { ...s, promptTemplate: neuA, version: Math.max(s.version, 2) };
    }
    if (s.id === AUSGANGSLAGE_SKILL_ID && s.promptTemplate === altB) {
      return { ...s, promptTemplate: neuB, version: Math.max(s.version, 2) };
    }
    return s;
  });
}

interface EinzelMigration {
  marker: string;
  apply: (skills: SkillRecord[]) => SkillRecord[];
}

/** Reihenfolge = Anwendungsreihenfolge; append-only (nie umsortieren/entfernen). */
const MIGRATIONEN: EinzelMigration[] = [
  { marker: ANFRAGE_ANON_AKTIV_MIGRATION, apply: applyAnonAktiv },
  { marker: GA_BELEG_KONTRAKT_MIGRATION, apply: applyBelegKontrakt },
];

/**
 * Wendet alle ausstehenden einmaligen Migrationen an. Pro Marker genau EINMAL: fehlt
 * er, wird die Migration angewandt UND der Marker gesetzt (auch wenn die Migration ein
 * No-op war — sonst liefe sie bei jedem Laden erneut und würde eine spätere bewusste
 * Kurator-Änderung wieder überschreiben).
 */
export function reconcileEinmaligeAktivierungen(file: SkillRegistryFile): ReconcileResult {
  const bereits = new Set(file.angewandteMigrationen ?? []);
  let skills = file.skills;
  const angewandt: string[] = [];
  for (const m of MIGRATIONEN) {
    if (bereits.has(m.marker)) continue;
    skills = m.apply(skills);
    angewandt.push(m.marker);
  }
  if (angewandt.length === 0) return { file, geaendert: false, angewandt: [] };
  return {
    file: { ...file, skills, angewandteMigrationen: [...(file.angewandteMigrationen ?? []), ...angewandt] },
    geaendert: true,
    angewandt,
  };
}
