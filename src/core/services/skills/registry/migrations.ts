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
import {
  ANFRAGE_ANONYMISIEREN_SKILL_ID,
  ANFRAGE_ANONYMISIEREN_SKILL,
  ANON_SYSTEM_PROMPT_ALT,
  ANON_PROMPT_TEMPLATE_ALT,
} from './anfrage-anonymisieren.seed';
import { AUFBEREITUNG_ZAHLEN_SKILL_ID } from './aufbereitung-zahlen.seed';
import { AUFBEREITUNG_STECKBRIEF_SKILL_ID } from './aufbereitung-steckbrief.seed';
import {
  AUFBEREITUNG_RECHERCHE_PROMPT_SKILL,
  AUFBEREITUNG_RECHERCHE_PROMPT_SKILL_ID,
  RECHERCHE_PROMPT_SYSTEM_ALT,
  RECHERCHE_PROMPT_TEMPLATE_ALT,
} from './aufbereitung-recherche-prompt.seed';
import {
  KURZFASSUNG_SKILL_ID,
  AUSGANGSLAGE_SKILL_ID,
  RISIKEN_SKILL_ID,
  SEED_SKILL,
  SEED_SKILLS_BG,
  A_AUFGABE_ZEILE,
  A_AUFGABE_ZEILE_UMFANG_ALT,
  A_MODIFIERS_UMFANG_ALT,
  A_ZEICHEN_MAX,
  A_ZEICHEN_MAX_ALT,
  A_ZEICHEN_HERKUNFT,
  A_BESCHREIBUNG,
  A_BESCHREIBUNG_ALT,
  mitVeroeffentlichungsKontrakt,
  C_ABSCHNITT_OPTS_FUENF,
  UNTERNEHMEN_SKILL_ID,
  VERWERTUNG_SKILL_ID,
  buildKurzfassungPrompt,
  abschnittTemplate,
  B_ABSCHNITT_OPTS,
  B_ABSCHNITT_OPTS_TEILE_ABSOLUT,
  B_ABSCHNITT_OPTS_UMFANG_ALT,
  C_ABSCHNITT_OPTS_ALT,
  C_ABSCHNITT_OPTS,
  C_ABSCHNITT_OPTS_NEU,
  C_ABSCHNITT_OPTS_NEU_UMFANG_ALT,
  MARKT_SKILL_ID,
  D_ABSCHNITT_OPTS,
  D_ABSCHNITT_OPTS_UMFANG_ALT,
  KOMPETENZ_SKILL_ID,
  G_ABSCHNITT_OPTS,
  G_ABSCHNITT_OPTS_PFLICHT_ALT,
  INTERPUNKTION_REGEL_ID,
  UEBERSCHRIFTEN_REGEL_ID,
  GA_STANDARD_REGEL_IDS,
  ZIM_EP_DEF,
  QS_BASIS_SKILL_ID,
  SEED_QS_SKILL,
  QS_NAME_ALT,
  QS_BESCHREIBUNG_ALT,
} from './seed';
import {
  GA_LEKTOR_SKILL_ID,
  GA_LEKTOR_PROMPT_TEMPLATE_ALT,
  SEED_GA_LEKTOR_SKILL,
} from './ga-lektor.seed';
import type {
  QualitaetsRegel, SkillRecord, SkillRegistryFile, SkillVorgaben, VorgabeKey,
} from './types';

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

/** ID der Pflicht-Anfang-Entschärfung in G (zitierte „…"-Inline-Regel → eigener Block). */
export const GA_PFLICHT_ANFANG_KLAR_MIGRATION = 'ga-pflicht-anfang-klar-2026-07';

/** ID der Anonymisierer-Prompt-Klärung (Zielkonflikt, WÖRTLICH-Scope, Echtwerte in der Schablone). */
export const ANFRAGE_ANON_KLAR_MIGRATION = 'anfrage-anon-klar-2026-07';

/** ID der Überführung der Ein-Skill-Umfangsregeln in `SkillRecord.vorgaben`. */
export const SKILL_VORGABEN_MIGRATION = 'skill-vorgaben-2026-07';

/** ID der Interpunktions-Vorgabe (Regel an A–G binden + Lektor-Pflichtblock). */
export const GA_INTERPUNKTION_MIGRATION = 'ga-interpunktion-2026-07';

/** ID des Umbaus „Deep-Research-Auftrag" → Stichworte + feste Vorlage im Code. */
export const AUFBEREITUNG_DR_STICHWORTE_MIGRATION = 'aufbereitung-dr-stichworte-2026-07';

/** ID der Entfernung der strukturierten Ausgabe (`teilStruktur`) aus den Gutachten-Skills. */
export const GA_TEILSTRUKTUR_ENTFERNEN_MIGRATION = 'ga-teilstruktur-entfernen-2026-08';

/** ID der Anhebung des C-Risiko-Deckels von drei auf fünf (Messlauf 08/2026, Befund 3). */
export const GA_C_FUENF_RISIKEN_MIGRATION = 'ga-c-fuenf-risiken-2026-08';

/** ID der Satzzahl-Vereinheitlichung in A auf 9–11 (Messlauf 08/2026, Befund 4). */
export const GA_A_UMFANG_KURATIERT_MIGRATION = 'ga-a-umfang-kuratiert-2026-08';

/** ID der erstmaligen Umfangs-/Form-Vorgaben für E + F (Messlauf 08/2026, Befund 5). */
export const GA_EF_VORGABEN_MIGRATION = 'ga-ef-vorgaben-2026-08';

/** ID der Auto-Retry-Freischaltung der ZIM-EP-Schritte (Messlauf 08/2026, Befund 2). */
export const GA_EP_AUTO_RETRY_MIGRATION = 'ga-ep-auto-retry-2026-08';

/** ID der Anhebung des A-Zeichenlimits auf 1.100 samt Herkunfts-Angabe. */
export const GA_A_ZEICHEN_HERKUNFT_MIGRATION = 'ga-a-zeichen-herkunft-2026-08';

/** ID der Bindung des fachlichen Prüfers an das GA-Artefakt (stillgelegt bis zur Abnahme). */
export const GA_FACHPRUEFER_MIGRATION = 'ga-fachpruefer-2026-08';

/** ID des Veröffentlichungs-Kontrakts von A (Zweck, Weglass-Liste, Länge, Ausgabeformat). */
export const GA_A_VEROEFFENTLICHUNG_MIGRATION = 'ga-a-veroeffentlichung-2026-08';

/** ID der Umstellung der B-Teil-Richtwerte von fester Wortzahl auf Anteil am Gesamtumfang. */
export const GA_B_TEIL_ANTEILE_MIGRATION = 'ga-b-teil-anteile-2026-08';

/** ID der eigenen Tiefenangabe für den finalen Text von C. */
export const GA_C_FINAL_UMFANG_MIGRATION = 'ga-c-final-umfang-2026-08';

/** ID der Durchsetzung der B-/C-Wortanzahl (`hinweis` → `fehler`, aktiviert den Auto-Retry). */
export const GA_BC_UMFANG_DURCHSETZEN_MIGRATION = 'ga-bc-umfang-durchsetzen-2026-08';

/** ID der Bindung der „keine Überschriften im Fließtext"-Regel an A–G. */
export const GA_UEBERSCHRIFTEN_MIGRATION = 'ga-keine-ueberschriften-2026-08';

