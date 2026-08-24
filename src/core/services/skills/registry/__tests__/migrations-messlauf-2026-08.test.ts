/**
 * Die vier Migrationen aus dem Messlauf 08/2026 (Gutachten-Abschnitte gegen die
 * interne KI). Eigene Datei, weil `migrations.test.ts` bereits ~800 Zeilen trägt und
 * diese vier zusammen EINE Geschichte erzählen: was der Messlauf an den kuratierten
 * Prompts gefunden hat und wie es auf Bestands-Shares kommt.
 *
 * Geprüft wird an jeder Migration dasselbe Dreieck: greift sie auf dem pristinen
 * Stand, lässt sie einen kuratierten Edit in Ruhe, und läuft sie nur einmal.
 */
import { describe, expect, it } from 'vitest';
import {
  reconcileEinmaligeAktivierungen,
  ANFRAGE_ANON_AKTIV_MIGRATION,
  GA_BELEG_KONTRAKT_MIGRATION,
  GA_BELEG_KONTRAKT_REVERT_MIGRATION,
  AUFBEREITUNG_ZAHLEN_MAXTOKENS_MIGRATION,
  AUFBEREITUNG_STECKBRIEF_MAXTOKENS_MIGRATION,
  GA_RISIKEN_ENTWURF_MIGRATION,
  GA_UMFANG_DEDUP_MIGRATION,
  GA_UMFANG_DEDUP_CD_MIGRATION,
  GA_PFLICHT_ANFANG_KLAR_MIGRATION,
  ANFRAGE_ANON_KLAR_MIGRATION,
  SKILL_VORGABEN_MIGRATION,
  GA_INTERPUNKTION_MIGRATION,
  AUFBEREITUNG_DR_STICHWORTE_MIGRATION,
  GA_TEILSTRUKTUR_ENTFERNEN_MIGRATION,
  GA_C_FUENF_RISIKEN_MIGRATION,
  GA_A_UMFANG_KURATIERT_MIGRATION,
  GA_EF_VORGABEN_MIGRATION,
  GA_EP_AUTO_RETRY_MIGRATION,
  GA_A_ZEICHEN_HERKUNFT_MIGRATION,
  GA_FACHPRUEFER_MIGRATION,
  GA_A_VEROEFFENTLICHUNG_MIGRATION,
  GA_B_TEIL_ANTEILE_MIGRATION,
  GA_C_FINAL_UMFANG_MIGRATION,
  GA_BC_UMFANG_DURCHSETZEN_MIGRATION,
  GA_UEBERSCHRIFTEN_MIGRATION,
} from '../migrations';
import {
  KURZFASSUNG_SKILL_ID,
  RISIKEN_SKILL_ID,
  MARKT_SKILL_ID,
  UNTERNEHMEN_SKILL_ID,
  VERWERTUNG_SKILL_ID,
  SEED_SKILL,
  SEED_SKILLS_BG,
  A_AUFGABE_ZEILE,
  A_AUFGABE_ZEILE_UMFANG_ALT,
  A_MODIFIERS_UMFANG_ALT,
  C_ABSCHNITT_OPTS_NEU,
  C_ABSCHNITT_OPTS_FUENF,
  C_ABSCHNITT_OPTS,
  AUSGANGSLAGE_SKILL_ID,
  B_ABSCHNITT_OPTS,
  B_ABSCHNITT_OPTS_TEILE_ABSOLUT,
  ZIM_EP_DEF,
  SEED_REGISTRY,
  UEBERSCHRIFTEN_REGEL_ID,
  abschnittTemplate,
} from '../seed';
import type { SkillRecord, SkillRegistryFile, SkillVorgaben, WorkflowDef, WorkflowStep } from '../types';

