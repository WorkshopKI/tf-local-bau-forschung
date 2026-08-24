/**
 * Einmalige, marker-gesicherte Registry-Migrationen (`reconcileEinmaligeAktivierungen`).
 * Kern-Invariante: jede Migration läuft GENAU EINMAL pro Share (Marker), respektiert
 * spätere bewusste Kurator-Änderungen und überschreibt kuratierte Edits NIE.
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
} from '../migrations';
import {
  AUFBEREITUNG_RECHERCHE_PROMPT_SKILL,
  AUFBEREITUNG_RECHERCHE_PROMPT_SKILL_ID,
  RECHERCHE_PROMPT_SYSTEM_ALT,
  RECHERCHE_PROMPT_TEMPLATE_ALT,
} from '../aufbereitung-recherche-prompt.seed';
import {
  ANFRAGE_ANONYMISIEREN_SKILL_ID,
  ANFRAGE_ANONYMISIEREN_SKILL,
  ANON_SYSTEM_PROMPT_ALT,
  ANON_PROMPT_TEMPLATE_ALT,
} from '../anfrage-anonymisieren.seed';
import { AUFBEREITUNG_ZAHLEN_SKILL_ID } from '../aufbereitung-zahlen.seed';
import { AUFBEREITUNG_STECKBRIEF_SKILL_ID } from '../aufbereitung-steckbrief.seed';
import {
  KURZFASSUNG_SKILL_ID,
  AUSGANGSLAGE_SKILL_ID,
  RISIKEN_SKILL_ID,
  buildKurzfassungPrompt,
  mitVeroeffentlichungsKontrakt,
  abschnittTemplate,
  B_ABSCHNITT_OPTS_TEILE_ABSOLUT,
  B_ABSCHNITT_OPTS_UMFANG_ALT,
  C_ABSCHNITT_OPTS_ALT,
  C_ABSCHNITT_OPTS_NEU,
  C_ABSCHNITT_OPTS_NEU_UMFANG_ALT,
  C_ABSCHNITT_OPTS,
  MARKT_SKILL_ID,
  D_ABSCHNITT_OPTS,
  D_ABSCHNITT_OPTS_UMFANG_ALT,
  KOMPETENZ_SKILL_ID,
  G_ABSCHNITT_OPTS,
  G_ABSCHNITT_OPTS_PFLICHT_ALT,
  INTERPUNKTION_REGEL_ID,
  A_ZWECK_BLOCK,
  A_AUFGABE_ZEILE,
  A_BESCHREIBUNG,
  A_BESCHREIBUNG_ALT,
} from '../seed';
import {
  GA_LEKTOR_SKILL_ID,
  GA_LEKTOR_PROMPT_TEMPLATE_ALT,
  SEED_GA_LEKTOR_SKILL,
} from '../ga-lektor.seed';
import type { QualitaetsRegel, SkillRecord, SkillRegistryFile } from '../types';

function skill(id: string, over: Partial<SkillRecord> = {}): SkillRecord {
  return {
    id, name: id, beschreibung: '', version: 1, promptTemplate: 'P',
    modifiers: { neu: '', kuerzer: '', laenger: '' }, regelIds: [], slots: [],
    geaendert_am: 't', ...over,
  };
}
function file(skills: SkillRecord[], marker?: string[]): SkillRegistryFile {
  return { version: 1, updated_at: 't', skills, regeln: [], ...(marker ? { angewandteMigrationen: marker } : {}) };
}
const anon = (aktiv: boolean | undefined): SkillRecord =>
  skill(ANFRAGE_ANONYMISIEREN_SKILL_ID, aktiv === undefined ? {} : { aktiv });

// Die jeweils ANDEREN Marker vorbelegen, um genau EINE Migration zu isolieren.
const ALLE_MARKER = [ANFRAGE_ANON_AKTIV_MIGRATION, GA_BELEG_KONTRAKT_MIGRATION, GA_BELEG_KONTRAKT_REVERT_MIGRATION, AUFBEREITUNG_ZAHLEN_MAXTOKENS_MIGRATION, AUFBEREITUNG_STECKBRIEF_MAXTOKENS_MIGRATION, GA_RISIKEN_ENTWURF_MIGRATION, GA_UMFANG_DEDUP_MIGRATION, GA_UMFANG_DEDUP_CD_MIGRATION, GA_PFLICHT_ANFANG_KLAR_MIGRATION, ANFRAGE_ANON_KLAR_MIGRATION, SKILL_VORGABEN_MIGRATION, GA_INTERPUNKTION_MIGRATION, AUFBEREITUNG_DR_STICHWORTE_MIGRATION, GA_TEILSTRUKTUR_ENTFERNEN_MIGRATION, GA_C_FUENF_RISIKEN_MIGRATION, GA_A_UMFANG_KURATIERT_MIGRATION, GA_EF_VORGABEN_MIGRATION, GA_EP_AUTO_RETRY_MIGRATION, GA_A_ZEICHEN_HERKUNFT_MIGRATION, GA_FACHPRUEFER_MIGRATION, GA_A_VEROEFFENTLICHUNG_MIGRATION, GA_B_TEIL_ANTEILE_MIGRATION, GA_C_FINAL_UMFANG_MIGRATION];
const NUR_ANON = ALLE_MARKER.filter(m => m !== ANFRAGE_ANON_AKTIV_MIGRATION);
const NUR_BELEG = ALLE_MARKER.filter(m => m !== GA_BELEG_KONTRAKT_MIGRATION);
const NUR_BELEG_REVERT = ALLE_MARKER.filter(m => m !== GA_BELEG_KONTRAKT_REVERT_MIGRATION);
const NUR_ZAHLEN = ALLE_MARKER.filter(m => m !== AUFBEREITUNG_ZAHLEN_MAXTOKENS_MIGRATION);
const NUR_STECKBRIEF = ALLE_MARKER.filter(m => m !== AUFBEREITUNG_STECKBRIEF_MAXTOKENS_MIGRATION);
const NUR_RISIKEN = ALLE_MARKER.filter(m => m !== GA_RISIKEN_ENTWURF_MIGRATION);
const NUR_UMFANG = ALLE_MARKER.filter(m => m !== GA_UMFANG_DEDUP_MIGRATION);
const NUR_UMFANG_CD = ALLE_MARKER.filter(m => m !== GA_UMFANG_DEDUP_CD_MIGRATION);
const NUR_PFLICHT_ANFANG = ALLE_MARKER.filter(m => m !== GA_PFLICHT_ANFANG_KLAR_MIGRATION);
const NUR_ANON_KLAR = ALLE_MARKER.filter(m => m !== ANFRAGE_ANON_KLAR_MIGRATION);
const NUR_DR_STICHWORTE = ALLE_MARKER.filter(m => m !== AUFBEREITUNG_DR_STICHWORTE_MIGRATION);
const NUR_TEILSTRUKTUR = ALLE_MARKER.filter(m => m !== GA_TEILSTRUKTUR_ENTFERNEN_MIGRATION);

const OLD_A = buildKurzfassungPrompt(false);
const NEW_A = buildKurzfassungPrompt(true);
const OLD_B = abschnittTemplate({ ...B_ABSCHNITT_OPTS_TEILE_ABSOLUT });
const NEW_B = abschnittTemplate({ ...B_ABSCHNITT_OPTS_TEILE_ABSOLUT, belegKontrakt: true });
// Umfang single-source: Vor-Dedup-Wortlaut (feste Zahl) vs. de-dupliziert (= Live-Seed).
const ALT_A_UMFANG = buildKurzfassungPrompt(false, true);
const DEDUP_A = buildKurzfassungPrompt(false);
const ALT_B_UMFANG = abschnittTemplate({ ...B_ABSCHNITT_OPTS_UMFANG_ALT });
const DEDUP_B = abschnittTemplate({ ...B_ABSCHNITT_OPTS_TEILE_ABSOLUT });
// Folgepaket C + D: Vor-Dedup-Wortlaut (feste 300–350 Wörter) vs. de-dupliziert (= Live-Seed).
const ALT_C_UMFANG = abschnittTemplate({ ...C_ABSCHNITT_OPTS_NEU_UMFANG_ALT });
const DEDUP_C = abschnittTemplate({ ...C_ABSCHNITT_OPTS_NEU });
const ALT_D_UMFANG = abschnittTemplate({ ...D_ABSCHNITT_OPTS_UMFANG_ALT });
const DEDUP_D = abschnittTemplate({ ...D_ABSCHNITT_OPTS });
const OLD_C = abschnittTemplate({ ...C_ABSCHNITT_OPTS_ALT });
const OLD_C_OHNE_STIL = abschnittTemplate({ ...C_ABSCHNITT_OPTS_ALT, stilbeispiel: undefined });
const NEW_C = abschnittTemplate({ ...C_ABSCHNITT_OPTS_NEU });

/**
 * Diese Liste wird von Hand gepflegt und von JEDEM „läuft nur einmal"-Test benutzt.
 * Fehlt darin ein Marker, laufen dessen Migration in allen diesen Tests ungewollt mit
 * und zehn Tests schlagen mit „expected true to be false" fehl — eine Meldung, die
 * nirgends sagt, dass eine Liste unvollständig ist. Zweimal passiert (2026-08),
 * deshalb hier EIN Test, der es direkt sagt.
 */
