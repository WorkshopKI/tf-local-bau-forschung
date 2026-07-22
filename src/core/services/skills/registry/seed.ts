/**
 * Sammelstelle der Skill-Registry: baut aus den einzelnen `*.seed.ts`-Dateien den
 * vollständigen Startbestand (`SEED_REGISTRY`) und die Workflow-Definitionen.
 *
 * Verwendung:
 *  - Read-only-Fallback, solange keine `registry.json` existiert
 *    (Nicht-Kuratoren / vor dem ersten Seed-on-open) — UI-Hinweis
 *    „Standard-Skill (noch nicht kuratiert)".
 *  - Startbestand, den ein Schreibberechtigter beim Öffnen der Skill-
 *    Verwaltung einmalig auf den Share persistiert (Seed-on-open).
 *
 * **Die Re-Exports unten sind Absicht, keine tote Brücke.** Diese Datei ist der
 * eingeführte Anlaufpunkt für die Gutachten-Seed-Konstanten; `migrations.ts`, das
 * Registry-Barrel und ein Dutzend Tests importieren von hier. Beim Aufteilen im
 * Konsolidierungs-Pass sind die Inhalte in eigene Dateien gezogen — die
 * Sammelstellen-Rolle bleibt, damit kein Konsument seinen Importpfad ändern muss.
 * Wer eine neue Seed-Datei anlegt, reicht sie hier durch.
 */
import type { SkillRegistryFile, WorkflowDef, WorkflowStep } from './types';
import { SEED_NF_SKILL, SEED_NF_REGELN, NF_DEF } from './nf-skill.seed';
import { GA_QS_REGELN } from './ga-qs.seed';
import { SEED_GA_LEKTOR_SKILL } from './ga-lektor.seed';
import { ANFRAGE_ANONYMISIEREN_SKILL } from './anfrage-anonymisieren.seed';
import { ANFRAGE_METADATEN_SKILL } from './anfrage-metadaten.seed';
import { AUFBEREITUNG_ASPEKTE_SKILL } from './aufbereitung-aspekte.seed';
import { AUFBEREITUNG_STECKBRIEF_SKILL } from './aufbereitung-steckbrief.seed';
import { AUFBEREITUNG_ZAHLEN_SKILL } from './aufbereitung-zahlen.seed';
import { AUFBEREITUNG_GLOSSAR_SKILL } from './aufbereitung-glossar.seed';
import { AUFBEREITUNG_VERWERTUNG_SKILL } from './aufbereitung-verwertung.seed';
import { AUFBEREITUNG_RECHERCHE_PROMPT_SKILL } from './aufbereitung-recherche-prompt.seed';
import { AUFBEREITUNG_RECHERCHE_IMPORT_SKILL } from './aufbereitung-recherche-import.seed';
import { SEED_SKILL, SEED_REGELN } from './gutachten-kurzfassung.seed';
import { SEED_SKILLS_BG, SEED_REGELN_BG } from './gutachten-bg.seed';
import { SEED_QS_SKILL } from './qs-basis.seed';
import { SEED_RELEVANZ_MAP_SKILL } from './relevanz-map.seed';

/* -------------------------------------------------------------------------- */
/* Durchgereichte Seed-Konstanten — Importpfad der Konsumenten bleibt `./seed`  */
/* -------------------------------------------------------------------------- */

export {
  SEED_SKILL, SEED_REGELN, KURZFASSUNG_SKILL_ID, INTERPUNKTION_REGEL_ID,
  buildKurzfassungPrompt,
} from './gutachten-kurzfassung.seed';
export {
  SEED_SKILLS_BG, SEED_REGELN_BG,
  AUSGANGSLAGE_SKILL_ID, RISIKEN_SKILL_ID, MARKT_SKILL_ID, KOMPETENZ_SKILL_ID,
  B_ABSCHNITT_OPTS, B_ABSCHNITT_OPTS_UMFANG_ALT,
  C_ABSCHNITT_OPTS_ALT, C_ABSCHNITT_OPTS_NEU, C_ABSCHNITT_OPTS_NEU_UMFANG_ALT,
  D_ABSCHNITT_OPTS, D_ABSCHNITT_OPTS_UMFANG_ALT,
  G_ABSCHNITT_OPTS, G_ABSCHNITT_OPTS_PFLICHT_ALT,
} from './gutachten-bg.seed';
export { SEED_QS_SKILL, QS_BASIS_SKILL_ID } from './qs-basis.seed';
export { SEED_RELEVANZ_MAP_SKILL, RELEVANZ_MAP_SKILL_ID } from './relevanz-map.seed';
export { abschnittTemplate } from './ga-seed-basis';