const ALLE_MARKER = [
  ANFRAGE_ANON_AKTIV_MIGRATION, GA_BELEG_KONTRAKT_MIGRATION, GA_BELEG_KONTRAKT_REVERT_MIGRATION,
  AUFBEREITUNG_ZAHLEN_MAXTOKENS_MIGRATION, AUFBEREITUNG_STECKBRIEF_MAXTOKENS_MIGRATION,
  GA_RISIKEN_ENTWURF_MIGRATION, GA_UMFANG_DEDUP_MIGRATION, GA_UMFANG_DEDUP_CD_MIGRATION,
  GA_PFLICHT_ANFANG_KLAR_MIGRATION, ANFRAGE_ANON_KLAR_MIGRATION, SKILL_VORGABEN_MIGRATION,
  GA_INTERPUNKTION_MIGRATION, AUFBEREITUNG_DR_STICHWORTE_MIGRATION,
  GA_TEILSTRUKTUR_ENTFERNEN_MIGRATION, GA_C_FUENF_RISIKEN_MIGRATION,
  GA_A_UMFANG_KURATIERT_MIGRATION, GA_EF_VORGABEN_MIGRATION, GA_EP_AUTO_RETRY_MIGRATION,
  GA_A_ZEICHEN_HERKUNFT_MIGRATION, GA_FACHPRUEFER_MIGRATION, GA_A_VEROEFFENTLICHUNG_MIGRATION,
  GA_B_TEIL_ANTEILE_MIGRATION, GA_C_FINAL_UMFANG_MIGRATION, GA_BC_UMFANG_DURCHSETZEN_MIGRATION,
  GA_UEBERSCHRIFTEN_MIGRATION,
];
/** Alle Marker AUSSER dem geprüften — isoliert genau eine Migration. */
const ausser = (marker: string): string[] => ALLE_MARKER.filter(m => m !== marker);

function skill(id: string, over: Partial<SkillRecord> = {}): SkillRecord {
  return {
    id, name: id, beschreibung: '', version: 1, promptTemplate: 'P',
    modifiers: { neu: '', kuerzer: '', laenger: '' }, regelIds: [], slots: [],
    geaendert_am: 't', ...over,
  };
}
function file(skills: SkillRecord[], marker: string[], workflows?: WorkflowDef[]): SkillRegistryFile {
  return {
    version: 1, updated_at: 't', skills, regeln: [],
    angewandteMigrationen: marker, ...(workflows ? { workflows } : {}),
  };
}

const DREI_C = abschnittTemplate({ ...C_ABSCHNITT_OPTS_NEU });
const FUENF_C = abschnittTemplate({ ...C_ABSCHNITT_OPTS_FUENF });

describe('C: Risiko-Deckel drei → fünf (Befund 3)', () => {
  const NUR = ausser(GA_C_FUENF_RISIKEN_MIGRATION);

  it('pristine Drei-Risiken-Stand → Fünf-Stand, Version steigt auf 3', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(
      file([skill(RISIKEN_SKILL_ID, { promptTemplate: DREI_C, version: 2 })], NUR),
    );
    expect(geaendert).toBe(true);
    expect(out.skills[0]!.promptTemplate).toBe(FUENF_C);
    expect(out.skills[0]!.promptTemplate).toContain('höchstens fünf');
    expect(out.skills[0]!.promptTemplate).not.toContain('höchstens drei');
    expect(out.skills[0]!.version).toBe(3);
  });

  it('senkt eine höhere Version nicht', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(
      file([skill(RISIKEN_SKILL_ID, { promptTemplate: DREI_C, version: 9 })], NUR),
    );
    expect(out.skills[0]!.version).toBe(9);
  });

  it('kuratierter C-Edit bleibt UNBERÜHRT', () => {
    const kuratiert = `${DREI_C}\n\nEigener Zusatz des Kurators.`;
    const { file: out } = reconcileEinmaligeAktivierungen(
      file([skill(RISIKEN_SKILL_ID, { promptTemplate: kuratiert })], NUR),
    );
    expect(out.skills[0]!.promptTemplate).toBe(kuratiert);
  });

  it('läuft nur einmal: gesetzter Marker lässt den Drei-Stand stehen', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(
      file([skill(RISIKEN_SKILL_ID, { promptTemplate: DREI_C })], ALLE_MARKER),
    );
    expect(geaendert).toBe(false);
    expect(out.skills[0]!.promptTemplate).toBe(DREI_C);
  });
});