describe('ALLE_MARKER ist vollständig', () => {
  it('deckt jede registrierte Migration ab', () => {
    const gelaufen = reconcileEinmaligeAktivierungen(
      { version: 1, updated_at: 't', skills: [], regeln: [] },
    ).file.angewandteMigrationen ?? [];
    expect([...gelaufen].sort()).toEqual([...ALLE_MARKER].sort());
  });
});

describe('reconcile — Anonymisierer-Freischaltung', () => {
  it('Bestands-Share: aktiv:false → true, Marker gesetzt, geaendert', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(file([anon(false)], NUR_ANON));
    expect(geaendert).toBe(true);
    expect(out.skills[0]?.aktiv).toBe(true);
    expect(out.angewandteMigrationen).toContain(ANFRAGE_ANON_AKTIV_MIGRATION);
  });

  it('respektiert spätere Deaktivierung: Marker gesetzt → bleibt false', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(
      file([anon(false)], ALLE_MARKER),
    );
    expect(geaendert).toBe(false);
    expect(out.skills[0]?.aktiv).toBe(false);
  });

  it('bereits aktiv: nur Marker setzen, Skill bleibt true', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(file([anon(true)], NUR_ANON));
    expect(geaendert).toBe(true);
    expect(out.skills[0]?.aktiv).toBe(true);
  });
});

describe('reconcile — Beleg-Kontrakt-Rückbau A + B (Reasoning-Loop, 2026-07)', () => {
  const kontraktA = skill(KURZFASSUNG_SKILL_ID, { promptTemplate: NEW_A, version: 2 });
  const kontraktB = skill(AUSGANGSLAGE_SKILL_ID, { promptTemplate: NEW_B, version: 2 });

  it('Kontrakt-Template A + B → zurück auf Alt-Template, version ≥ 2, Marker gesetzt', () => {
    const { file: out, geaendert, angewandt } = reconcileEinmaligeAktivierungen(
      file([kontraktA, kontraktB], NUR_BELEG_REVERT),
    );
    expect(geaendert).toBe(true);
    expect(angewandt).toContain(GA_BELEG_KONTRAKT_REVERT_MIGRATION);
    const a = out.skills.find(s => s.id === KURZFASSUNG_SKILL_ID)!;
    const b = out.skills.find(s => s.id === AUSGANGSLAGE_SKILL_ID)!;
    expect(a.promptTemplate).toBe(OLD_A);
    expect(a.version).toBe(2);
    expect(b.promptTemplate).toBe(OLD_B);
    expect(b.version).toBe(2);
  });

  it('KURATIERT editiertes Kontrakt-A wird NIEMALS überschrieben', () => {
    const editedA = skill(KURZFASSUNG_SKILL_ID, { promptTemplate: NEW_A + '\nKurator-Zusatz', version: 3 });
    const { file: out } = reconcileEinmaligeAktivierungen(file([editedA], NUR_BELEG_REVERT));
    const a = out.skills.find(s => s.id === KURZFASSUNG_SKILL_ID)!;
    expect(a.promptTemplate).toBe(NEW_A + '\nKurator-Zusatz'); // unverändert
    expect(a.version).toBe(3);
  });

  it('bereits zurückgebaut (Alt-Template) bleibt unberührt', () => {
    const altA = skill(KURZFASSUNG_SKILL_ID, { promptTemplate: OLD_A, version: 2 });
    const { file: out } = reconcileEinmaligeAktivierungen(file([altA], NUR_BELEG_REVERT));
    expect(out.skills[0]?.promptTemplate).toBe(OLD_A);
    expect(out.skills[0]?.version).toBe(2);
  });

  it('Vorwärts-Rollout ist inert (No-op): pristine Alt-Template bleibt Alt-Template', () => {
    // Nur der Vorwärts-Marker fehlt → allein applyBelegKontrakt (No-op) läuft.
    const altA = skill(KURZFASSUNG_SKILL_ID, { promptTemplate: OLD_A, version: 1 });
    const { file: out } = reconcileEinmaligeAktivierungen(file([altA], NUR_BELEG));
    expect(out.skills[0]?.promptTemplate).toBe(OLD_A); // NICHT auf NEW_A gehoben
  });

  it('idempotent: zweiter Lauf ist No-op', () => {
    const erst = reconcileEinmaligeAktivierungen(file([kontraktA], NUR_BELEG_REVERT));
    const zweit = reconcileEinmaligeAktivierungen(erst.file);
    expect(zweit.geaendert).toBe(false);
    expect(zweit.file.skills[0]?.promptTemplate).toBe(OLD_A);
  });

  it('fremde Skills unangetastet; Marker einmalig gesetzt', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(file([skill('x', { promptTemplate: 'Y' })], NUR_BELEG_REVERT));
    expect(out.skills.find(s => s.id === 'x')?.promptTemplate).toBe('Y');
    expect(out.angewandteMigrationen).toContain(GA_BELEG_KONTRAKT_REVERT_MIGRATION);
  });
});