/** Fester Seed-Zeitstempel — deterministisch (kein `new Date()` zur Seed-Zeit). */
const SEED_TS = '2026-06-11T00:00:00.000Z';

/* -------------------------------------------------------------------------- */
/* Workflow-Definition „zim-ep" — geordnete Schritte A–G als kuratierbare Daten */
/* -------------------------------------------------------------------------- */

/** Baut einen ZIM-EP-Seed-Schritt (id == nr == kurz == ankerKey == Buchstabe). */
function epStep(id: string, label: string, skillId: string, retrievalQueries?: string[]): WorkflowStep {
  return {
    id, nr: id, kurz: id, label, skillId, ankerKey: id, gateExpr: 'immer',
    ...(retrievalQueries ? { retrievalQueries } : {}),
  };
}

/**
 * Seed-Workflow „zim-ep" — spiegelt die bisher hart verdrahtete `ZIM_EP_WORKFLOW`
 * (Reihenfolge / Skills / Anker; alle Gates `'immer'`, da A–G keine Gate-Funktion
 * trugen). Quelle der Wahrheit für die Laufzeit, solange keine kuratierte
 * `WorkflowDef` vorliegt. Ein Cross-Layer-Test (`gutachten/__tests__`) sichert die
 * Deckungsgleichheit mit `ZIM_EP_WORKFLOW` gegen Drift.
 */
export const ZIM_EP_DEF: WorkflowDef = {
  id: 'zim-ep',
  name: 'ZIM-EP-Gutachten',
  version: 1,
  steps: [
    epStep('A', 'Kurzfassung', 'gutachten-kurzfassung'),
    epStep('B', 'Hintergrund, Stand der Technik, Lösungsweg', 'gutachten-ausgangslage'),
    epStep('C', 'Technische Risiken', 'gutachten-risiken', ['technische Risiken Herausforderungen']),
    epStep('D', 'Markt', 'gutachten-markt', ['Markt Zielgruppen Stückpreis Wettbewerb']),
    epStep('E', 'Unternehmensgegenstand', 'gutachten-unternehmen'),
    epStep('F', 'Ergebnisverwertung', 'gutachten-verwertung', ['Verwertung Umsatz Markteinführung']),
    epStep('G', 'Technologiekompetenz', 'gutachten-kompetenz'),
  ],
};

export const SEED_WORKFLOWS: WorkflowDef[] = [ZIM_EP_DEF, NF_DEF];

/** Vollständiger Seed-Registry-Stand (Startbestand / Read-only-Fallback). */
export const SEED_REGISTRY: SkillRegistryFile = {
  version: 1,
  updated_at: SEED_TS,
  skills: [
    SEED_SKILL, ...SEED_SKILLS_BG, SEED_QS_SKILL, SEED_RELEVANZ_MAP_SKILL, SEED_GA_LEKTOR_SKILL,
    SEED_NF_SKILL,
    ANFRAGE_ANONYMISIEREN_SKILL, ANFRAGE_METADATEN_SKILL,
    AUFBEREITUNG_ASPEKTE_SKILL, AUFBEREITUNG_STECKBRIEF_SKILL, AUFBEREITUNG_ZAHLEN_SKILL,
    AUFBEREITUNG_GLOSSAR_SKILL, AUFBEREITUNG_VERWERTUNG_SKILL,
    AUFBEREITUNG_RECHERCHE_PROMPT_SKILL, AUFBEREITUNG_RECHERCHE_IMPORT_SKILL,
  ],
  regeln: [...SEED_REGELN, ...SEED_REGELN_BG, ...SEED_NF_REGELN, ...GA_QS_REGELN],
  workflows: SEED_WORKFLOWS,
};