describe('A: Satzzahl einheitlich 9–11 (Befund 4)', () => {
  const NUR = ausser(GA_A_UMFANG_KURATIERT_MIGRATION);
  /**
   * Der KURATIERTE Share-Stand: eigener Prompt-Aufbau (823 statt 1.609 Zeichen), aber
   * mit der Alt-Aufgabenzeile. Genau darum kann hier kein Voll-Template-Guard greifen.
   */
  const kuratiertesA = (over: Partial<SkillRecord> = {}): SkillRecord => skill(KURZFASSUNG_SKILL_ID, {
    promptTemplate: `Erstelle die Kurzfassung …\n\nAufgabe & Kontrakt\n${A_AUFGABE_ZEILE_UMFANG_ALT}\n1. Projektziel (2 Sätze)`,
    modifiers: { ...A_MODIFIERS_UMFANG_ALT },
    vorgaben: { satzanzahl: { schweregrad: 'hinweis', min: 9, max: 11 } },
    version: 5,
    ...over,
  });

  it('tauscht die Alt-Zeile im kuratierten Prompt, ohne den Rest anzufassen', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(file([kuratiertesA()], NUR));
    expect(geaendert).toBe(true);
    const a = out.skills[0]!;
    expect(a.promptTemplate).toContain(A_AUFGABE_ZEILE);
    expect(a.promptTemplate).not.toContain('Toleranz 8–12');
    expect(a.promptTemplate).toContain('1. Projektziel (2 Sätze)');
    expect(a.version).toBe(5);
  });

  it('zieht die Modifier-Richtwerte 8/12 auf 9/11 nach', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(file([kuratiertesA()], NUR));
    expect(out.skills[0]!.modifiers.kuerzer).toContain('Richtung 9 Sätze');
    expect(out.skills[0]!.modifiers.laenger).toContain('Richtung 11 Sätze');
    expect(out.skills[0]!.modifiers.kuerzer).toBe(SEED_SKILL.modifiers.kuerzer);
  });

  it('kuratierte Modifier bleiben UNBERÜHRT', () => {
    const eigen = { neu: 'n', kuerzer: 'Meine eigene Kürzungs-Anweisung.', laenger: 'l' };
    const { file: out } = reconcileEinmaligeAktivierungen(
      file([kuratiertesA({ modifiers: eigen })], NUR),
    );
    expect(out.skills[0]!.modifiers).toEqual(eigen);
  });

  it('hebt die Satzanzahl NUR vom reinen Seed-Wert 8–12/fehler auf 9–11', () => {
    const pristine = kuratiertesA({
      vorgaben: { satzanzahl: { schweregrad: 'fehler', min: 8, max: 12, persoenlichAnpassbar: true } },
    });
    const { file: out } = reconcileEinmaligeAktivierungen(file([pristine], NUR));
    expect(out.skills[0]!.vorgaben?.satzanzahl).toEqual({
      schweregrad: 'fehler', min: 9, max: 11, persoenlichAnpassbar: true,
    });
  });

  it('die kuratierte 9–11-Vorgabe des Teams wird nicht angefasst', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(file([kuratiertesA()], NUR));
    expect(out.skills[0]!.vorgaben?.satzanzahl).toEqual({ schweregrad: 'hinweis', min: 9, max: 11 });
  });

  it('ein A ohne Alt-Zeile, mit eigenen Modifiern und eigener Vorgabe ist ein No-op', () => {
    const fremd = skill(KURZFASSUNG_SKILL_ID, {
      promptTemplate: 'Völlig eigener Prompt.',
      modifiers: { neu: 'n', kuerzer: 'k', laenger: 'l' },
      vorgaben: { satzanzahl: { schweregrad: 'hinweis', min: 9, max: 11 } },
    });
    const { file: out } = reconcileEinmaligeAktivierungen(file([fremd], NUR));
    expect(out.skills[0]).toEqual(fremd);
  });

  it('läuft nur einmal: gesetzter Marker lässt die Doppelung stehen', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(file([kuratiertesA()], ALLE_MARKER));
    expect(geaendert).toBe(false);
    expect(out.skills[0]!.promptTemplate).toContain('Toleranz 8–12');
  });
});