/** ID des Standardsatz-Umzugs (vier Form-Regeln vom Abschnitt an den Workflow). */
export const GA_STANDARDSATZ_MIGRATION = 'ga-standardsatz-2026-08';

/** ID der Freischaltung des fachlichen Prüfers (`aktiv: false` → `true`). */
export const GA_PRUEFER_AKTIV_MIGRATION = 'ga-pruefer-aktiv-2026-08';

/** ID des Nachzugs der Umfangs-Vorgabe von Abschnitt D (300–350, nie auf dem Share angekommen). */
export const GA_D_UMFANG_MIGRATION = 'ga-d-umfang-2026-08';

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
  // Gegen den EINGEFRORENEN Zwischenstand, nicht gegen den Live-Seed: `B_ABSCHNITT_OPTS`
  // ist seit `applyBTeilAnteile` weitergezogen, dieser Rückbau zielt aber auf den Stand,
  // der damals live war. Ein mitwanderndes Ziel träfe keinen Bestands-Share mehr.
  const altB = abschnittTemplate({ ...B_ABSCHNITT_OPTS_TEILE_ABSOLUT });
  const neuB = abschnittTemplate({ ...B_ABSCHNITT_OPTS_TEILE_ABSOLUT, belegKontrakt: true });
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
  // Ziel ist der Stand DIESER Migration (Total-Zahl raus, Teil-Richtwerte noch absolut) —
  // die Anteils-Fassung hebt danach `applyBTeilAnteile`. Jede Migration schreibt genau
  // den Stand, für den sie geschrieben wurde; die Kette bleibt so nachvollziehbar.
  const neuB = abschnittTemplate({ ...B_ABSCHNITT_OPTS_TEILE_ABSOLUT });
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

/**
 * Abschnitt G: der Pflicht-Anfang stand als zitierte Inline-Regel im Prompt —
 * eine zitierte Inline-Regel, die den Wortlaut EXAKT verlangte und ihn zugleich
 * abgeschnitten zeigte. Diese Anweisung ist nicht erfüllbar: der Wortlaut endet mitten
 * im Satz, und sein Ende wird zusätzlich von einem Auslassungszeichen innerhalb der
 * Anführungszeichen verdeckt. Qwen suchte darauf im Reasoning wiederholt die
 * String-Grenze, degenerierte in Wiederholung und verbrauchte das Ausgabebudget — der
 * Lauf brach ohne Antwort ab (zweiter Fall dieser Klasse nach
 * `GA_BELEG_KONTRAKT_REVERT_MIGRATION`).
 *
 * Neu steht der Wortlaut in einem eigenen, zeilenbegrenzten `## Pflicht-Anfang`-Block
 * mit dem expliziten Hinweis, dass er absichtlich mitten im Satz endet.
 *
 * ZWEI Alt-Stände wie bei `applyRisikenEntwurf`: Seed-Default mit Stilbeispiel, kuratierter
 * Share-Snapshot ohne. Beide gelten als pristine. Weicht das Template von BEIDEN ab
 * (kuratiert editiert oder schon migriert), bleibt der Skill UNBERÜHRT.
 */
function applyPflichtAnfangKlar(skills: SkillRecord[]): SkillRecord[] {
  const alteStaende = new Set([
    abschnittTemplate({ ...G_ABSCHNITT_OPTS_PFLICHT_ALT }),
    abschnittTemplate({ ...G_ABSCHNITT_OPTS_PFLICHT_ALT, stilbeispiel: undefined }),
  ]);
  const neuG = abschnittTemplate({ ...G_ABSCHNITT_OPTS });
  return skills.map(s =>
    s.id === KOMPETENZ_SKILL_ID && alteStaende.has(s.promptTemplate)
      ? { ...s, promptTemplate: neuG, version: Math.max(s.version, 2) }
      : s);
}

/**
 * Anonymisierer: drei Prompt-Defekte aus dem Audit 2026-07 (Zielkonflikt „AGGRESSIV"
 * vs. „fachlicher Sinn" ohne Vorrang; pauschale WÖRTLICH-Pflicht auch für die frei
 * formulierte Stufe-B-Passage; Feld-Schablone mit vollplausiblen Echtwerten, deren Echo
 * über die Wiedereinsetzung einen Phantom-Namen in den finalen Text schreibt).
 *
 * Pristine-Guard über BEIDE Textfelder: nur wenn System-Prompt UND Template exakt dem
 * eingefrorenen v2-Stand entsprechen, wird gehoben. Ein kuratierter Edit an auch nur
 * einem der beiden lässt den Skill unberührt. `aktiv` wird NICHT angefasst — die
 * Freischaltung bleibt die Entscheidung aus `applyAnonAktiv`.
 */
function applyAnonKlar(skills: SkillRecord[]): SkillRecord[] {
  return skills.map(s =>
    s.id === ANFRAGE_ANONYMISIEREN_SKILL_ID
      && s.systemPrompt === ANON_SYSTEM_PROMPT_ALT
      && s.promptTemplate === ANON_PROMPT_TEMPLATE_ALT
      ? {
        ...s,
        systemPrompt: ANFRAGE_ANONYMISIEREN_SKILL.systemPrompt,
        promptTemplate: ANFRAGE_ANONYMISIEREN_SKILL.promptTemplate,
        version: Math.max(s.version, 3),
      }
      : s);
}

/**
 * Interpunktions-Vorgabe (v2.297): die geteilte Bibliotheks-Regel „Semikolon &
 * Gedankenstrich" an JEDEN generativen Gutachten-Schritt binden und den Lektor auf
 * die Fassung heben, die diese Zeichen ausdrücklich auflöst.
 *
 * Der Regel-RECORD selbst kommt schon über `mergeMissingSeeds` auf den Share
 * (fehlende ID wird additiv ergänzt, und `loadSkillRegistry` merged, bevor dieser
 * Reconcile läuft). Was der Merge NICHT kann, ist die Zuordnung an bestehende
 * Skills — genau das macht diese Migration.
 *
 * Zwei Schutzregeln:
 *  1. Die Zuordnung ist rein additiv (ID anhängen, wenn sie fehlt) und überschreibt
 *     damit keine kuratierte Regelliste. Wer die Regel später bewusst entfernt,
 *     behält das: der Marker verhindert einen zweiten Lauf.
 *  2. Das Lektor-Template wird NUR ersetzt, wenn es exakt dem eingefrorenen v1-Stand
 *     entspricht. Jeder kuratierte Edit bleibt unberührt.
 *
 * Die Schritt-Liste kommt aus `ZIM_EP_DEF` statt aus sieben Literalen — der Workflow
 * ist die Quelle dafür, welche Skills Gutachten-Fließtext erzeugen.
 */
function applyInterpunktion(skills: SkillRecord[]): SkillRecord[] {
  const gaSkillIds = new Set(ZIM_EP_DEF.steps.map(s => s.skillId));
  return skills.map(s => {
    if (gaSkillIds.has(s.id) && !s.regelIds.includes(INTERPUNKTION_REGEL_ID)) {
      return { ...s, regelIds: [...s.regelIds, INTERPUNKTION_REGEL_ID] };
    }
    if (s.id === GA_LEKTOR_SKILL_ID && s.promptTemplate === GA_LEKTOR_PROMPT_TEMPLATE_ALT) {
      return {
        ...s,
        promptTemplate: SEED_GA_LEKTOR_SKILL.promptTemplate,
        beschreibung: SEED_GA_LEKTOR_SKILL.beschreibung,
        version: Math.max(s.version, 2),
      };
    }
    return s;
  });
}

