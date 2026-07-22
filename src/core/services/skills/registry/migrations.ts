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
  KOMPETENZ_SKILL_ID,
  G_ABSCHNITT_OPTS,
  G_ABSCHNITT_OPTS_PFLICHT_ALT,
  INTERPUNKTION_REGEL_ID,
  ZIM_EP_DEF,
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