describe('Vorgaben für E und F (Befund 5)', () => {
  const NUR = ausser(GA_EF_VORGABEN_MIGRATION);
  const seedBg = (id: string): SkillRecord => SEED_SKILLS_BG.find(s => s.id === id)!;
  const pristine = (id: string): SkillRecord =>
    skill(id, { promptTemplate: seedBg(id).promptTemplate, version: 1 });

  it('setzt die Seed-Vorgaben auf E und F, Version steigt auf 2', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(
      file([pristine(UNTERNEHMEN_SKILL_ID), pristine(VERWERTUNG_SKILL_ID)], NUR),
    );
    expect(geaendert).toBe(true);
    expect(out.skills[0]!.vorgaben).toEqual(seedBg(UNTERNEHMEN_SKILL_ID).vorgaben);
    expect(out.skills[0]!.vorgaben?.wortanzahl?.min).toBe(40);
    expect(out.skills[1]!.vorgaben?.wortanzahl?.min).toBe(60);
    expect(out.skills[0]!.vorgaben?.keineAufzaehlungen?.schweregrad).toBe('fehler');
    expect(out.skills[0]!.version).toBe(2);
  });

  it('kein Abschnitt bekommt eine Obergrenze — beide skalieren mit der Partnerzahl', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(
      file([pristine(UNTERNEHMEN_SKILL_ID), pristine(VERWERTUNG_SKILL_ID)], NUR),
    );
    for (const s of out.skills) {
      expect(s.vorgaben?.wortanzahl?.min, s.id).toBeGreaterThan(0);
      expect(s.vorgaben?.wortanzahl?.max, s.id).toBeUndefined();
    }
  });

  it('E mit bereits gesetzten Vorgaben bleibt UNBERÜHRT', () => {
    const eigen = { keineAufzaehlungen: { schweregrad: 'hinweis' as const } };
    const { file: out } = reconcileEinmaligeAktivierungen(
      file([skill(UNTERNEHMEN_SKILL_ID, {
        promptTemplate: seedBg(UNTERNEHMEN_SKILL_ID).promptTemplate, vorgaben: eigen,
      })], NUR),
    );
    expect(out.skills[0]!.vorgaben).toEqual(eigen);
  });

  it('E mit kuratiertem Prompt bekommt keinen geratenen Wort-Boden', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(
      file([skill(UNTERNEHMEN_SKILL_ID, { promptTemplate: 'Ganz anderer Abschnitt.' })], NUR),
    );
    expect(out.skills[0]!.vorgaben).toBeUndefined();
  });

  it('fasst andere Abschnitte nicht an', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(
      file([skill(MARKT_SKILL_ID, { promptTemplate: seedBg(MARKT_SKILL_ID).promptTemplate })], NUR),
    );
    expect(out.skills[0]!.vorgaben).toBeUndefined();
  });

  it('läuft nur einmal: gesetzter Marker lässt E ohne Vorgaben', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(
      file([pristine(UNTERNEHMEN_SKILL_ID)], ALLE_MARKER),
    );
    expect(geaendert).toBe(false);
    expect(out.skills[0]!.vorgaben).toBeUndefined();
  });
});

