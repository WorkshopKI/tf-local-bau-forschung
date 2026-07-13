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
import { AUFBEREITUNG_ZAHLEN_SKILL_ID } from './aufbereitung-zahlen.seed';
import { AUFBEREITUNG_STECKBRIEF_SKILL_ID } from './aufbereitung-steckbrief.seed';
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

/**
 * ID des Beleg→Satz-Kontrakt-Rollouts für A + B (Journey-Paket 4). NEUTRALISIERT
 * (2026-07): der Rollout ist jetzt ein No-op — siehe `GA_BELEG_KONTRAKT_REVERT_MIGRATION`.
 */
export const GA_BELEG_KONTRAKT_MIGRATION = 'ga-beleg-kontrakt-2026-07';

/** ID des Beleg→Satz-Kontrakt-Rückbaus für A + B (Reasoning-Loop, deterministischer Ersatz). */
export const GA_BELEG_KONTRAKT_REVERT_MIGRATION = 'ga-beleg-kontrakt-revert-2026-07';

/** ID der maxTokens-Anhebung des Zahlen-Inventar-Skills (2048 → 4096, Prod-Eval-Truncation). */
export const AUFBEREITUNG_ZAHLEN_MAXTOKENS_MIGRATION = 'aufbereitung-zahlen-maxtokens-2026-07';

/** ID der maxTokens-Anhebung des Steckbrief-Skills (2048 → 4096, Sonnet-Referenzlauf-Truncation). */
export const AUFBEREITUNG_STECKBRIEF_MAXTOKENS_MIGRATION = 'aufbereitung-steckbrief-maxtokens-2026-07';

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
 * NEUTRALISIERT (2026-07): der Beleg→Satz-Kontrakt wird NICHT mehr in A/B geschoben —
 * das interne Modell lief mit dem Kontrakt in einen langen Reasoning-Loop und lieferte
 * keine verwertbare Ausgabe mehr. Der Quellenbezug wird jetzt rein deterministisch aus
 * der Wortüberlappung abgeleitet (belegAbleitung.ts). Der Marker bleibt append-only im
 * Katalog (Audit); den Kontrakt auf Shares, die ihn bereits tragen, entfernt
 * `applyBelegKontraktRevert`. No-op statt Entfernen: auf frischen Shares muss der Marker
 * weiter gesetzt werden, damit der ursprüngliche Rollout nie nachträglich greift.
 */
function applyBelegKontrakt(skills: SkillRecord[]): SkillRecord[] {
  return skills;
}

/**
 * Beleg→Satz-Kontrakt-Rückbau: trägt ein A/B-Skill EXAKT das Kontrakt-Template
 * (`buildKurzfassungPrompt(true)` / `abschnittTemplate(..., belegKontrakt: true)`), wird
 * es auf den Vor-Paket-4-Stand zurückgesetzt (`false`-Variante). Weicht der Text ab
 * (= kuratiert editiert oder schon zurückgebaut), bleibt der Skill UNBERÜHRT. Version
 * wird nicht gesenkt (`Math.max(s.version, 2)`).
 */
function applyBelegKontraktRevert(skills: SkillRecord[]): SkillRecord[] {
  const altA = buildKurzfassungPrompt(false);
  const neuA = buildKurzfassungPrompt(true);
  const altB = abschnittTemplate({ ...B_ABSCHNITT_OPTS });
  const neuB = abschnittTemplate({ ...B_ABSCHNITT_OPTS, belegKontrakt: true });
  return skills.map(s => {
    if (s.id === KURZFASSUNG_SKILL_ID && s.promptTemplate === neuA) {
      return { ...s, promptTemplate: altA, version: Math.max(s.version, 2) };
    }
    if (s.id === AUSGANGSLAGE_SKILL_ID && s.promptTemplate === neuB) {
      return { ...s, promptTemplate: altB, version: Math.max(s.version, 2) };
    }
    return s;
  });
}

/**
 * Zahlen-Inventar-Skill von `maxTokens: 2048` → `4096` heben — ABER NUR, wenn der
 * Share-Stand exakt den Alt-Seed-Wert (2048) trägt. Ein Kurator, der den Wert bewusst
 * anders gesetzt hat, bleibt UNBERÜHRT. Hintergrund: der Prod-Eval zeigte den JSON-Teil
 * bei allen Fixtures am 2048er-Limit abgeschnitten (`abgeschnitten`-Diagnose) — das
 * größere Budget hebt den Recall. Version wird auf mind. 2 gehoben (Parität zum Seed).
 */
function applyZahlenMaxTokens(skills: SkillRecord[]): SkillRecord[] {
  return skills.map(s =>
    s.id === AUFBEREITUNG_ZAHLEN_SKILL_ID && s.maxTokens === 2048
      ? { ...s, maxTokens: 4096, version: Math.max(s.version, 2) }
      : s,
  );
}

/**
 * Steckbrief-Skill von `maxTokens: 2048` → `4096` heben — ABER NUR beim exakten
 * Alt-Seed-Wert (2048); bewusst gesetzte Kurator-Werte bleiben UNBERÜHRT.
 * Hintergrund: auf dem Streamlit-Bridge-Pfad ist `maxTokens` inert (Server-Budget),
 * auf dem DirectLLM-Pfad (Eval-OpenRouter-Modus) bindet es aber wirklich — der
 * Sonnet-Referenzlauf (2026-07-11) zeigte den Steckbrief 3/3 am 2048er-Limit
 * abgeschnitten (`parseSteckbrief` → degradiert). Version auf mind. 2 (Seed-Parität).
 */
function applySteckbriefMaxTokens(skills: SkillRecord[]): SkillRecord[] {
  return skills.map(s =>
    s.id === AUFBEREITUNG_STECKBRIEF_SKILL_ID && s.maxTokens === 2048
      ? { ...s, maxTokens: 4096, version: Math.max(s.version, 2) }
      : s,
  );
}

interface EinzelMigration {
  marker: string;
  apply: (skills: SkillRecord[]) => SkillRecord[];
}

/** Reihenfolge = Anwendungsreihenfolge; append-only (nie umsortieren/entfernen). */
const MIGRATIONEN: EinzelMigration[] = [
  { marker: ANFRAGE_ANON_AKTIV_MIGRATION, apply: applyAnonAktiv },
  { marker: GA_BELEG_KONTRAKT_MIGRATION, apply: applyBelegKontrakt },
  { marker: AUFBEREITUNG_ZAHLEN_MAXTOKENS_MIGRATION, apply: applyZahlenMaxTokens },
  { marker: AUFBEREITUNG_STECKBRIEF_MAXTOKENS_MIGRATION, apply: applySteckbriefMaxTokens },
  { marker: GA_BELEG_KONTRAKT_REVERT_MIGRATION, apply: applyBelegKontraktRevert },
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