/**
 * Deep-Research-Baustein: der Skill formuliert nicht mehr den ganzen Auftrag, sondern
 * liefert nur noch die STICHWORTE des Themengebiets — den Auftragstext baut seit v2.300
 * eine feste Vorlage im Code (`aufbereitung/recherche-auftrag.ts`).
 *
 * Hintergrund: der frei formulierte Auftrag trug die Antworten des Antrags in sich
 * (identifizierte Lücken, Marktzahlen, Wettbewerber, Zielkennwerte). Der externe Dienst
 * bestätigte damit den Antrag, statt unabhängig zu recherchieren — und substanzieller
 * Antragsinhalt verließ mit dem Kopieren den geschützten Bereich.
 *
 * Pristine-Guard über BEIDE Textfelder (Muster `applyAnonKlar`): nur wenn System-Prompt
 * UND Template exakt dem eingefrorenen v1-Stand entsprechen, wird gehoben. `maxTokens`
 * wird nur vom Alt-Seed-Wert (2048) auf 512 gesenkt; ein bewusst gesetzter Kurator-Wert
 * bleibt. `aktiv` bleibt unangetastet (dev läuft über den Runtime-Override).
 */
function applyDrStichworte(skills: SkillRecord[]): SkillRecord[] {
  const neu = AUFBEREITUNG_RECHERCHE_PROMPT_SKILL;
  return skills.map(s =>
    s.id === AUFBEREITUNG_RECHERCHE_PROMPT_SKILL_ID
      && s.systemPrompt === RECHERCHE_PROMPT_SYSTEM_ALT
      && s.promptTemplate === RECHERCHE_PROMPT_TEMPLATE_ALT
      ? {
        ...s,
        systemPrompt: neu.systemPrompt,
        promptTemplate: neu.promptTemplate,
        name: neu.name,
        beschreibung: neu.beschreibung,
        maxTokens: s.maxTokens === 2048 ? neu.maxTokens : s.maxTokens,
        version: Math.max(s.version, 2),
      }
      : s);
}

/* -------------------------------------------------------------------------- */
/* Ein-Skill-Umfangsregeln → `SkillRecord.vorgaben`                            */
/* -------------------------------------------------------------------------- */

/** Regel-`typ` → Vorgabe-Schlüssel. Nur diese Typen wandern an den Skill. */
const TYP_ZU_VORGABE: Record<string, VorgabeKey> = {
  wortanzahl: 'wortanzahl',
  satzanzahl: 'satzanzahl',
  zeichen_max: 'zeichenMax',
  absatz_min: 'absatzMin',
  satzlaenge_max: 'satzlaengeMax',
  keine_aufzaehlungen: 'keineAufzaehlungen',
  pflicht_anfang: 'pflichtAnfang',
};

function zahl(p: Record<string, unknown>, k: string): number | undefined {
  return typeof p[k] === 'number' && Number.isFinite(p[k]) ? (p[k] as number) : undefined;
}

/**
 * Baut aus einem Regel-Record den zugehörigen Vorgabe-Eintrag. `null`, wenn die
 * Regel keine verwertbaren Werte trägt (dann bleibt sie unangetastet in der
 * Bibliothek, statt als leere Vorgabe zu verschwinden).
 */
function regelZuVorgabe(r: QualitaetsRegel): { key: VorgabeKey; wert: SkillVorgaben[VorgabeKey] } | null {
  const key = TYP_ZU_VORGABE[r.typ];
  if (!key) return null;
  const basis = { schweregrad: r.schweregrad };
  const p = r.params;
  switch (key) {
    case 'wortanzahl':
    case 'satzanzahl': {
      const min = zahl(p, 'min');
      const max = zahl(p, 'max');
      if (min === undefined && max === undefined) return null;
      return { key, wert: { ...basis, ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) } };
    }
    case 'zeichenMax': {
      const max = zahl(p, 'max');
      return max === undefined ? null : { key, wert: { ...basis, max } };
    }
    case 'absatzMin': {
      const min = zahl(p, 'min');
      return min === undefined ? null : { key, wert: { ...basis, min } };
    }
    case 'satzlaengeMax': {
      const maxWoerter = zahl(p, 'maxWoerter');
      return maxWoerter === undefined ? null : { key, wert: { ...basis, maxWoerter } };
    }
    case 'keineAufzaehlungen':
      return { key, wert: basis };
    case 'pflichtAnfang': {
      const text = typeof p.text === 'string' ? p.text.trim() : '';
      return text === '' ? null : { key, wert: { ...basis, text } };
    }
    default:
      return null;
  }
}

/**
 * Überführt die Ein-Skill-Umfangs-/Form-Regeln in `SkillRecord.vorgaben` und räumt
 * die dadurch (oder schon vorher) unreferenzierten Regel-Records weg.
 *
 * Hintergrund: ein Regel-Record trug zwei Ebenen zugleich — die Art der Prüfung UND
 * den nur für einen Skill gültigen Wert. Die Bibliothek wuchs dadurch auf Duplikate
 * (4× „Keine Aufzählungen", 3× Satzanzahl, 4× Wortanzahl) und Waisen früherer
 * Seed-Stände zu. Seit v2.296 gehört der Wert an den Skill.
 *
 * Drei Schutzregeln, damit kuratierte Entscheidungen erhalten bleiben:
 *  1. Eine Regel, die MEHRERE Skills referenzieren, bleibt Bibliotheks-Regel (der
 *     Kurator hat sie bewusst geteilt).
 *  2. Eine INAKTIVE Regel wird nicht überführt — sie wirkte weder im Prompt noch im
 *     Check; ihre Zuordnung bleibt unverändert bestehen (geparkt).
 *  3. Ein Skill, der die Vorgabe bereits trägt, wird nicht überschrieben.
 * Gelöscht werden nur Regel-Records der migrierenden Typen, die danach KEIN Skill
 * mehr referenziert. QS-/NF-Regeln haben keinen dieser Typen und sind unberührt.
 */
function applySkillVorgaben(file: SkillRegistryFile): SkillRegistryFile {
  const byId = new Map(file.regeln.map(r => [r.id, r]));
  const nutzerAnzahl = new Map<string, number>();
  for (const s of file.skills) {
    for (const id of new Set(s.regelIds)) nutzerAnzahl.set(id, (nutzerAnzahl.get(id) ?? 0) + 1);
  }

  const skills = file.skills.map(s => {
    const vorgaben: SkillVorgaben = { ...(s.vorgaben ?? {}) };
    const bleibende: string[] = [];
    let geaendert = false;
    for (const id of s.regelIds) {
      const r = byId.get(id);
      if (!r || !r.aktiv || (nutzerAnzahl.get(id) ?? 0) > 1) { bleibende.push(id); continue; }
      const treffer = regelZuVorgabe(r);
      if (!treffer || vorgaben[treffer.key]) { bleibende.push(id); continue; }
      (vorgaben[treffer.key] as unknown) = treffer.wert;
      geaendert = true;
    }
    return geaendert ? { ...s, regelIds: bleibende, vorgaben } : s;
  });

  // Aufräumen: Regel-Records der migrierenden Typen ohne jeden Nutzer entfernen.
  const nochReferenziert = new Set(skills.flatMap(s => s.regelIds));
  const regeln = file.regeln.filter(r => !TYP_ZU_VORGABE[r.typ] || nochReferenziert.has(r.id));
  return { ...file, skills, regeln };
}