describe('ein automatischer Korrektur-Versuch je ZIM-EP-Schritt (Befund 2)', () => {
  const NUR = ausser(GA_EP_AUTO_RETRY_MIGRATION);
  const step = (id: string, over: Partial<WorkflowStep> = {}): WorkflowStep =>
    ({ id, nr: id, kurz: id, label: id, skillId: `skill-${id}`, gateExpr: 'immer', ...over });
  const epWf = (steps: WorkflowStep[]): WorkflowDef[] =>
    [{ id: ZIM_EP_DEF.id, name: 'ZIM-EP-Gutachten', version: 7, steps }];

  it('setzt autoRetry + genau EINEN Versuch auf jeden Generierungs-Schritt', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(
      file([], NUR, epWf([step('A'), step('G')])),
    );
    expect(geaendert).toBe(true);
    for (const st of out.workflows!) {
      for (const s of st.steps) {
        expect(s.autoRetry, s.id).toBe(true);
        expect(s.maxRetries, s.id).toBe(1);
      }
    }
  });

  it('respektiert eine bereits gesetzte Versuchszahl', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(
      file([], NUR, epWf([step('A', { autoRetry: true, maxRetries: 3 })])),
    );
    expect(out.workflows![0]!.steps[0]!.maxRetries).toBe(3);
  });

  it('lässt QS-Schritte aus — dort gibt es keinen Auto-Retry', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(
      file([], NUR, epWf([step('Q', { rolle: 'llm_qs' })])),
    );
    expect(out.workflows![0]!.steps[0]!.autoRetry).toBeUndefined();
  });

  it('fasst fremde Workflows nicht an', () => {
    const fremd: WorkflowDef[] = [{ id: 'zim-nf', name: 'NF', version: 1, steps: [step('NF')] }];
    const { file: out } = reconcileEinmaligeAktivierungen(file([], NUR, fremd));
    expect(out.workflows![0]!.steps[0]!.autoRetry).toBeUndefined();
  });

  it('ein Share ganz ohne Workflows wirft nicht', () => {
    expect(() => reconcileEinmaligeAktivierungen(file([], NUR))).not.toThrow();
  });

  it('läuft nur einmal: gesetzter Marker lässt den Schritt ohne Auto-Retry', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(
      file([], ALLE_MARKER, epWf([step('A')])),
    );
    expect(geaendert).toBe(false);
    expect(out.workflows![0]!.steps[0]!.autoRetry).toBeUndefined();
  });
});