describe('reconcile — Zahlen-Inventar maxTokens 2048 → 4096', () => {
  const zahlen = (over: Partial<SkillRecord> = {}): SkillRecord =>
    skill(AUFBEREITUNG_ZAHLEN_SKILL_ID, { maxTokens: 2048, version: 1, aktiv: false, ...over });

  it('pristine (maxTokens 2048) → 4096 + version ≥ 2, Marker gesetzt', () => {
    const { file: out, geaendert, angewandt } = reconcileEinmaligeAktivierungen(file([zahlen()], NUR_ZAHLEN));
    expect(geaendert).toBe(true);
    expect(angewandt).toContain(AUFBEREITUNG_ZAHLEN_MAXTOKENS_MIGRATION);
    const z = out.skills.find(s => s.id === AUFBEREITUNG_ZAHLEN_SKILL_ID)!;
    expect(z.maxTokens).toBe(4096);
    expect(z.version).toBe(2);
  });

  it('kurator-geänderter Wert (≠ 2048) bleibt UNBERÜHRT', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(file([zahlen({ maxTokens: 8192, version: 3 })], NUR_ZAHLEN));
    const z = out.skills.find(s => s.id === AUFBEREITUNG_ZAHLEN_SKILL_ID)!;
    expect(z.maxTokens).toBe(8192);
    expect(z.version).toBe(3);
  });

  it('frische Installation (bereits 4096) bleibt unberührt', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(file([zahlen({ maxTokens: 4096, version: 2 })], NUR_ZAHLEN));
    expect(out.skills.find(s => s.id === AUFBEREITUNG_ZAHLEN_SKILL_ID)?.maxTokens).toBe(4096);
  });

  it('idempotent: zweiter Lauf ist No-op (Marker gesetzt)', () => {
    const erst = reconcileEinmaligeAktivierungen(file([zahlen()], NUR_ZAHLEN));
    const zweit = reconcileEinmaligeAktivierungen(erst.file);
    expect(zweit.geaendert).toBe(false);
    expect(zweit.file.skills.find(s => s.id === AUFBEREITUNG_ZAHLEN_SKILL_ID)?.maxTokens).toBe(4096);
  });

  it('Skill abwesend → nur Marker, kein Fehler', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(file([skill('x')], NUR_ZAHLEN));
    expect(geaendert).toBe(true);
    expect(out.angewandteMigrationen).toContain(AUFBEREITUNG_ZAHLEN_MAXTOKENS_MIGRATION);
  });
});

describe('reconcile — Steckbrief maxTokens 2048 → 4096', () => {
  const steckbrief = (over: Partial<SkillRecord> = {}): SkillRecord =>
    skill(AUFBEREITUNG_STECKBRIEF_SKILL_ID, { maxTokens: 2048, version: 1, aktiv: false, ...over });

  it('pristine (maxTokens 2048) → 4096 + version ≥ 2, Marker gesetzt', () => {
    const { file: out, geaendert, angewandt } = reconcileEinmaligeAktivierungen(file([steckbrief()], NUR_STECKBRIEF));
    expect(geaendert).toBe(true);
    expect(angewandt).toContain(AUFBEREITUNG_STECKBRIEF_MAXTOKENS_MIGRATION);
    const s = out.skills.find(x => x.id === AUFBEREITUNG_STECKBRIEF_SKILL_ID)!;
    expect(s.maxTokens).toBe(4096);
    expect(s.version).toBe(2);
  });

  it('kurator-geänderter Wert (≠ 2048) bleibt UNBERÜHRT', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(file([steckbrief({ maxTokens: 8192, version: 3 })], NUR_STECKBRIEF));
    const s = out.skills.find(x => x.id === AUFBEREITUNG_STECKBRIEF_SKILL_ID)!;
    expect(s.maxTokens).toBe(8192);
    expect(s.version).toBe(3);
  });

  it('frische Installation (bereits 4096) bleibt unberührt', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(file([steckbrief({ maxTokens: 4096, version: 2 })], NUR_STECKBRIEF));
    expect(out.skills.find(x => x.id === AUFBEREITUNG_STECKBRIEF_SKILL_ID)?.maxTokens).toBe(4096);
  });

  it('idempotent: zweiter Lauf ist No-op (Marker gesetzt)', () => {
    const erst = reconcileEinmaligeAktivierungen(file([steckbrief()], NUR_STECKBRIEF));
    const zweit = reconcileEinmaligeAktivierungen(erst.file);
    expect(zweit.geaendert).toBe(false);
    expect(zweit.file.skills.find(x => x.id === AUFBEREITUNG_STECKBRIEF_SKILL_ID)?.maxTokens).toBe(4096);
  });
});

describe('reconcile — C „Technische Risiken" Entwurf → Fließtext', () => {
  const risiken = (over: Partial<SkillRecord> = {}): SkillRecord =>
    skill(RISIKEN_SKILL_ID, {
      promptTemplate: OLD_C, maxTokens: 2048, version: 1,
      regelIds: ['seed-c-wortanzahl', 'seed-passiv-stil'], ...over,
    });

  it('Alt- vs. Neu-Template: 2 vs. 3 Ausgabe-Abschnitte (Entwurf nur im Neu-Stand)', () => {
    expect(OLD_C).toContain('genau diese zwei Abschnitte');
    expect(OLD_C).not.toContain('### Entwurf');
    expect(NEW_C).toContain('genau diese drei Abschnitte');
    expect(NEW_C).toContain('### Entwurf');
    expect(NEW_C).toContain('### Finaler Text');
    expect(NEW_C).toContain('Lösungsweg');
  });

  it('pristine Alt-Template → Neu-Template, version ≥ 2, maxTokens 4096, neue regelIds', () => {
    const { file: out, geaendert, angewandt } = reconcileEinmaligeAktivierungen(file([risiken()], NUR_RISIKEN));
    expect(geaendert).toBe(true);
    expect(angewandt).toContain(GA_RISIKEN_ENTWURF_MIGRATION);
    const c = out.skills.find(s => s.id === RISIKEN_SKILL_ID)!;
    expect(c.promptTemplate).toBe(NEW_C);
    expect(c.version).toBe(2);
    expect(c.maxTokens).toBe(4096);
    expect(c.regelIds).toEqual(['seed-c-umfang', 'seed-c-keine-aufzaehlungen', 'seed-passiv-stil']);
  });

  it('kuratierter Alt-Stand OHNE Stilbeispiel wird ebenfalls gehoben', () => {
    // Der Share-Snapshot (registry.live.json) trägt kein Stilbeispiel — muss trotzdem greifen.
    expect(OLD_C_OHNE_STIL).not.toBe(OLD_C);
    expect(OLD_C_OHNE_STIL).not.toContain('Stilbeispiel');
    const { file: out } = reconcileEinmaligeAktivierungen(
      file([risiken({ promptTemplate: OLD_C_OHNE_STIL })], NUR_RISIKEN),
    );
    expect(out.skills.find(s => s.id === RISIKEN_SKILL_ID)?.promptTemplate).toBe(NEW_C);
  });

  it('KURATIERT editiertes C wird NIEMALS überschrieben', () => {
    const edited = risiken({ promptTemplate: OLD_C + '\nKurator-Zusatz', version: 3 });
    const { file: out } = reconcileEinmaligeAktivierungen(file([edited], NUR_RISIKEN));
    const c = out.skills.find(s => s.id === RISIKEN_SKILL_ID)!;
    expect(c.promptTemplate).toBe(OLD_C + '\nKurator-Zusatz');
    expect(c.version).toBe(3);
  });

  it('kurator-geänderter maxTokens (≠ 2048) bleibt bei pristine Template erhalten', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(file([risiken({ maxTokens: 8192 })], NUR_RISIKEN));
    expect(out.skills.find(s => s.id === RISIKEN_SKILL_ID)?.maxTokens).toBe(8192);
  });

  it('bereits migriert (Neu-Template) bleibt unberührt', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(file([risiken({ promptTemplate: NEW_C, version: 2 })], NUR_RISIKEN));
    const c = out.skills.find(s => s.id === RISIKEN_SKILL_ID)!;
    expect(c.promptTemplate).toBe(NEW_C);
    expect(c.version).toBe(2);
  });

  it('idempotent: zweiter Lauf ist No-op', () => {
    const erst = reconcileEinmaligeAktivierungen(file([risiken()], NUR_RISIKEN));
    const zweit = reconcileEinmaligeAktivierungen(erst.file);
    expect(zweit.geaendert).toBe(false);
    expect(zweit.file.skills.find(s => s.id === RISIKEN_SKILL_ID)?.promptTemplate).toBe(NEW_C);
  });

  it('Skill abwesend → nur Marker, kein Fehler', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(file([skill('x')], NUR_RISIKEN));
    expect(geaendert).toBe(true);
    expect(out.angewandteMigrationen).toContain(GA_RISIKEN_ENTWURF_MIGRATION);
  });
});