/**
 * Entfernt `teilStruktur`/`teilJoin` aus den Gutachten-Skills (A–G).
 *
 * Die strukturierte Ausgabe hängte einen autoritativen Block an den Prompt („Diese
 * Vorgabe hat Vorrang … NUR diese Schlüssel, in dieser Reihenfolge"). Sie hat sich
 * doppelt überlebt:
 *
 *  1. **Wirkungslos.** Seit v2.335 hängt an JEDER Generierung automatisch der
 *     sprachliche Feinschliff, und `applyLektorat` verwirft `teile` (der Lektor
 *     schreibt den flachen Text neu, die Teilfelder würden divergieren). Die
 *     erzwungene JSON-Ausgabe wird im Normalfall also immer weggeworfen — sie kostet
 *     nur Prompt-Komplexität und Ausgabe-Budget.
 *  2. **Widersprüchlich.** Die Schlüssel-Reihenfolge stammt aus dem Seed. Ordnet ein
 *     Kurator die Teile im Prompt-Text um (was er darf und soll), widerspricht der
 *     angehängte Block dem Template — und beansprucht dabei Vorrang. `teilStruktur`
 *     ist im Skill-Editor weder sichtbar noch editierbar, der Kurator kann von dem
 *     Konflikt also gar nichts wissen.
 *
 * Bewusst NICHT pristine-only: die beiden Felder sind nicht kurator-editierbar, es
 * geht durch das Entfernen also keine kuratierte Arbeit verloren. Der `teilStruktur`-
 * MECHANISMUS bleibt bestehen (`composeSkillPrompt`, Parser) — nur die GA-Skills geben
 * ihn ab. Der Skill-Text bleibt unberührt; die Version wird nicht angefasst.
 */
function applyTeilStrukturEntfernen(skills: SkillRecord[]): SkillRecord[] {
  const gaSkillIds = new Set(ZIM_EP_DEF.steps.map(s => s.skillId));
  return skills.map(s => {
    if (!gaSkillIds.has(s.id) || (!s.teilStruktur && !s.teilJoin)) return s;
    const { teilStruktur: _ts, teilJoin: _tj, ...rest } = s;
    return rest;
  });
}

/**
 * Abschnitt C: Risiko-Deckel drei → fünf (Messlauf 08/2026, Befund 3). Der Prompt
 * deckelte auf höchstens drei Risiken, die Wortzahl-Vorgabe verlangte 300–350 Wörter
 * — unerfüllbar, und ALLE vier gemessenen Modelle unterschritten. Begründung am
 * Live-Seed `C_ABSCHNITT_OPTS_FUENF`.
 *
 * Pristine-Guard wie üblich: nur ein C, dessen Template byte-genau dem
 * Drei-Risiken-Stand entspricht, wird gehoben; ein kuratierter Edit bleibt unberührt.
 */
function applyCFuenfRisiken(skills: SkillRecord[]): SkillRecord[] {
  const altC = abschnittTemplate({ ...C_ABSCHNITT_OPTS_NEU });
  const neuC = abschnittTemplate({ ...C_ABSCHNITT_OPTS_FUENF });
  return skills.map(s =>
    s.id === RISIKEN_SKILL_ID && s.promptTemplate === altC
      ? { ...s, promptTemplate: neuC, version: Math.max(s.version, 3) }
      : s);
}

/**
 * Abschnitt A: die Satzzahl stand an DREI Stellen und an zweien falsch (Messlauf
 * 08/2026, Befund 4). Die Prompt-Prosa sagte „ca. 10 Sätze (Toleranz 8–12)", die
 * Vorgabe des Teams 9–11, die Modifier-Richtwerte 8 und 12. Haiku lieferte 8 Sätze —
 * nach dem Prompt-Text korrekt, nach der Regel ein Hinweis.
 *
 * **Die Ausnahme von der Regel „ganzes Template vergleichen":** A ist der einzige
 * Gutachten-Skill, dessen Prompt auf dem Share kuratiert ist (823 statt 1.609 Zeichen
 * — eigene Struktur, ohne Ausgabeformat-Block). Ein Voll-Template-Guard könnte dort
 * nie greifen; genau deshalb trägt A die Dopplung, die `applyUmfangDedup` beseitigen
 * sollte, bis heute. Statt den kuratierten Text zu ersetzen, tauscht diese Migration
 * ausschließlich die eine Zeile aus, die nachweislich falsch ist, und lässt alles
 * andere stehen.
 *
 * Drei unabhängig geschützte Teile — jeder greift nur, wenn SEIN Stand unberührt ist:
 *  1. die Aufgaben-Zeile (nur bei exaktem Vorkommen des Alt-Wortlauts),
 *  2. die Modifier `kuerzer`/`laenger` (nur bei byte-gleichem Alt-Stand),
 *  3. die `satzanzahl`-Vorgabe (nur beim reinen Seed-Wert 8–12; der kuratierte
 *     Share führt längst 9–11 und wird nicht angefasst).
 */
function applyAUmfangKuratiert(skills: SkillRecord[]): SkillRecord[] {
  return skills.map(s => {
    if (s.id !== KURZFASSUNG_SKILL_ID) return s;
    let next = s;
    if (next.promptTemplate.includes(A_AUFGABE_ZEILE_UMFANG_ALT)) {
      next = { ...next, promptTemplate: next.promptTemplate.split(A_AUFGABE_ZEILE_UMFANG_ALT).join(A_AUFGABE_ZEILE) };
    }
    if (next.modifiers?.kuerzer === A_MODIFIERS_UMFANG_ALT.kuerzer
      && next.modifiers.laenger === A_MODIFIERS_UMFANG_ALT.laenger) {
      next = { ...next, modifiers: { ...next.modifiers, ...SEED_SKILL.modifiers } };
    }
    const satz = next.vorgaben?.satzanzahl;
    if (satz && satz.min === 8 && satz.max === 12 && satz.schweregrad === 'fehler') {
      next = { ...next, vorgaben: { ...next.vorgaben, satzanzahl: { ...satz, min: 9, max: 11 } } };
    }
    return next === s ? s : { ...next, version: Math.max(next.version, 3) };
  });
}

/**
 * Abschnitte E + F bekommen erstmals eigene Umfangs-/Form-Vorgaben (Messlauf 08/2026,
 * Befund 5): bis dahin prüfte an beiden NUR die Interpunktions-Regel — je ein Check
 * gegen sechs an A. Werte und Begründung stehen am Seed (`SEED_VORGABEN_E`/`_F`).
 *
 * Doppelter Pristine-Guard: der Skill darf noch KEINE `vorgaben` tragen (sonst hat
 * ein Kurator dort bereits entschieden) UND sein Template muss dem Seed entsprechen
 * (sonst ist der Abschnitt inhaltlich ein anderer, und ein Wort-Boden wäre geraten).
 */