describe('der Seed selbst trägt alle vier Entscheidungen', () => {
  it('C nennt fünf Risiken, nicht drei', () => {
    const c = SEED_SKILLS_BG.find(s => s.id === RISIKEN_SKILL_ID)!;
    expect(c.promptTemplate).toContain('höchstens fünf');
    expect(c.promptTemplate).not.toContain('höchstens drei');
  });

  it('A nennt die Satzzahl nur noch an EINER Stelle — der Vorgabe', () => {
    expect(SEED_SKILL.promptTemplate).not.toContain('Sätzen zusammen');
    expect(SEED_SKILL.promptTemplate).not.toContain('Toleranz');
    expect(SEED_SKILL.vorgaben?.satzanzahl?.min).toBe(9);
    expect(SEED_SKILL.vorgaben?.satzanzahl?.max).toBe(11);
    // Die Modifier zeigen auf die Ränder DIESER Vorgabe, nicht mehr auf 8/12.
    expect(SEED_SKILL.modifiers.kuerzer).toContain('Richtung 9 Sätze');
    expect(SEED_SKILL.modifiers.laenger).toContain('Richtung 11 Sätze');
  });

  it('E und F prüfen mehr als nur die Interpunktion', () => {
    for (const id of [UNTERNEHMEN_SKILL_ID, VERWERTUNG_SKILL_ID]) {
      const s = SEED_SKILLS_BG.find(x => x.id === id)!;
      expect(s.vorgaben, id).toBeDefined();
      expect(s.vorgaben?.keineAufzaehlungen?.schweregrad, id).toBe('fehler');
      expect(s.vorgaben?.wortanzahl?.min, id).toBeGreaterThan(0);
    }
  });

  it('jeder ZIM-EP-Schritt hat genau einen automatischen Versuch', () => {
    for (const s of ZIM_EP_DEF.steps) {
      expect(s.autoRetry, s.id).toBe(true);
      expect(s.maxRetries, s.id).toBe(1);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Nachmessung 08/2026: die zwei Abschnitte, die 3/3 zu kurz lieferten         */
/* -------------------------------------------------------------------------- */

const ABSOLUT_B = abschnittTemplate({ ...B_ABSCHNITT_OPTS_TEILE_ABSOLUT });
const ANTEIL_B = abschnittTemplate({ ...B_ABSCHNITT_OPTS });

describe('B: Teil-Richtwerte als Anteil statt fester Wortzahl', () => {
  const NUR = ausser(GA_B_TEIL_ANTEILE_MIGRATION);

  it('pristine Absolut-Stand → Anteils-Stand, Version steigt auf 4', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(
      file([skill(AUSGANGSLAGE_SKILL_ID, { promptTemplate: ABSOLUT_B, version: 3 })], NUR),
    );
    expect(geaendert).toBe(true);
    expect(out.skills[0]!.promptTemplate).toBe(ANTEIL_B);
    expect(out.skills[0]!.version).toBe(4);
  });

  it('der neue Stand nennt KEINE absolute Wortzahl mehr, das Verhältnis 1:1:3 bleibt', () => {
    expect(ABSOLUT_B).toMatch(/Richtwert ≥ 450 Wörter/);
    expect(ANTEIL_B).not.toMatch(/\d+\s*Wörter/);
    expect(ANTEIL_B).toContain('rund ein Fünftel des Gesamtumfangs');
    expect(ANTEIL_B).toContain('rund drei Fünftel des Gesamtumfangs');
  });

  it('der Gesamtumfang wird dem FINALEN Text zugeschrieben — wie an C', () => {
    // Der Auto-Block „## Formale Vorgaben" steht ganz am Ende des zusammengesetzten
    // Prompts; die Zuschreibung gehört zu den Format-Regeln, wo der Abschnitt seine
    // eigene Form beschreibt. An C war genau diese Zeile die messbar wirksame Änderung.
    expect(ABSOLUT_B).not.toContain('Der Gesamtumfang aus den formalen Vorgaben');
    expect(ANTEIL_B).toContain('Der Gesamtumfang aus den formalen Vorgaben gilt für den **finalen Text**');
    expect(ANTEIL_B).toContain('Verhältnis 1:1:3');
  });

  it('senkt eine höhere Version nicht', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(
      file([skill(AUSGANGSLAGE_SKILL_ID, { promptTemplate: ABSOLUT_B, version: 9 })], NUR),
    );
    expect(out.skills[0]!.version).toBe(9);
  });

  it('kuratierter B-Edit bleibt UNBERÜHRT', () => {
    const kuratiert = `${ABSOLUT_B}\n\nEigener Zusatz des Kurators.`;
    const { file: out } = reconcileEinmaligeAktivierungen(
      file([skill(AUSGANGSLAGE_SKILL_ID, { promptTemplate: kuratiert })], NUR),
    );
    expect(out.skills[0]!.promptTemplate).toBe(kuratiert);
  });

  it('läuft nur einmal: gesetzter Marker lässt den Absolut-Stand stehen', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(
      file([skill(AUSGANGSLAGE_SKILL_ID, { promptTemplate: ABSOLUT_B })], ALLE_MARKER),
    );
    expect(geaendert).toBe(false);
    expect(out.skills[0]!.promptTemplate).toBe(ABSOLUT_B);
  });
});

const TIEFE_C = abschnittTemplate({ ...C_ABSCHNITT_OPTS });

describe('C: eigene Tiefenangabe für den finalen Text', () => {
  const NUR = ausser(GA_C_FINAL_UMFANG_MIGRATION);

  it('pristine Fünf-Risiken-Stand → Tiefen-Stand, Version steigt auf 4', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(
      file([skill(RISIKEN_SKILL_ID, { promptTemplate: FUENF_C, version: 3 })], NUR),
    );
    expect(geaendert).toBe(true);
    expect(out.skills[0]!.promptTemplate).toBe(TIEFE_C);
    expect(out.skills[0]!.version).toBe(4);
  });

  it('der Gesamtumfang wird dem FINALEN Text zugeschrieben, nicht dem Entwurf', () => {
    expect(FUENF_C).not.toContain('Der Gesamtumfang aus den formalen Vorgaben');
    expect(TIEFE_C).toContain('Der Gesamtumfang aus den formalen Vorgaben gilt für den **finalen Text**');
    // Die Entwurfs-Rate bleibt, wo sie hingehört — sie ist die Quelle, aus der das
    // Modell bisher mangels eigener Angabe auch den finalen Text bemaß.
    expect(TIEFE_C).toContain('2–3 Sätzen (vollständige Liste)');
    // Der Deckel aus dem Vorgänger-Fix bleibt unangetastet.
    expect(TIEFE_C).toContain('höchstens fünf');
  });

  it('kuratierter C-Edit bleibt UNBERÜHRT', () => {
    const kuratiert = `${FUENF_C}\n\nEigener Zusatz des Kurators.`;
    const { file: out } = reconcileEinmaligeAktivierungen(
      file([skill(RISIKEN_SKILL_ID, { promptTemplate: kuratiert })], NUR),
    );
    expect(out.skills[0]!.promptTemplate).toBe(kuratiert);
  });

  it('läuft nur einmal: gesetzter Marker lässt den Fünf-Stand stehen', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(
      file([skill(RISIKEN_SKILL_ID, { promptTemplate: FUENF_C })], ALLE_MARKER),
    );
    expect(geaendert).toBe(false);
    expect(out.skills[0]!.promptTemplate).toBe(FUENF_C);
  });
});