describe('reconcile — Umfang single-source A + B (feste Zahl aus der Prosa)', () => {
  it('Alt- vs. de-dupliziertes Template unterscheiden sich wirklich (kein No-op-by-accident)', () => {
    expect(ALT_A_UMFANG).not.toBe(DEDUP_A);
    expect(ALT_A_UMFANG).toContain('ca. 10 Sätze');
    expect(DEDUP_A).not.toContain('ca. 10 Sätze');
    expect(ALT_B_UMFANG).not.toBe(DEDUP_B);
    expect(ALT_B_UMFANG).toContain('mindestens 750 Wörter');
    expect(DEDUP_B).not.toContain('750 Wörter');
  });

  it('pristine Alt-A/-B (feste Zahl) → de-dupliziert, Marker gesetzt', () => {
    const altA = skill(KURZFASSUNG_SKILL_ID, { promptTemplate: ALT_A_UMFANG, version: 2 });
    const altB = skill(AUSGANGSLAGE_SKILL_ID, { promptTemplate: ALT_B_UMFANG, version: 2 });
    const { file: out, geaendert, angewandt } = reconcileEinmaligeAktivierungen(file([altA, altB], NUR_UMFANG));
    expect(geaendert).toBe(true);
    expect(angewandt).toContain(GA_UMFANG_DEDUP_MIGRATION);
    const a = out.skills.find(s => s.id === KURZFASSUNG_SKILL_ID)!;
    const b = out.skills.find(s => s.id === AUSGANGSLAGE_SKILL_ID)!;
    expect(a.promptTemplate).toBe(DEDUP_A);
    expect(b.promptTemplate).toBe(DEDUP_B);
    expect(a.version).toBe(2);
    expect(b.version).toBe(2);
  });

  it('bereits de-dupliziert bleibt unberührt (No-op)', () => {
    const a = skill(KURZFASSUNG_SKILL_ID, { promptTemplate: DEDUP_A, version: 2 });
    const { file: out } = reconcileEinmaligeAktivierungen(file([a], NUR_UMFANG));
    expect(out.skills[0]?.promptTemplate).toBe(DEDUP_A);
  });

  it('KURATIERT editiertes B (≠ Alt-Wortlaut) wird NIEMALS überschrieben', () => {
    const edited = skill(AUSGANGSLAGE_SKILL_ID, { promptTemplate: ALT_B_UMFANG + '\nKurator-Zusatz', version: 3 });
    const { file: out } = reconcileEinmaligeAktivierungen(file([edited], NUR_UMFANG));
    const b = out.skills.find(s => s.id === AUSGANGSLAGE_SKILL_ID)!;
    expect(b.promptTemplate).toBe(ALT_B_UMFANG + '\nKurator-Zusatz');
    expect(b.version).toBe(3);
  });

  it('idempotent: zweiter Lauf ist No-op', () => {
    const altB = skill(AUSGANGSLAGE_SKILL_ID, { promptTemplate: ALT_B_UMFANG, version: 2 });
    const erst = reconcileEinmaligeAktivierungen(file([altB], NUR_UMFANG));
    const zweit = reconcileEinmaligeAktivierungen(erst.file);
    expect(zweit.geaendert).toBe(false);
    expect(zweit.file.skills.find(s => s.id === AUSGANGSLAGE_SKILL_ID)?.promptTemplate).toBe(DEDUP_B);
  });

  it('Skill abwesend → nur Marker, kein Fehler', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(file([skill('x')], NUR_UMFANG));
    expect(geaendert).toBe(true);
    expect(out.angewandteMigrationen).toContain(GA_UMFANG_DEDUP_MIGRATION);
  });
});

describe('reconcile — Umfang single-source C + D (Folgepaket)', () => {
  it('Alt- vs. de-dupliziertes Template unterscheiden sich wirklich', () => {
    expect(ALT_C_UMFANG).not.toBe(DEDUP_C);
    expect(ALT_C_UMFANG).toContain('300–350 Wörter');
    expect(DEDUP_C).not.toContain('300–350 Wörter');
    expect(ALT_D_UMFANG).not.toBe(DEDUP_D);
    expect(ALT_D_UMFANG).toContain('300–350 Wörter');
    expect(DEDUP_D).not.toContain('300–350 Wörter');
    // C behält die 3-Abschnitt-Struktur + Lösungsweg-Fokus:
    expect(DEDUP_C).toContain('### Entwurf');
    expect(DEDUP_C).toContain('Lösungsweg');
  });

  it('pristine Alt-C/-D (feste Zahl) → de-dupliziert, Marker gesetzt', () => {
    const altC = skill(RISIKEN_SKILL_ID, { promptTemplate: ALT_C_UMFANG, version: 2 });
    const altD = skill(MARKT_SKILL_ID, { promptTemplate: ALT_D_UMFANG, version: 1 });
    const { file: out, geaendert, angewandt } = reconcileEinmaligeAktivierungen(file([altC, altD], NUR_UMFANG_CD));
    expect(geaendert).toBe(true);
    expect(angewandt).toContain(GA_UMFANG_DEDUP_CD_MIGRATION);
    expect(out.skills.find(s => s.id === RISIKEN_SKILL_ID)?.promptTemplate).toBe(DEDUP_C);
    expect(out.skills.find(s => s.id === MARKT_SKILL_ID)?.promptTemplate).toBe(DEDUP_D);
  });

  it('bereits de-dupliziert bleibt unberührt (No-op)', () => {
    const c = skill(RISIKEN_SKILL_ID, { promptTemplate: DEDUP_C, version: 2 });
    const { file: out } = reconcileEinmaligeAktivierungen(file([c], NUR_UMFANG_CD));
    expect(out.skills[0]?.promptTemplate).toBe(DEDUP_C);
  });
});