function applyEfVorgaben(skills: SkillRecord[]): SkillRecord[] {
  const efIds = new Set([UNTERNEHMEN_SKILL_ID, VERWERTUNG_SKILL_ID]);
  const seed = new Map(SEED_SKILLS_BG.map(s => [s.id, s]));
  return skills.map(s => {
    const vorbild = seed.get(s.id);
    if (!vorbild || !efIds.has(s.id)) return s;
    if (s.vorgaben || s.promptTemplate !== vorbild.promptTemplate) return s;
    return { ...s, vorgaben: vorbild.vorgaben, version: Math.max(s.version, 2) };
  });
}

/**
 * Das Zeichenlimit von A steigt auf 1.100 und bekommt seinen Grund daneben.
 *
 * Es ist die einzige Vorgabe der Kette, die aus der Aussenwelt kommt: die Kurzfassung
 * wird in ein fremdes Formularfeld kopiert, das 1.200 Zeichen fasst. Das stand nirgends
 * — und weil es nirgends stand, war am Prompt nicht zu erkennen, dass dieser Wert hart
 * ist und die danebenstehende Satzzahl weich (v2.372).
 *
 * Zwei unabhängig geschützte Teile, wie in `applyAUmfangKuratiert` — A ist der eine
 * kuratierte Gutachten-Prompt, ein Voll-Template-Guard könnte hier nie greifen:
 *  1. der WERT steigt nur vom reinen Seed-Stand 1.000 aus (hat jemand ihn schon
 *     verschoben, war das eine Entscheidung und bleibt stehen),
 *  2. die HERKUNFT wird nur ergänzt, wo noch keine steht — sie ist reiner Anzeige-Text
 *     und darf einen selbst geschriebenen Satz nicht überschreiben.
 * Beide greifen unabhängig: ein verschobener Wert bekommt trotzdem seine Herkunft.
 */
/**
 * Bindet den fachlichen Prüfer an das GA-Artefakt — **stillgelegt**.
 *
 * Bis hierher war die fachliche Prüfung vollständig gebaut und nirgends gebunden:
 * `zim-ep` trug sieben Generierungs-Schritte und keinen einzigen `llm_qs`, also
 * erschien der QS-Knopf nie und `ga-qs-quellenabgleich` — eine `fehler`-Regel — ist
 * noch nie gelaufen. Die Migration macht diesen Zustand sichtbar und beendbar: der
 * Prüfer steht ab jetzt am Workflow, und ein Kurator schaltet ihn ein.
 *
 * **Er startet aus, und das ist der Punkt.** Sein Prompt ist an echten Abschnitten
 * nie gemessen worden, und er kostet je Abschnitt einen KI-Lauf (+50 % Laufzeit).
 * Ein Prüfer, der überall etwas findet, wäre schlechter als keiner.
 *
 * Drei unabhängige Teile, alle pristine-geschützt:
 *  1. `WorkflowDef.pruefer` wird nur gesetzt, wenn dort noch nichts steht;
 *  2. `pruefart` am Skill wird nur ergänzt, wenn sie fehlt;
 *  3. **`aktiv` wird auf `false` gesetzt, wenn das Feld FEHLT.** Das ist der Teil,
 *     den die erste Fassung falsch hatte: `aktiv` gar nicht anzufassen klang nach
 *     Vorsicht, hieß auf einem Bestands-Share aber „sofort scharf" — dort war das
 *     Feld nie gesetzt, und `undefined` gilt als aktiv. Der Seed-Wert `false`
 *     erreicht einen bestehenden Skill nie (`mergeMissingSeeds` ergänzt nur
 *     Fehlendes). Gemessen am 24.08.2026 an einer Share-Kopie: die Bindung stand,
 *     `aktiv` war `undefined` — die ungemessene Prüfung wäre beim nächsten Abschnitt
 *     gelaufen. Ein **explizites** `true` oder `false` bleibt dagegen unangetastet:
 *     das ist eine Entscheidung, keine Lücke.
 */
function applyFachpruefer(file: SkillRegistryFile): SkillRegistryFile {
  const skills = file.skills.map(s => {
    if (s.id !== QS_BASIS_SKILL_ID) return s;
    const next = { ...s };
    if (!next.pruefart) next.pruefart = SEED_QS_SKILL.pruefart;
    if (next.aktiv === undefined) next.aktiv = false;
    // Der Skill heisst jetzt nach seiner Aufgabe statt nach seiner Technik — aber nur,
    // wenn niemand ihn selbst umbenannt hat (byte-gleicher Alt-Wortlaut als Guard).
    if (next.name === QS_NAME_ALT) next.name = SEED_QS_SKILL.name;
    if (next.beschreibung === QS_BESCHREIBUNG_ALT) next.beschreibung = SEED_QS_SKILL.beschreibung;
    return next === s ? s : { ...next, version: Math.max(next.version, 2) };
  });
  // Ein alter Share ohne `workflows` bekommt sie ohnehin über `mergeMissingSeeds`
  // (dann schon mit Bindung) — hier gibt es nichts nachzuziehen.
  if (!file.workflows) return { ...file, skills };
  const workflows = file.workflows.map(w => (
    w.id === ZIM_EP_DEF.id && (w.pruefer ?? []).length === 0
      ? { ...w, pruefer: [...(ZIM_EP_DEF.pruefer ?? [])], version: Math.max(w.version, 3) }
      : w
  ));
  return { ...file, skills, workflows };
}

function applyAZeichenHerkunft(skills: SkillRecord[]): SkillRecord[] {
  return skills.map(s => {
    const zeichen = s.id === KURZFASSUNG_SKILL_ID ? s.vorgaben?.zeichenMax : undefined;
    if (!zeichen) return s;
    const max = zeichen.max === A_ZEICHEN_MAX_ALT ? A_ZEICHEN_MAX : zeichen.max;
    const herkunft = zeichen.herkunft?.trim() ? zeichen.herkunft : A_ZEICHEN_HERKUNFT;
    if (max === zeichen.max && herkunft === zeichen.herkunft) return s;
    return {
      ...s,
      vorgaben: { ...s.vorgaben, zeichenMax: { ...zeichen, max, herkunft } },
      version: Math.max(s.version, 4),
    };
  });
}

/**
 * Ein automatischer Korrektur-Versuch je ZIM-EP-Schritt (Messlauf 08/2026, Befund 2).
 * Der beschränkte Auto-Retry existiert seit v4.124, war aber an keinem Schritt
 * eingeschaltet — Begründung und Versuchszahl stehen am Seed (`EP_AUTO_RETRY`).
 *
 * Rein additiv wie `applyInterpunktion`: gesetzt wird nur an Generierungs-Schritten,
 * die noch kein `autoRetry` tragen. Wer ihn später bewusst abschaltet, behält das —
 * der Marker verhindert einen zweiten Lauf.
 */
function applyEpAutoRetry(file: SkillRegistryFile): SkillRegistryFile {
  // Ein Share ohne `workflows` (Alt-Stand) bekommt sie über `mergeMissingSeeds`
  // ohnehin frisch aus dem Seed — dort ist der Auto-Retry schon gesetzt.
  if (!file.workflows) return file;
  const workflows = file.workflows.map(w => {
    if (w.id !== ZIM_EP_DEF.id) return w;
    return {
      ...w,
      steps: w.steps.map(st =>
        st.rolle === 'llm_qs' || st.autoRetry ? st : { ...st, autoRetry: true, maxRetries: 1 }),
    };
  });
  return { ...file, workflows };
}