/**
 * `hinweis` → `fehler`: der Unterschied ist nicht die Farbe des Checks, sondern OB
 * überhaupt etwas passiert. `chooseRetryModifier` startet einen Korrektur-Versuch nur
 * bei `fehler`; als `hinweis` war der `laenger`-Zweig für einen zu kurzen Abschnitt
 * unerreichbar. Die Migration ändert deshalb den Schweregrad — und NUR ihn.
 */
describe('B + C: die Wortanzahl wird durchsetzbar', () => {
  const NUR = ausser(GA_BC_UMFANG_DURCHSETZEN_MIGRATION);
  const mitWort = (id: string, wortanzahl: SkillVorgaben['wortanzahl']): SkillRecord =>
    skill(id, { vorgaben: { ...(wortanzahl ? { wortanzahl } : {}) } });

  it('kuratierte Zahlen bleiben stehen — nur der Schweregrad kippt', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(
      file([mitWort(RISIKEN_SKILL_ID, { schweregrad: 'hinweis', min: 280, max: 330 })], NUR),
    );
    expect(geaendert).toBe(true);
    expect(out.skills[0]!.vorgaben?.wortanzahl).toEqual({ schweregrad: 'fehler', min: 280, max: 330 });
  });

  it('pristines B (Alt-Seed „mindestens 750, kein Max") bekommt zusätzlich die 400–500 des Teams', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(
      file([mitWort(AUSGANGSLAGE_SKILL_ID, { schweregrad: 'fehler', min: 750, persoenlichAnpassbar: true })], NUR),
    );
    expect(out.skills[0]!.vorgaben?.wortanzahl).toEqual({
      schweregrad: 'fehler', min: 400, max: 500, persoenlichAnpassbar: true,
    });
  });

  it('ein B mit EIGENEN Zahlen behält sie — die 750-Erkennung ist byte-genau', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(
      file([mitWort(AUSGANGSLAGE_SKILL_ID, { schweregrad: 'hinweis', min: 750, max: 900 })], NUR),
    );
    expect(out.skills[0]!.vorgaben?.wortanzahl).toEqual({ schweregrad: 'fehler', min: 750, max: 900 });
  });

  it('bereits `fehler` → der Skill kommt unverändert zurück (nur der Marker wird notiert)', () => {
    const vorher = mitWort(RISIKEN_SKILL_ID, { schweregrad: 'fehler', min: 300, max: 350 });
    const { file: out } = reconcileEinmaligeAktivierungen(file([vorher], NUR));
    expect(out.skills[0]).toEqual(vorher);
  });

  it('Skill ohne Wortanzahl-Vorgabe bleibt unberührt', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(
      file([skill(RISIKEN_SKILL_ID, { vorgaben: { keineAufzaehlungen: { schweregrad: 'fehler' } } })], NUR),
    );
    expect(out.skills[0]!.vorgaben?.wortanzahl).toBeUndefined();
  });

  it('fremde Skills bleiben unberührt', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(
      file([mitWort(MARKT_SKILL_ID, { schweregrad: 'hinweis', min: 300, max: 350 })], NUR),
    );
    expect(out.skills[0]!.vorgaben?.wortanzahl?.schweregrad).toBe('hinweis');
  });

  it('läuft nur einmal: gesetzter Marker lässt den Hinweis stehen', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(
      file([mitWort(RISIKEN_SKILL_ID, { schweregrad: 'hinweis', min: 300, max: 350 })], ALLE_MARKER),
    );
    expect(geaendert).toBe(false);
    expect(out.skills[0]!.vorgaben?.wortanzahl?.schweregrad).toBe('hinweis');
  });

  it('der Seed selbst führt B und C als `fehler` — sonst zöge ein frischer Share nach', () => {
    for (const id of [AUSGANGSLAGE_SKILL_ID, RISIKEN_SKILL_ID]) {
      const s = SEED_SKILLS_BG.find(x => x.id === id)!;
      expect(s.vorgaben?.wortanzahl?.schweregrad, id).toBe('fehler');
    }
  });
});