// Der zitierte, mit „…" abgeschnittene Pflicht-Anfang war für das Modell nicht auflösbar
// (Reasoning-Loop bis zum Budget-Ende, Lauf ohne Antwort). Neu: eigener, zeilenbegrenzter
// Block mit explizitem Hinweis auf das absichtliche Satz-Ende.
describe('reconcile — Pflicht-Anfang G aus der zitierten Inline-Regel lösen', () => {
  const ALT_G = abschnittTemplate({ ...G_ABSCHNITT_OPTS_PFLICHT_ALT });
  const ALT_G_OHNE_STIL = abschnittTemplate({ ...G_ABSCHNITT_OPTS_PFLICHT_ALT, stilbeispiel: undefined });
  const NEU_G = abschnittTemplate({ ...G_ABSCHNITT_OPTS });

  it('der Alt-Stand trägt die unerfüllbare Anweisung, der Neu-Stand nicht', () => {
    expect(ALT_G).toContain('**exakt** mit: „');
    expect(ALT_G).toContain('im Bereich …"');
    expect(NEU_G).not.toContain('**exakt** mit: „');
    // Der Pflicht-Anfang darf nirgends mehr zitiert-und-elidiert auftauchen; andere
    // „…"-Vorkommen (Grundsatz-Regeln) sind unbedenklich, weil sie nichts Wörtliches fordern.
    expect(NEU_G).not.toContain('im Bereich …');
  });

  it('der Neu-Stand nennt den Wortlaut unzitiert auf eigener Zeile + löst das Satz-Ende auf', () => {
    expect(NEU_G).toContain('## Pflicht-Anfang des finalen Textes');
    // Der Wortlaut steht als eigene Zeile — genau das macht seine Grenze eindeutig.
    expect(NEU_G.split('\n')).toContain(
      'Das Vorhaben wird sehr positive Auswirkungen auf das FuE-Potenzial und Know-how der '
      + 'Antragsteller haben. Im Unternehmen wird die Technologiekompetenz im Bereich');
    expect(NEU_G).toContain('endet absichtlich mitten im Satz');
  });

  it('pristine Alt-G (mit Stilbeispiel) → neuer Block, Marker gesetzt, version ≥ 2', () => {
    const altG = skill(KOMPETENZ_SKILL_ID, { promptTemplate: ALT_G, version: 1 });
    const { file: out, geaendert, angewandt } = reconcileEinmaligeAktivierungen(file([altG], NUR_PFLICHT_ANFANG));
    expect(geaendert).toBe(true);
    expect(angewandt).toContain(GA_PFLICHT_ANFANG_KLAR_MIGRATION);
    expect(out.skills[0]?.promptTemplate).toBe(NEU_G);
    expect(out.skills[0]?.version).toBe(2);
  });

  it('pristine Alt-G OHNE Stilbeispiel (kuratierter Share-Snapshot) wird ebenfalls gehoben', () => {
    const altG = skill(KOMPETENZ_SKILL_ID, { promptTemplate: ALT_G_OHNE_STIL, version: 1 });
    const { file: out } = reconcileEinmaligeAktivierungen(file([altG], NUR_PFLICHT_ANFANG));
    expect(out.skills[0]?.promptTemplate).toBe(NEU_G);
  });

  it('kuratiert editiertes G bleibt UNBERÜHRT', () => {
    const eigen = `${ALT_G}\n\nHauseigene Ergänzung.`;
    const g = skill(KOMPETENZ_SKILL_ID, { promptTemplate: eigen, version: 3 });
    const { file: out } = reconcileEinmaligeAktivierungen(file([g], NUR_PFLICHT_ANFANG));
    expect(out.skills[0]?.promptTemplate).toBe(eigen);
    expect(out.skills[0]?.version).toBe(3);
  });

  it('bereits migriertes G bleibt unberührt (No-op) und senkt die Version nicht', () => {
    const g = skill(KOMPETENZ_SKILL_ID, { promptTemplate: NEU_G, version: 5 });
    const { file: out } = reconcileEinmaligeAktivierungen(file([g], NUR_PFLICHT_ANFANG));
    expect(out.skills[0]?.promptTemplate).toBe(NEU_G);
    expect(out.skills[0]?.version).toBe(5);
  });

  it('die Abschnitte B–F bleiben byte-identisch (pflichtAnfang undefined ändert nichts)', () => {
    // Sonst zöge dieser Fix die Migrations-Erkennung aller anderen Abschnitte mit.
    expect(abschnittTemplate({ ...B_ABSCHNITT_OPTS_TEILE_ABSOLUT })).toBe(DEDUP_B);
    expect(abschnittTemplate({ ...C_ABSCHNITT_OPTS_NEU })).toBe(DEDUP_C);
    expect(abschnittTemplate({ ...D_ABSCHNITT_OPTS })).toBe(DEDUP_D);
  });

  it('KURATIERT editiertes D (≠ Alt-Wortlaut) wird NIEMALS überschrieben', () => {
    const edited = skill(MARKT_SKILL_ID, { promptTemplate: ALT_D_UMFANG + '\nKurator-Zusatz', version: 2 });
    const { file: out } = reconcileEinmaligeAktivierungen(file([edited], NUR_UMFANG_CD));
    expect(out.skills.find(s => s.id === MARKT_SKILL_ID)?.promptTemplate).toBe(ALT_D_UMFANG + '\nKurator-Zusatz');
  });

  it('idempotent: zweiter Lauf ist No-op', () => {
    const altD = skill(MARKT_SKILL_ID, { promptTemplate: ALT_D_UMFANG, version: 1 });
    const erst = reconcileEinmaligeAktivierungen(file([altD], NUR_UMFANG_CD));
    const zweit = reconcileEinmaligeAktivierungen(erst.file);
    expect(zweit.geaendert).toBe(false);
    expect(zweit.file.skills.find(s => s.id === MARKT_SKILL_ID)?.promptTemplate).toBe(DEDUP_D);
  });
});

// Prompt-Audit 2026-07: Zielkonflikt, WÖRTLICH-Scope und Echtwerte in der Feld-Schablone.
describe('reconcile — Anonymisierer-Prompt klären', () => {
  const altAnon = (extra: Partial<SkillRecord> = {}): SkillRecord => ({
    ...skill(ANFRAGE_ANONYMISIEREN_SKILL_ID, { version: 2 }),
    systemPrompt: ANON_SYSTEM_PROMPT_ALT,
    promptTemplate: ANON_PROMPT_TEMPLATE_ALT,
    ...extra,
  });

  it('der Alt-Stand trägt die drei Defekte, der Neu-Stand keinen davon', () => {
    expect(ANON_PROMPT_TEMPLATE_ALT).toContain('Dr. Schmidt');
    expect(ANON_SYSTEM_PROMPT_ALT).toContain('in `mapping` wie in `verallgemeinerungen`');
    expect(ANFRAGE_ANONYMISIEREN_SKILL.promptTemplate).not.toContain('Dr. Schmidt');
    expect(ANFRAGE_ANONYMISIEREN_SKILL.systemPrompt).not.toContain('in `mapping` wie in `verallgemeinerungen`');
  });

  it('pristine v2 → neuer Prompt, Marker gesetzt, version ≥ 3', () => {
    const { file: out, geaendert, angewandt } = reconcileEinmaligeAktivierungen(file([altAnon()], NUR_ANON_KLAR));
    expect(geaendert).toBe(true);
    expect(angewandt).toContain(ANFRAGE_ANON_KLAR_MIGRATION);
    expect(out.skills[0]?.promptTemplate).toBe(ANFRAGE_ANONYMISIEREN_SKILL.promptTemplate);
    expect(out.skills[0]?.systemPrompt).toBe(ANFRAGE_ANONYMISIEREN_SKILL.systemPrompt);
    expect(out.skills[0]?.version).toBe(3);
  });

  it('kuratiert editierter System-Prompt bleibt UNBERÜHRT (Guard über BEIDE Felder)', () => {
    const eigen = altAnon({ systemPrompt: `${ANON_SYSTEM_PROMPT_ALT}\nHauseigene Regel.` });
    const { file: out } = reconcileEinmaligeAktivierungen(file([eigen], NUR_ANON_KLAR));
    expect(out.skills[0]?.systemPrompt).toBe(`${ANON_SYSTEM_PROMPT_ALT}\nHauseigene Regel.`);
    expect(out.skills[0]?.promptTemplate).toBe(ANON_PROMPT_TEMPLATE_ALT);
  });

  it('kuratiert editiertes Template bleibt UNBERÜHRT', () => {
    const eigen = altAnon({ promptTemplate: `${ANON_PROMPT_TEMPLATE_ALT}\nZusatz.` });
    const { file: out } = reconcileEinmaligeAktivierungen(file([eigen], NUR_ANON_KLAR));
    expect(out.skills[0]?.promptTemplate).toBe(`${ANON_PROMPT_TEMPLATE_ALT}\nZusatz.`);
  });

  it('`aktiv` wird nicht angefasst — die Freischaltung bleibt eigene Entscheidung', () => {
    const gesperrt = altAnon({ aktiv: false });
    const { file: out } = reconcileEinmaligeAktivierungen(file([gesperrt], NUR_ANON_KLAR));
    expect(out.skills[0]?.aktiv).toBe(false);
    expect(out.skills[0]?.promptTemplate).toBe(ANFRAGE_ANONYMISIEREN_SKILL.promptTemplate);
  });

  it('idempotent: zweiter Lauf ist No-op und senkt die Version nicht', () => {
    const erst = reconcileEinmaligeAktivierungen(file([altAnon({ version: 7 })], NUR_ANON_KLAR));
    const zweit = reconcileEinmaligeAktivierungen(erst.file);
    expect(zweit.geaendert).toBe(false);
    expect(zweit.file.skills[0]?.version).toBe(7);
  });
});