/**
 * Abschnitt A bekommt seinen Zweck, eine Weglass-Liste und das verlorene Ausgabeformat
 * (Messlauf 08/2026, zweite Runde).
 *
 * Drei Befunde in einem: (1) der kuratierte Share hatte den `### Finaler Text`-Block
 * verloren, weshalb `parseSkillOutput` die GANZE Antwort als finalen Text nahm — inklusive
 * der vom Modell erfundenen Titelzeile samt Förderkennzeichen und Antragsteller; genau
 * daran riss das Zeichenlimit. (2) Der Prompt nannte den Zweck nicht (die Kurzfassung wird
 * veröffentlicht) und hatte kein Weglass-Gebot, also ergänzte das Modell fleißig.
 * (3) Die `beschreibung` ist das einzige Feld, aus dem der Eval-Judge erfährt, was der
 * Abschnitt leisten soll — sie war ein Einzeiler ohne Umfang.
 *
 * A ist der eine kuratierte Gutachten-Prompt (783 statt 1.609 Zeichen), ein
 * Voll-Template-Guard könnte hier nie greifen — deshalb wie in `applyAUmfangKuratiert`
 * zeilenweise über Anker, die BEIDE Fassungen tragen. `mitVeroeffentlichungsKontrakt` ist
 * idempotent und dieselbe Funktion, die auch der Seed benutzt.
 *
 * Zwei unabhängig geschützte Teile:
 *  1. das TEMPLATE — additiv, jeder Anker einzeln; fehlt einer, bleibt sein Teil aus,
 *  2. die BESCHREIBUNG — nur vom reinen Seed-Einzeiler aus; hat jemand dort etwas
 *     Eigenes geschrieben, bleibt es stehen.
 */
function applyAVeroeffentlichung(skills: SkillRecord[]): SkillRecord[] {
  return skills.map(s => {
    if (s.id !== KURZFASSUNG_SKILL_ID) return s;
    const promptTemplate = mitVeroeffentlichungsKontrakt(s.promptTemplate);
    const beschreibung = s.beschreibung.trim() === A_BESCHREIBUNG_ALT ? A_BESCHREIBUNG : s.beschreibung;
    if (promptTemplate === s.promptTemplate && beschreibung === s.beschreibung) return s;
    return { ...s, promptTemplate, beschreibung, version: Math.max(s.version, 5) };
  });
}

/**
 * Abschnitt B: die drei Teil-Richtwerte nennen ihren **Anteil am Gesamtumfang** statt
 * einer festen Wortzahl (Nachmessung 08/2026).
 *
 * `applyUmfangDedup` nahm seinerzeit die Total-Zahl aus der Prosa, ließ die Teile aber
 * als „≥ 150 / ≥ 150 / ≥ 450 Wörter" stehen. Als das Team die Regel danach von
 * „mindestens 750" auf „400–500" kurierte, verlangte die Prosa unverändert mindestens
 * 750 — Teil 3 allein riss die Obergrenze. Haiku lieferte 360–364 Wörter und brach
 * damit beide Vorgaben. Ein Anteil kann dem Ganzen nicht widersprechen, gleich welchen
 * Wert der Kurator setzt; das Verhältnis 1:1:3 des Alt-Stands bleibt erhalten.
 *
 * Pristine-Guard: nur ein B, dessen Template byte-genau dem Absolut-Teile-Stand
 * entspricht, wird gehoben. Ein kuratierter Edit bleibt unberührt — der Skill-Editor
 * zeigt dort seit dieser Version den Summen-Konflikt als Hinweis an.
 */
function applyBTeilAnteile(skills: SkillRecord[]): SkillRecord[] {
  const altB = abschnittTemplate({ ...B_ABSCHNITT_OPTS_TEILE_ABSOLUT });
  const neuB = abschnittTemplate({ ...B_ABSCHNITT_OPTS });
  return skills.map(s =>
    s.id === AUSGANGSLAGE_SKILL_ID && s.promptTemplate === altB
      ? { ...s, promptTemplate: neuB, version: Math.max(s.version, 4) }
      : s);
}

/**
 * Abschnitt C: der finale Text bekommt eine **eigene** Tiefenangabe.
 *
 * `applyCFuenfRisiken` hob den Risiko-Deckel drei → fünf, mit der Rechnung „fünf Risiken
 * à zwei bis drei Sätze treffen die 300–350 Wörter". Nachgemessen trug sie nicht: Haiku
 * lieferte 203 / 235 / 218 Wörter in 12–14 Sätzen — die Satzzahl stimmte exakt, die
 * Rechnung unterstellte nur rund 24 Wörter je Satz statt der geschriebenen 15 bis 17.
 *
 * Der Grund liegt tiefer: „2–3 Sätze je Risiko" steht im Prompt am **Entwurf**, der
 * finale Text hatte gar keine eigene Tiefenangabe und erbte die Rate des Entwurfs. Eine
 * feste Satzzahl je Risiko kann eine feste Gesamtzahl ohnehin nicht treffen, solange die
 * Zahl der aufgenommenen Risiken schwankt. Der finale Text bekommt darum den
 * Gesamtumfang als Budget, das sich auf die aufgenommenen Risiken verteilt.
 *
 * Pristine-Guard wie bei B; die kuratierte 300–350-Vorgabe wird NICHT angefasst.
 */
function applyCFinalUmfang(skills: SkillRecord[]): SkillRecord[] {
  const altC = abschnittTemplate({ ...C_ABSCHNITT_OPTS_FUENF });
  const neuC = abschnittTemplate({ ...C_ABSCHNITT_OPTS });
  return skills.map(s =>
    s.id === RISIKEN_SKILL_ID && s.promptTemplate === altC
      ? { ...s, promptTemplate: neuC, version: Math.max(s.version, 4) }
      : s);
}

/**
 * Abschnitte B + C: die Wortanzahl wird **durchsetzbar** (`hinweis` → `fehler`).
 *
 * Der Befund, der das auslöste: `chooseRetryModifier` startet einen automatischen
 * Korrektur-Versuch nur bei `level === 'fehler'`. Solange die Wortanzahl ein `hinweis`
 * war, blieb der vorhandene, getestete `laenger`-Zweig für einen zu kurzen Abschnitt
 * unerreichbar — die Zielzahl war ein Wunsch ohne Weg. Gemessen (Haiku, drei fiktive
 * VBs, je drei Läufe): B stieg von 310–440 auf 388–440, C von 244–321 auf 288–378.
 *
 * **Abweichung von der Regel „kuratierte Werte nie anfassen", bewusst und eng
 * geschnitten:** die Migration ändert AUSSCHLIESSLICH den `schweregrad`. Min und Max
 * bleiben stehen, wie der Kurator sie gesetzt hat — die Zahlen sind seine Entscheidung,
 * die Durchsetzung war eine Team-Entscheidung. Ein Abschnitt, dessen Wortanzahl gar
 * nicht gesetzt oder bereits `fehler` ist, bleibt unberührt.
 *
 * Zusätzlich für einen PRISTINEN B (noch auf dem Alt-Seed „mindestens 750, kein Max"):
 * Übernahme der 400–500, die das Team im Editor gesetzt hat. Ein Share mit eigenen
 * Zahlen behält sie.
 */
