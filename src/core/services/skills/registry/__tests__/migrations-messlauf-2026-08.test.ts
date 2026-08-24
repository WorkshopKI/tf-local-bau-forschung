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
  ZIM_EP_DEF,
  abschnittTemplate,
} from '../seed';
import type { SkillRecord, SkillRegistryFile, WorkflowDef, WorkflowStep } from '../types';

const ALLE_MARKER = [
  ANFRAGE_ANON_AKTIV_MIGRATION, GA_BELEG_KONTRAKT_MIGRATION, GA_BELEG_KONTRAKT_REVERT_MIGRATION,
  AUFBEREITUNG_ZAHLEN_MAXTOKENS_MIGRATION, AUFBEREITUNG_STECKBRIEF_MAXTOKENS_MIGRATION,
  GA_RISIKEN_ENTWURF_MIGRATION, GA_UMFANG_DEDUP_MIGRATION, GA_UMFANG_DEDUP_CD_MIGRATION,
  GA_PFLICHT_ANFANG_KLAR_MIGRATION, ANFRAGE_ANON_KLAR_MIGRATION, SKILL_VORGABEN_MIGRATION,
  GA_INTERPUNKTION_MIGRATION, AUFBEREITUNG_DR_STICHWORTE_MIGRATION,
  GA_TEILSTRUKTUR_ENTFERNEN_MIGRATION, GA_C_FUENF_RISIKEN_MIGRATION,
  GA_A_UMFANG_KURATIERT_MIGRATION, GA_EF_VORGABEN_MIGRATION, GA_EP_AUTO_RETRY_MIGRATION,
  GA_A_ZEICHEN_HERKUNFT_MIGRATION, GA_FACHPRUEFER_MIGRATION, GA_A_VEROEFFENTLICHUNG_MIGRATION,
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