describe('reconcile — alle Migrationen zusammen', () => {
  it('frischer Share: alle Marker gesetzt (in Reihenfolge), geaendert', () => {
    const { file: out, geaendert, angewandt } = reconcileEinmaligeAktivierungen(
      file([
        anon(false),
        skill(KURZFASSUNG_SKILL_ID, { promptTemplate: OLD_A }),
        skill(RISIKEN_SKILL_ID, { promptTemplate: OLD_C, maxTokens: 2048, version: 1 }),
        skill(AUFBEREITUNG_ZAHLEN_SKILL_ID, { maxTokens: 2048, version: 1 }),
        skill(AUFBEREITUNG_STECKBRIEF_SKILL_ID, { maxTokens: 2048, version: 1 }),
      ]),
    );
    expect(geaendert).toBe(true);
    expect(angewandt).toEqual([ANFRAGE_ANON_AKTIV_MIGRATION, GA_BELEG_KONTRAKT_MIGRATION, AUFBEREITUNG_ZAHLEN_MAXTOKENS_MIGRATION, AUFBEREITUNG_STECKBRIEF_MAXTOKENS_MIGRATION, GA_BELEG_KONTRAKT_REVERT_MIGRATION, GA_RISIKEN_ENTWURF_MIGRATION, GA_UMFANG_DEDUP_MIGRATION, GA_UMFANG_DEDUP_CD_MIGRATION, GA_PFLICHT_ANFANG_KLAR_MIGRATION, ANFRAGE_ANON_KLAR_MIGRATION, SKILL_VORGABEN_MIGRATION, GA_INTERPUNKTION_MIGRATION, AUFBEREITUNG_DR_STICHWORTE_MIGRATION, GA_TEILSTRUKTUR_ENTFERNEN_MIGRATION, GA_C_FUENF_RISIKEN_MIGRATION, GA_A_UMFANG_KURATIERT_MIGRATION, GA_EF_VORGABEN_MIGRATION, GA_EP_AUTO_RETRY_MIGRATION, GA_A_ZEICHEN_HERKUNFT_MIGRATION, GA_FACHPRUEFER_MIGRATION, GA_A_VEROEFFENTLICHUNG_MIGRATION, GA_B_TEIL_ANTEILE_MIGRATION, GA_C_FINAL_UMFANG_MIGRATION]);
    expect(out.skills.find(s => s.id === ANFRAGE_ANONYMISIEREN_SKILL_ID)?.aktiv).toBe(true);
    // A bleibt inhaltlich am Alt-Template (Vorwärts-Rollout ist No-op, Rückbau greift auf
    // OLD_A nicht) — der Veröffentlichungs-Kontrakt kommt im selben Durchgang additiv dazu.
    expect(out.skills.find(s => s.id === KURZFASSUNG_SKILL_ID)?.promptTemplate)
      .toBe(mitVeroeffentlichungsKontrakt(OLD_A));
    // C laeuft im selben Durchgang bis zum Stand mit eigener Tiefenangabe des finalen Textes.
    expect(out.skills.find(s => s.id === RISIKEN_SKILL_ID)?.promptTemplate).toBe(abschnittTemplate({ ...C_ABSCHNITT_OPTS }));
    expect(out.skills.find(s => s.id === AUFBEREITUNG_ZAHLEN_SKILL_ID)?.maxTokens).toBe(4096);
    expect(out.skills.find(s => s.id === AUFBEREITUNG_STECKBRIEF_SKILL_ID)?.maxTokens).toBe(4096);
  });

  it('alle Marker gesetzt → No-op', () => {
    const { geaendert } = reconcileEinmaligeAktivierungen(file([anon(false)], ALLE_MARKER));
    expect(geaendert).toBe(false);
  });
});

describe('reconcile — Interpunktions-Vorgabe (Semikolon & Gedankenstrich)', () => {
  const NUR_INTERPUNKTION = ALLE_MARKER.filter(m => m !== GA_INTERPUNKTION_MIGRATION);
  const lektor = (over: Partial<SkillRecord> = {}): SkillRecord =>
    skill(GA_LEKTOR_SKILL_ID, { promptTemplate: GA_LEKTOR_PROMPT_TEMPLATE_ALT, ...over });

  it('bindet die Regel an jeden Gutachten-Abschnitt (additiv, bestehende IDs bleiben)', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(file([
      skill(KURZFASSUNG_SKILL_ID, { regelIds: ['seed-passiv-stil'] }),
      skill(KOMPETENZ_SKILL_ID, { regelIds: [] }),
    ], NUR_INTERPUNKTION));
    expect(geaendert).toBe(true);
    expect(out.skills[0]!.regelIds).toEqual(['seed-passiv-stil', INTERPUNKTION_REGEL_ID]);
    expect(out.skills[1]!.regelIds).toEqual([INTERPUNKTION_REGEL_ID]);
  });

  it('lässt Nicht-Gutachten-Skills unberührt (NF-Bausteine, Aufbereitungs-JSON)', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(file([
      skill(AUFBEREITUNG_ZAHLEN_SKILL_ID, { regelIds: [] }),
    ], NUR_INTERPUNKTION));
    expect(out.skills[0]!.regelIds).toEqual([]);
  });

  it('hebt das unveränderte Lektor-Template auf die Pflicht-Fassung, version ≥ 2', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(file([lektor()], NUR_INTERPUNKTION));
    expect(out.skills[0]!.promptTemplate).toBe(SEED_GA_LEKTOR_SKILL.promptTemplate);
    expect(out.skills[0]!.promptTemplate).toContain('## Pflicht bei jedem Lauf');
    expect(out.skills[0]!.version).toBe(2);
  });

  it('lässt ein kuratiert editiertes Lektor-Template unberührt', () => {
    const eigen = `${GA_LEKTOR_PROMPT_TEMPLATE_ALT}\n\nHausregel: knapper formulieren.`;
    const { file: out } = reconcileEinmaligeAktivierungen(file([lektor({ promptTemplate: eigen })], NUR_INTERPUNKTION));
    expect(out.skills[0]!.promptTemplate).toBe(eigen);
  });

  it('respektiert eine spätere bewusste Entfernung: Marker gesetzt → No-op', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(
      file([skill(KURZFASSUNG_SKILL_ID, { regelIds: [] })], ALLE_MARKER),
    );
    expect(geaendert).toBe(false);
    expect(out.skills[0]!.regelIds).toEqual([]);
  });

  it('ist idempotent (zweiter Lauf hängt die ID nicht doppelt an)', () => {
    const erst = reconcileEinmaligeAktivierungen(file([skill(KURZFASSUNG_SKILL_ID)], NUR_INTERPUNKTION));
    const zweit = reconcileEinmaligeAktivierungen(erst.file);
    expect(zweit.geaendert).toBe(false);
    expect(zweit.file.skills[0]!.regelIds).toEqual([INTERPUNKTION_REGEL_ID]);
  });
});