function applyBcUmfangDurchsetzen(skills: SkillRecord[]): SkillRecord[] {
  const alterBSeed = (v: SkillVorgaben['wortanzahl']): boolean =>
    v?.min === 750 && v.max === undefined;
  return skills.map(s => {
    if (s.id !== AUSGANGSLAGE_SKILL_ID && s.id !== RISIKEN_SKILL_ID) return s;
    const wort = s.vorgaben?.wortanzahl;
    if (!wort) return s;
    const zahlen = s.id === AUSGANGSLAGE_SKILL_ID && alterBSeed(wort)
      ? { min: 400, max: 500 }
      : { ...(wort.min !== undefined ? { min: wort.min } : {}), ...(wort.max !== undefined ? { max: wort.max } : {}) };
    const neu = { ...wort, ...zahlen, schweregrad: 'fehler' as const };
    if (JSON.stringify(neu) === JSON.stringify(wort)) return s;
    return { ...s, vorgaben: { ...s.vorgaben, wortanzahl: neu } };
  });
}

/**
 * Bindet die Regel „keine Überschriften im Fließtext" an jeden Gutachten-Abschnitt.
 *
 * Der Anlass ist gemessen: über 224 echte Abschnitts-Texte aus den Eval-Läufen trug
 * JEDER B-Lauf drei Markdown-Überschriften im finalen Text, obwohl der Prompt „keine
 * Zwischenüberschriften" verlangt. `keine_aufzaehlungen` sucht Listen-Marker und ließ
 * sie durch — bis in den DOCX-Export. Von den 27 Treffern des Musters war keiner ein
 * Fehlalarm (A-Titelzeile oder B-Zwischenüberschrift).
 *
 * Rein additiv wie `applyInterpunktion`: nur die Bindung wird ergänzt, wo sie fehlt.
 * Den Regel-Record selbst zieht `mergeMissingSeeds` nach. Wer die Bindung später
 * bewusst entfernt, behält das — der Marker verhindert einen zweiten Lauf.
 */
function applyUeberschriften(skills: SkillRecord[]): SkillRecord[] {
  const gaSkillIds = new Set(ZIM_EP_DEF.steps.map(s => s.skillId));
  return skills.map(s =>
    gaSkillIds.has(s.id) && !s.regelIds.includes(UEBERSCHRIFTEN_REGEL_ID)
      ? { ...s, regelIds: [...s.regelIds, UEBERSCHRIFTEN_REGEL_ID] }
      : s);
}

/**
 * Der Standardsatz zieht an den Workflow um (v6.36).
 *
 * Ausgangslage: 37 Regel-Deklarationen über A–G, davon 25 dieselbe Regel mehrfach —
 * Interpunktion 7×, Überschriften 7×, Aufzählungen 6×, Passiv-Stil 5×. Eine Änderung
 * an „keine Aufzählungen" war damit sechs Änderungen.
 *
 * Drei Teile, jeder einzeln gegen kuratierte Edits gesichert:
 *  1. **Der Satz kommt an den Workflow** — nur, wenn dort noch keiner steht.
 *  2. **Die Zuordnung wird am Abschnitt entfernt**, aber nur die IDs, die im Satz
 *     stehen; alles andere bleibt. Wer eine der vier Regeln zusätzlich zugeordnet
 *     lässt, verliert nichts — `resolveRegeln` dedupliziert.
 *  3. **Die `keineAufzaehlungen`-Vorgabe weicht der Bibliotheks-Regel**, aber NUR
 *     wenn sie byte-gleich zum Seed-Wert ist (`{ schweregrad: 'fehler' }`). Hat jemand
 *     sie auf `hinweis` gestellt, bleibt sie stehen und schlägt als eigene Vorgabe die
 *     Standard-Regel nicht — beide liefen dann nebeneinander, was auffällt und
 *     korrigierbar ist; sie stillschweigend zu verschärfen wäre das Schlimmere.
 *
 * E und F bekommen ihre bisher nur als Lücke existierende Ausnahme als `ohneStandard`
 * geschrieben — ohne diese Zeile bekämen sie mit dem Satz eine Passiv-Regel, die sie
 * nie hatten.
 */
function applyGaStandardsatz(file: SkillRegistryFile): SkillRegistryFile {
  const satz = new Set(GA_STANDARD_REGEL_IDS);
  const gaSkillIds = new Set(ZIM_EP_DEF.steps.map(s => s.skillId));
  const ohneStandardSeed = new Map(
    SEED_SKILLS_BG.filter(s => s.ohneStandard?.length).map(s => [s.id, s.ohneStandard as string[]]),
  );
  const skills = file.skills.map(s => {
    if (!gaSkillIds.has(s.id)) return s;
    const next: SkillRecord = { ...s };
    let geaendert = false;
    const bleibend = s.regelIds.filter(id => !satz.has(id));
    if (bleibend.length !== s.regelIds.length) { next.regelIds = bleibend; geaendert = true; }
    // Nur der unveränderte Seed-Wert weicht — ein kuratierter Schweregrad bleibt.
    const auf = s.vorgaben?.keineAufzaehlungen;
    if (auf && auf.schweregrad === 'fehler' && !auf.herkunft && !auf.persoenlichAnpassbar) {
      const { keineAufzaehlungen: _weg, ...rest } = s.vorgaben as SkillVorgaben;
      next.vorgaben = Object.keys(rest).length > 0 ? rest : undefined;
      geaendert = true;
    }
    const seedAbwahl = ohneStandardSeed.get(s.id);
    if (seedAbwahl && !s.ohneStandard) { next.ohneStandard = [...seedAbwahl]; geaendert = true; }
    return geaendert ? { ...next, version: s.version + 1 } : s;
  });
  // Ein Share ohne `workflows` bekommt sie über `mergeMissingSeeds` — dann schon mit Satz.
  if (!file.workflows) return { ...file, skills };
  const workflows = file.workflows.map(w => (
    w.id === ZIM_EP_DEF.id && (w.standardRegelIds ?? []).length === 0
      ? { ...w, standardRegelIds: [...GA_STANDARD_REGEL_IDS], version: Math.max(w.version, 4) }
      : w
  ));
  return { ...file, skills, workflows };
}

/**
 * Der fachliche Prüfer geht an (v6.36).
 *
 * `applyFachpruefer` hatte ihn bewusst auf `false` gesetzt: seine Prüf-Qualität war
 * ungemessen, und ein Prüfer, der überall etwas findet, kostet je Abschnitt einen
 * KI-Lauf für Rauschen. Freigeschaltet wird er, weil er nur in dev und pl existiert
 * und pl produktiv nicht genutzt wird — die Messung findet jetzt an echten Läufen
 * statt statt an einem Testkorpus davor.
 *
 * Nur `false → true`: ein Share, auf dem jemand ihn nach der Freischaltung wieder
 * abschaltet, ist durch den Marker geschützt (die Migration läuft genau einmal).
 */
function applyPrueferAktiv(skills: SkillRecord[]): SkillRecord[] {
  return skills.map(s =>
    s.id === QS_BASIS_SKILL_ID && s.aktiv === false
      ? { ...s, aktiv: true, version: Math.max(s.version, 3) }
      : s);
}