/**
 * Gemessen an 224 echten Abschnitts-Texten aus den Eval-Läufen: JEDER B-Lauf trug drei
 * Markdown-Überschriften im finalen Text, obwohl der Prompt „keine Zwischenüberschriften"
 * verlangt. `keine_aufzaehlungen` sucht Listen-Marker und ließ sie durch — bis in den
 * DOCX-Export.
 */
describe('A–G: keine Überschriften im Fließtext', () => {
  const NUR = ausser(GA_UEBERSCHRIFTEN_MIGRATION);

  it('ergänzt die Bindung an einem Gutachten-Abschnitt, der sie noch nicht trägt', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(
      file([skill(RISIKEN_SKILL_ID, { regelIds: ['seed-passiv-stil'] })], NUR),
    );
    expect(geaendert).toBe(true);
    expect(out.skills[0]!.regelIds).toEqual(['seed-passiv-stil', UEBERSCHRIFTEN_REGEL_ID]);
  });

  it('bindet nicht doppelt', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(
      file([skill(RISIKEN_SKILL_ID, { regelIds: [UEBERSCHRIFTEN_REGEL_ID] })], NUR),
    );
    expect(out.skills[0]!.regelIds).toEqual([UEBERSCHRIFTEN_REGEL_ID]);
  });

  it('fasst Nicht-Gutachten-Skills nicht an', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(
      file([skill('anfrage-metadaten', { regelIds: [] })], NUR),
    );
    expect(out.skills[0]!.regelIds).toEqual([]);
  });

  it('läuft nur einmal: gesetzter Marker lässt die fehlende Bindung stehen', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(
      file([skill(RISIKEN_SKILL_ID, { regelIds: [] })], ALLE_MARKER),
    );
    expect(geaendert).toBe(false);
    expect(out.skills[0]!.regelIds).toEqual([]);
  });

  it('JEDER Gutachten-Abschnitt im Seed trägt die Regel — auch E und F', () => {
    const gaIds = new Set(ZIM_EP_DEF.steps.map(s => s.skillId));
    const abschnitte = SEED_REGISTRY.skills.filter(s => gaIds.has(s.id));
    expect(abschnitte.length).toBe(7);
    for (const s of abschnitte) {
      expect(s.regelIds, s.id).toContain(UEBERSCHRIFTEN_REGEL_ID);
    }
  });

  it('die Regel selbst steht im Seed und ist aktiv', () => {
    const r = SEED_REGISTRY.regeln.find(x => x.id === UEBERSCHRIFTEN_REGEL_ID);
    expect(r?.typ).toBe('keine_ueberschriften');
    expect(r?.aktiv).toBe(true);
    // Bewusst `hinweis`: ein `fehler` löste den `neu`-Auto-Retry aus und verwürfe einen
    // sonst brauchbaren Abschnitt. Die Verschärfung braucht eine Messung.
    expect(r?.schweregrad).toBe('hinweis');
  });
});