describe('reconcile — Ein-Skill-Umfangsregeln → SkillRecord.vorgaben', () => {
  const NUR_VORGABEN = ALLE_MARKER.filter(m => m !== SKILL_VORGABEN_MIGRATION);

  const regel = (id: string, typ: string, params: Record<string, unknown>, over: Partial<QualitaetsRegel> = {}): QualitaetsRegel => ({
    id, name: id, typ, params, schweregrad: 'fehler', aktiv: true,
    erstellt_am: 't', geaendert_am: 't', ...over,
  });

  function reg(skills: SkillRecord[], regeln: QualitaetsRegel[]): SkillRegistryFile {
    return { version: 1, updated_at: 't', skills, regeln, angewandteMigrationen: NUR_VORGABEN };
  }

  it('überführt Werte + Schweregrad und räumt den Regel-Record weg', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(reg(
      [skill('a', { regelIds: ['r-wort', 'r-satz', 'r-liste'] })],
      [
        regel('r-wort', 'wortanzahl', { min: 300, max: 350 }),
        regel('r-satz', 'satzanzahl', { min: 8, max: 12 }, { schweregrad: 'hinweis' }),
        regel('r-liste', 'keine_aufzaehlungen', {}),
      ],
    ));
    expect(geaendert).toBe(true);
    const a = out.skills[0]!;
    expect(a.vorgaben).toEqual({
      wortanzahl: { schweregrad: 'fehler', min: 300, max: 350 },
      satzanzahl: { schweregrad: 'hinweis', min: 8, max: 12 },
      keineAufzaehlungen: { schweregrad: 'fehler' },
    });
    expect(a.regelIds).toEqual([]);
    expect(out.regeln).toEqual([]);
  });

  it('lässt eine von MEHREREN Skills genutzte Regel in der Bibliothek', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(reg(
      [skill('a', { regelIds: ['geteilt'] }), skill('b', { regelIds: ['geteilt'] })],
      [regel('geteilt', 'keine_aufzaehlungen', {})],
    ));
    expect(out.skills.every(s => s.regelIds.includes('geteilt'))).toBe(true);
    expect(out.skills.every(s => s.vorgaben === undefined)).toBe(true);
    expect(out.regeln.map(r => r.id)).toEqual(['geteilt']);
  });

  it('lässt eine INAKTIVE Regel unangetastet (sie wirkte nie)', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(reg(
      [skill('a', { regelIds: ['geparkt'] })],
      [regel('geparkt', 'satzanzahl', { min: 5, max: 7 }, { aktiv: false })],
    ));
    expect(out.skills[0]!.regelIds).toEqual(['geparkt']);
    expect(out.skills[0]!.vorgaben).toBeUndefined();
    expect(out.regeln.map(r => r.id)).toEqual(['geparkt']);
  });

  it('löscht Waisen früherer Seed-Stände (von keinem Skill referenziert)', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(reg(
      [skill('a')],
      [regel('waise', 'wortanzahl', { min: 450, max: 550 })],
    ));
    expect(out.regeln).toEqual([]);
  });

  it('fasst Regeln fremder Typen nicht an (QS-/NF-/Muster-Regeln)', () => {
    const fremd = [
      regel('muster', 'verbotenes_muster', { muster: ['x'] }),
      regel('qs', 'ga_qs_konsistenz', {}, { pruefart: 'fachlich' }),
      regel('nf', 'nf_keine_platzhalter_reste', {}, { pruefart: 'administrativ' }),
    ];
    const { file: out } = reconcileEinmaligeAktivierungen(reg([skill('a', { regelIds: ['muster'] })], fremd));
    expect(out.skills[0]!.regelIds).toEqual(['muster']);
    expect(out.skills[0]!.vorgaben).toBeUndefined();
    expect(out.regeln.map(r => r.id)).toEqual(['muster', 'qs', 'nf']);
  });

  it('überschreibt eine bereits gesetzte Vorgabe nicht', () => {
    const eigen = { satzanzahl: { schweregrad: 'hinweis' as const, min: 2, max: 3 } };
    const { file: out } = reconcileEinmaligeAktivierungen(reg(
      [skill('a', { regelIds: ['r-satz'], vorgaben: eigen })],
      [regel('r-satz', 'satzanzahl', { min: 8, max: 12 })],
    ));
    expect(out.skills[0]!.vorgaben).toEqual(eigen);
    expect(out.skills[0]!.regelIds).toEqual(['r-satz']);
  });

  it('lässt eine wertlose Regel stehen, statt eine leere Vorgabe zu erzeugen', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(reg(
      [skill('a', { regelIds: ['leer'] })],
      [regel('leer', 'wortanzahl', {})],
    ));
    expect(out.skills[0]!.regelIds).toEqual(['leer']);
    expect(out.skills[0]!.vorgaben).toBeUndefined();
  });

  it('ist idempotent (zweiter Lauf ändert nichts)', () => {
    const erst = reconcileEinmaligeAktivierungen(reg(
      [skill('a', { regelIds: ['r-satz'] })],
      [regel('r-satz', 'satzanzahl', { min: 8, max: 12 })],
    ));
    const zweit = reconcileEinmaligeAktivierungen(erst.file);
    expect(zweit.geaendert).toBe(false);
    expect(zweit.file.skills[0]!.vorgaben).toEqual(erst.file.skills[0]!.vorgaben);
  });
});


describe('reconcile — DR-Auftrag auf Stichworte (v2.301)', () => {
  const alt = (over: Partial<SkillRecord> = {}): SkillRecord =>
    skill(AUFBEREITUNG_RECHERCHE_PROMPT_SKILL_ID, {
      systemPrompt: RECHERCHE_PROMPT_SYSTEM_ALT,
      promptTemplate: RECHERCHE_PROMPT_TEMPLATE_ALT,
      maxTokens: 2048,
      version: 1,
      aktiv: false,
      ...over,
    });

  it('pristine v1-Stand wird auf die Stichwort-Fassung gehoben', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(file([alt()], NUR_DR_STICHWORTE));
    expect(geaendert).toBe(true);
    const s = out.skills[0]!;
    expect(s.promptTemplate).toBe(AUFBEREITUNG_RECHERCHE_PROMPT_SKILL.promptTemplate);
    expect(s.systemPrompt).toBe(AUFBEREITUNG_RECHERCHE_PROMPT_SKILL.systemPrompt);
    expect(s.maxTokens).toBe(512);
    expect(s.version).toBe(2);
    expect(s.aktiv).toBe(false); // Freischaltung bleibt eine eigene Entscheidung
    expect(out.angewandteMigrationen).toContain(AUFBEREITUNG_DR_STICHWORTE_MIGRATION);
  });

  it('kuratiert editiertes Template bleibt unberührt', () => {
    const edit = alt({ promptTemplate: RECHERCHE_PROMPT_TEMPLATE_ALT + '\nZusatz' });
    const { file: out } = reconcileEinmaligeAktivierungen(file([edit], NUR_DR_STICHWORTE));
    expect(out.skills[0]!.promptTemplate).toBe(RECHERCHE_PROMPT_TEMPLATE_ALT + '\nZusatz');
    expect(out.skills[0]!.maxTokens).toBe(2048);
  });

  it('kuratiert gesetztes maxTokens bleibt, Texte werden trotzdem gehoben', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(file([alt({ maxTokens: 4096 })], NUR_DR_STICHWORTE));
    expect(out.skills[0]!.maxTokens).toBe(4096);
    expect(out.skills[0]!.promptTemplate).toBe(AUFBEREITUNG_RECHERCHE_PROMPT_SKILL.promptTemplate);
  });

  it('läuft nur einmal: gesetzter Marker lässt den Alt-Stand stehen', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(file([alt()], ALLE_MARKER));
    expect(geaendert).toBe(false);
    expect(out.skills[0]!.promptTemplate).toBe(RECHERCHE_PROMPT_TEMPLATE_ALT);
  });
});