/**
 * Abschnitt D bekommt seine Umfangs-Vorgabe — sie ist nie auf dem Share angekommen.
 *
 * Gefunden beim Standardsatz-Umbau (v6.36), indem die Vorgaben aller sieben Abschnitte
 * einmal nebeneinandergelegt wurden: D stand als EINZIGER auf `{}`. Der Seed führt seit
 * jeher 300–350 Wörter; auf den Share kam der Wert nie, weil `applySkillVorgaben`
 * (v2.296) nur Regel-RECORDS umgewandelt hat, die es dort gab — D's `seed-d-wortanzahl`
 * war zu diesem Zeitpunkt offenbar schon weg. `mergeMissingSeeds` ergänzt fehlende
 * SKILLS, nie fehlende Felder eines vorhandenen; also blieb die Lücke.
 *
 * Am gespeicherten Eval-Korpus gemessen, was D ohne Prüfung schrieb: **1 von 9** Texten
 * im Band 300–350, drei mit **neun Wörtern** — entartete Läufe, die nichts gemeldet hat
 * (9, 9, 9, 341, 356, 387, 412, 419, 841).
 *
 * Guard: gesetzt wird NUR, wo gar keine `wortanzahl` steht. Ein kuratierter Wert — auch
 * ein bewusst anderer Schweregrad — bleibt unangetastet; die übrigen Vorgaben von D
 * (falls jemand welche angelegt hat) ebenso.
 */
function applyDUmfang(skills: SkillRecord[]): SkillRecord[] {
  const seed = SEED_SKILLS_BG.find(s => s.id === MARKT_SKILL_ID)?.vorgaben?.wortanzahl;
  if (!seed) return skills;
  return skills.map(s => (
    s.id === MARKT_SKILL_ID && !s.vorgaben?.wortanzahl
      ? { ...s, vorgaben: { ...s.vorgaben, wortanzahl: { ...seed } }, version: s.version + 1 }
      : s
  ));
}

interface EinzelMigration {
  marker: string;
  /** Bekommt die GANZE Datei — Migrationen dürfen auch `regeln` anfassen. */
  apply: (file: SkillRegistryFile) => SkillRegistryFile;
}

/** Hülle für die Migrationen, die ausschließlich Skills anfassen. */
const nurSkills = (fn: (skills: SkillRecord[]) => SkillRecord[]) =>
  (file: SkillRegistryFile): SkillRegistryFile => ({ ...file, skills: fn(file.skills) });

/** Reihenfolge = Anwendungsreihenfolge; append-only (nie umsortieren/entfernen). */
const MIGRATIONEN: EinzelMigration[] = [
  { marker: ANFRAGE_ANON_AKTIV_MIGRATION, apply: nurSkills(applyAnonAktiv) },
  { marker: GA_BELEG_KONTRAKT_MIGRATION, apply: nurSkills(applyBelegKontrakt) },
  { marker: AUFBEREITUNG_ZAHLEN_MAXTOKENS_MIGRATION, apply: nurSkills(applyZahlenMaxTokens) },
  { marker: AUFBEREITUNG_STECKBRIEF_MAXTOKENS_MIGRATION, apply: nurSkills(applySteckbriefMaxTokens) },
  { marker: GA_BELEG_KONTRAKT_REVERT_MIGRATION, apply: nurSkills(applyBelegKontraktRevert) },
  { marker: GA_RISIKEN_ENTWURF_MIGRATION, apply: nurSkills(applyRisikenEntwurf) },
  { marker: GA_UMFANG_DEDUP_MIGRATION, apply: nurSkills(applyUmfangDedup) },
  { marker: GA_UMFANG_DEDUP_CD_MIGRATION, apply: nurSkills(applyUmfangDedupCD) },
  { marker: GA_PFLICHT_ANFANG_KLAR_MIGRATION, apply: nurSkills(applyPflichtAnfangKlar) },
  { marker: ANFRAGE_ANON_KLAR_MIGRATION, apply: nurSkills(applyAnonKlar) },
  { marker: SKILL_VORGABEN_MIGRATION, apply: applySkillVorgaben },
  { marker: GA_INTERPUNKTION_MIGRATION, apply: nurSkills(applyInterpunktion) },
  { marker: AUFBEREITUNG_DR_STICHWORTE_MIGRATION, apply: nurSkills(applyDrStichworte) },
  { marker: GA_TEILSTRUKTUR_ENTFERNEN_MIGRATION, apply: nurSkills(applyTeilStrukturEntfernen) },
  { marker: GA_C_FUENF_RISIKEN_MIGRATION, apply: nurSkills(applyCFuenfRisiken) },
  { marker: GA_A_UMFANG_KURATIERT_MIGRATION, apply: nurSkills(applyAUmfangKuratiert) },
  { marker: GA_EF_VORGABEN_MIGRATION, apply: nurSkills(applyEfVorgaben) },
  { marker: GA_EP_AUTO_RETRY_MIGRATION, apply: applyEpAutoRetry },
  { marker: GA_A_ZEICHEN_HERKUNFT_MIGRATION, apply: nurSkills(applyAZeichenHerkunft) },
  { marker: GA_FACHPRUEFER_MIGRATION, apply: applyFachpruefer },
  { marker: GA_A_VEROEFFENTLICHUNG_MIGRATION, apply: nurSkills(applyAVeroeffentlichung) },
  { marker: GA_B_TEIL_ANTEILE_MIGRATION, apply: nurSkills(applyBTeilAnteile) },
  { marker: GA_C_FINAL_UMFANG_MIGRATION, apply: nurSkills(applyCFinalUmfang) },
  { marker: GA_BC_UMFANG_DURCHSETZEN_MIGRATION, apply: nurSkills(applyBcUmfangDurchsetzen) },
  { marker: GA_UEBERSCHRIFTEN_MIGRATION, apply: nurSkills(applyUeberschriften) },
  { marker: GA_STANDARDSATZ_MIGRATION, apply: applyGaStandardsatz },
  { marker: GA_PRUEFER_AKTIV_MIGRATION, apply: nurSkills(applyPrueferAktiv) },
  { marker: GA_D_UMFANG_MIGRATION, apply: nurSkills(applyDUmfang) },
];

/**
 * Wendet alle ausstehenden einmaligen Migrationen an. Pro Marker genau EINMAL: fehlt
 * er, wird die Migration angewandt UND der Marker gesetzt (auch wenn die Migration ein
 * No-op war — sonst liefe sie bei jedem Laden erneut und würde eine spätere bewusste
 * Kurator-Änderung wieder überschreiben).
 */
export function reconcileEinmaligeAktivierungen(file: SkillRegistryFile): ReconcileResult {
  const bereits = new Set(file.angewandteMigrationen ?? []);
  let next = file;
  const angewandt: string[] = [];
  for (const m of MIGRATIONEN) {
    if (bereits.has(m.marker)) continue;
    next = m.apply(next);
    angewandt.push(m.marker);
  }
  if (angewandt.length === 0) return { file, geaendert: false, angewandt: [] };
  return {
    file: { ...next, angewandteMigrationen: [...(file.angewandteMigrationen ?? []), ...angewandt] },
    geaendert: true,
    angewandt,
  };
}
