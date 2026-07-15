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
  RISIKEN_SKILL_ID,
  buildKurzfassungPrompt,
  abschnittTemplate,
  B_ABSCHNITT_OPTS,
  B_ABSCHNITT_OPTS_UMFANG_ALT,
  C_ABSCHNITT_OPTS_ALT,
  C_ABSCHNITT_OPTS_NEU,
  C_ABSCHNITT_OPTS_NEU_UMFANG_ALT,
  MARKT_SKILL_ID,
  D_ABSCHNITT_OPTS,
  D_ABSCHNITT_OPTS_UMFANG_ALT,
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

/** ID des C-Umbaus „Technische Risiken" auf Entwurf → gefilterter Fließtext. */
export const GA_RISIKEN_ENTWURF_MIGRATION = 'ga-risiken-entwurf-2026-07';

/** ID der Umfang-Single-Source-Entkopplung für A + B (feste Zahl aus der Prompt-Prosa entfernt). */
export const GA_UMFANG_DEDUP_MIGRATION = 'ga-umfang-dedup-2026-07';

/** ID der Umfang-Single-Source-Entkopplung für C + D (Folgepaket; eigener Marker, append-only). */
export const GA_UMFANG_DEDUP_CD_MIGRATION = 'ga-umfang-dedup-cd-2026-07';

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

/**
 * C-Skill „Technische Risiken" (Abschnitt C): Umbau auf **Entwurf → gefilterter Fließtext**.
 * Trägt der Share-Stand EXAKT einen der zwei bekannten Alt-Stände (2-Abschnitt-Liste), wird er
 * auf den Neu-Stand gehoben (3-Abschnitt: Entwurf listet alle Risiken, Finaler Text ist
 * gefilterter Fließtext) — inkl. neuer regelIds (Wortanzahl weich, Aufzählungs-Guard) und
 * maxTokens 4096 (nur, wenn der Alt-Wert 2048 unverändert ist).
 *
 * ZWEI Alt-Stände: der Seed-Default trägt ein Stilbeispiel; der kuratierte Share-Snapshot
 * (`registry.live.json`, Reifegrad „entwurf") trägt KEINES. Beide gelten als pristine → beide
 * werden gehoben. Weicht das Template von BEIDEN ab (kuratiert editiert oder schon migriert),
 * bleibt der Skill UNBERÜHRT. Version wird nicht gesenkt (`Math.max(s.version, 2)`).
 */
function applyRisikenEntwurf(skills: SkillRecord[]): SkillRecord[] {
  const alteStaende = new Set([
    abschnittTemplate({ ...C_ABSCHNITT_OPTS_ALT }),
    abschnittTemplate({ ...C_ABSCHNITT_OPTS_ALT, stilbeispiel: undefined }),
  ]);
  const neuC = abschnittTemplate({ ...C_ABSCHNITT_OPTS_NEU });
  return skills.map(s => {
    if (s.id === RISIKEN_SKILL_ID && alteStaende.has(s.promptTemplate)) {
      return {
        ...s,
        promptTemplate: neuC,
        version: Math.max(s.version, 2),
        maxTokens: s.maxTokens === 2048 ? 4096 : s.maxTokens,
        regelIds: ['seed-c-umfang', 'seed-c-keine-aufzaehlungen', 'seed-passiv-stil'],
      };
    }
    return s;
  });
}

/**
 * Umfang single-source A + B: die feste Wort-/Satz-/Absatzzahl in der Prompt-Prosa wird
 * entfernt, sodass die zugeordnete Regel die EINZIGE numerische Quelle ist (der Auto-Block
 * `## Formale Vorgaben` leitete den Wert ohnehin aus der Regel ab — bei Regel-Edits lief die
 * Prosa auseinander und der Prompt trug den alten Wert weiter). Trägt ein A/B-Skill EXAKT
 * den Vor-Dedup-Wortlaut, wird sein `promptTemplate` auf die de-duplizierte Fassung gehoben.
 * Weicht der Text ab (kuratiert editiert oder schon migriert), bleibt der Skill UNBERÜHRT
 * (der Skill-Editor markiert einen verbliebenen Prosa↔Regel-Konflikt zusätzlich per Hinweis).
 * Version wird nicht gesenkt (`Math.max(s.version, 2)`, Parität zum Seed).
 */
function applyUmfangDedup(skills: SkillRecord[]): SkillRecord[] {
  const altA = buildKurzfassungPrompt(false, true); // Vor-Dedup-Wortlaut („ca. 10 Sätze")
  const neuA = buildKurzfassungPrompt(false); // de-dupliziert (Live-Seed)
  const altB = abschnittTemplate({ ...B_ABSCHNITT_OPTS_UMFANG_ALT });
  const neuB = abschnittTemplate({ ...B_ABSCHNITT_OPTS });
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

/**
 * Umfang single-source Folgepaket C + D (gleiche Logik wie `applyUmfangDedup`, eigener Marker).
 * C = Abschnitt „Technische Risiken" (Live-Stand `C_ABSCHNITT_OPTS_NEU`, gehoben durch
 * `applyRisikenEntwurf`); D = Abschnitt „Markt". Trägt der Skill EXAKT den Vor-Dedup-Wortlaut
 * mit fester „300–350 Wörter"-Prosa, wird er auf die de-duplizierte Fassung gehoben; kuratierte
 * Edits bleiben UNBERÜHRT. C-Regel `seed-c-umfang` ist ein weicher Hinweis, bleibt die Quelle.
 * Version wird nicht gesenkt (C `Math.max(v,2)`, D `Math.max(v,1)`, Parität zum Seed).
 */
function applyUmfangDedupCD(skills: SkillRecord[]): SkillRecord[] {
  const altC = abschnittTemplate({ ...C_ABSCHNITT_OPTS_NEU_UMFANG_ALT });
  const neuC = abschnittTemplate({ ...C_ABSCHNITT_OPTS_NEU });
  const altD = abschnittTemplate({ ...D_ABSCHNITT_OPTS_UMFANG_ALT });
  const neuD = abschnittTemplate({ ...D_ABSCHNITT_OPTS });
  return skills.map(s => {
    if (s.id === RISIKEN_SKILL_ID && s.promptTemplate === altC) {
      return { ...s, promptTemplate: neuC, version: Math.max(s.version, 2) };
    }
    if (s.id === MARKT_SKILL_ID && s.promptTemplate === altD) {
      return { ...s, promptTemplate: neuD, version: Math.max(s.version, 1) };
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
  { marker: AUFBEREITUNG_ZAHLEN_MAXTOKENS_MIGRATION, apply: applyZahlenMaxTokens },
  { marker: AUFBEREITUNG_STECKBRIEF_MAXTOKENS_MIGRATION, apply: applySteckbriefMaxTokens },
  { marker: GA_BELEG_KONTRAKT_REVERT_MIGRATION, apply: applyBelegKontraktRevert },
  { marker: GA_RISIKEN_ENTWURF_MIGRATION, apply: applyRisikenEntwurf },
  { marker: GA_UMFANG_DEDUP_MIGRATION, apply: applyUmfangDedup },
  { marker: GA_UMFANG_DEDUP_CD_MIGRATION, apply: applyUmfangDedupCD },
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