describe('reconcile — strukturierte Ausgabe aus den Gutachten-Skills entfernen', () => {
  const mitStruktur = (id: string): SkillRecord => skill(id, {
    teilStruktur: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
    teilJoin: '\n',
  });

  it('entfernt teilStruktur + teilJoin an einem GA-Skill', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(
      file([mitStruktur(KURZFASSUNG_SKILL_ID)], NUR_TEILSTRUKTUR),
    );
    expect(out.skills[0]!.teilStruktur).toBeUndefined();
    expect(out.skills[0]!.teilJoin).toBeUndefined();
    expect(out.angewandteMigrationen).toContain(GA_TEILSTRUKTUR_ENTFERNEN_MIGRATION);
  });

  it('lässt den Prompt-Text und die Version unangetastet', () => {
    const vorher = mitStruktur(KURZFASSUNG_SKILL_ID);
    const { file: out } = reconcileEinmaligeAktivierungen(file([vorher], NUR_TEILSTRUKTUR));
    expect(out.skills[0]!.promptTemplate).toBe(vorher.promptTemplate);
    expect(out.skills[0]!.version).toBe(vorher.version);
  });

  it('fasst Skills außerhalb des GA-Workflows nicht an', () => {
    const fremd = mitStruktur('irgendein-anderer-skill');
    const { file: out } = reconcileEinmaligeAktivierungen(file([fremd], NUR_TEILSTRUKTUR));
    expect(out.skills[0]!.teilStruktur).toHaveLength(2);
    expect(out.skills[0]!.teilJoin).toBe('\n');
  });

  it('läuft nur einmal: gesetzter Marker lässt die Struktur stehen', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(
      file([mitStruktur(KURZFASSUNG_SKILL_ID)], ALLE_MARKER),
    );
    expect(geaendert).toBe(false);
    expect(out.skills[0]!.teilStruktur).toHaveLength(2);
  });
});

/**
 * Der Veröffentlichungs-Kontrakt von A. Geprüft wird gegen den KURATIERTEN Share-Stand
 * (783 Zeichen, andere Punkt-Reihenfolge, ohne Ausgabeformat) — nicht gegen den Seed:
 * A ist der eine Gutachten-Prompt, der live kuratiert ist, und die Migration muss genau
 * dort greifen. Der fehlende `### Finaler Text`-Block ist der teuerste Teil: ohne ihn
 * nimmt `parseSkillOutput` die ganze Modell-Antwort als finalen Text.
 */
const KURATIERTES_A = [
  'Erstelle die Kurzfassung der folgenden Vorhabensbeschreibung (VB) für ein ZIM-Gutachten.',
  '', '', 'Stammdaten des Antrags', '{{stammdaten}}',
  '', '', 'Vorhabensbeschreibung (Quelle)', '{{vbMarkdown}}',
  '', '', 'Aufgabe & Kontrakt',
  A_AUFGABE_ZEILE,
  '1. Projektziel (2 Sätze)',
  '2. Ausgangsproblem (2 Sätze)',
  '3. Technischer Ansatz (3 Sätze)',
  '4. Erwartetes Ergebnis (2 Sätze)',
  '5. Anwendungsbereich (1 Satz)',
  '', '', 'Regeln:',
  '- Streng quellenbasiert: Nutze ausschließlich Inhalte der VB. Erfinde nichts.',
  '- Fließtext im finalen Teil — KEINE Aufzählungen, keine Zwischenüberschriften.',
  '',
].join('\n');

const kuratiertesA = (over: Partial<SkillRecord> = {}): SkillRecord =>
  skill(KURZFASSUNG_SKILL_ID, { promptTemplate: KURATIERTES_A, beschreibung: A_BESCHREIBUNG_ALT, version: 4, ...over });

describe('mitVeroeffentlichungsKontrakt (rein)', () => {
  it('trägt Zweck, Weglass-Regeln und das fehlende Ausgabeformat in den kuratierten Prompt', () => {
    const t = mitVeroeffentlichungsKontrakt(KURATIERTES_A);
    expect(t).toContain(A_ZWECK_BLOCK);
    expect(t).toContain('NICHT hinein gehören: FuE-Risiko');
    expect(t).toContain('„Im Vorhaben soll…"');
    expect(t).toContain('### Finaler Text');
    // Der Zweck steht VOR der Aufgaben-Zeile, nicht irgendwo.
    expect(t.indexOf(A_ZWECK_BLOCK)).toBeLessThan(t.indexOf(A_AUFGABE_ZEILE));
    // Die Ergebnis-Zeile ist geschärft, die übrigen Punkte sind unberührt.
    expect(t).toContain('4. Erwartetes Ergebnis (2 Sätze) — nenne hier die konkreten Zielgrößen');
    expect(t).toContain('5. Anwendungsbereich (1 Satz)');
  });

  it('ist idempotent — ein zweiter Lauf ändert nichts', () => {
    const einmal = mitVeroeffentlichungsKontrakt(KURATIERTES_A);
    expect(mitVeroeffentlichungsKontrakt(einmal)).toBe(einmal);
  });

  it('setzt das Ausgabeformat NICHT doppelt (Seed trägt es bereits)', () => {
    const t = mitVeroeffentlichungsKontrakt(buildKurzfassungPrompt(false));
    expect(t.match(/Finaler Text/g)?.length).toBe(buildKurzfassungPrompt(false).match(/Finaler Text/g)?.length);
    // Der Seed führt eine ANDERE Punkt-Reihenfolge — der Regex-Anker greift trotzdem.
    expect(t).toContain('Erwartetes Ergebnis (1–2 Sätze) — nenne hier die konkreten Zielgrößen');
  });

  it('lässt einen Prompt ohne die Anker unangetastet, statt zu raten', () => {
    expect(mitVeroeffentlichungsKontrakt('Nur Prosa ohne Anker.')).toContain('Nur Prosa ohne Anker.');
  });
});

describe('reconcile — Veröffentlichungs-Kontrakt A', () => {
  const NUR_VEROEFFENTLICHUNG = ALLE_MARKER.filter(m => m !== GA_A_VEROEFFENTLICHUNG_MIGRATION);

  it('pristiner kuratierter Share: Prompt + Beschreibung ergänzt, version ≥ 5', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(
      file([kuratiertesA()], NUR_VEROEFFENTLICHUNG),
    );
    expect(geaendert).toBe(true);
    const a = out.skills[0]!;
    expect(a.promptTemplate).toBe(mitVeroeffentlichungsKontrakt(KURATIERTES_A));
    expect(a.beschreibung).toBe(A_BESCHREIBUNG);
    expect(a.version).toBeGreaterThanOrEqual(5);
    expect(out.angewandteMigrationen).toContain(GA_A_VEROEFFENTLICHUNG_MIGRATION);
  });

  it('lässt eine selbst geschriebene Beschreibung stehen — nur der Prompt wächst', () => {
    const eigen = 'Unsere eigene Beschreibung des Abschnitts.';
    const { file: out } = reconcileEinmaligeAktivierungen(
      file([kuratiertesA({ beschreibung: eigen })], NUR_VEROEFFENTLICHUNG),
    );
    expect(out.skills[0]!.beschreibung).toBe(eigen);
    expect(out.skills[0]!.promptTemplate).toContain(A_ZWECK_BLOCK);
  });

  it('fasst einen fremden Skill nicht an', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(
      file([skill('irgendein-anderer-skill', { promptTemplate: KURATIERTES_A })], NUR_VEROEFFENTLICHUNG),
    );
    expect(out.skills[0]!.promptTemplate).toBe(KURATIERTES_A);
  });

  it('läuft nur einmal: gesetzter Marker lässt den Alt-Stand stehen', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(
      file([kuratiertesA()], ALLE_MARKER),
    );
    expect(geaendert).toBe(false);
    expect(out.skills[0]!.promptTemplate).toBe(KURATIERTES_A);
    expect(out.skills[0]!.beschreibung).toBe(A_BESCHREIBUNG_ALT);
  });
});
