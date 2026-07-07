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
} from '../migrations';
import { ANFRAGE_ANONYMISIEREN_SKILL_ID } from '../anfrage-anonymisieren.seed';
import {
  KURZFASSUNG_SKILL_ID,
  AUSGANGSLAGE_SKILL_ID,
  buildKurzfassungPrompt,
  abschnittTemplate,
  B_ABSCHNITT_OPTS,
} from '../seed';
import type { SkillRecord, SkillRegistryFile } from '../types';

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

// Beleg-Marker vorbelegen, um NUR die Anon-Migration zu isolieren (und umgekehrt).
const NUR_ANON = [GA_BELEG_KONTRAKT_MIGRATION];
const NUR_BELEG = [ANFRAGE_ANON_AKTIV_MIGRATION];

const OLD_A = buildKurzfassungPrompt(false);
const NEW_A = buildKurzfassungPrompt(true);
const OLD_B = abschnittTemplate({ ...B_ABSCHNITT_OPTS });
const NEW_B = abschnittTemplate({ ...B_ABSCHNITT_OPTS, belegKontrakt: true });

describe('reconcile — Anonymisierer-Freischaltung', () => {
  it('Bestands-Share: aktiv:false → true, Marker gesetzt, geaendert', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(file([anon(false)], NUR_ANON));
    expect(geaendert).toBe(true);
    expect(out.skills[0]?.aktiv).toBe(true);
    expect(out.angewandteMigrationen).toContain(ANFRAGE_ANON_AKTIV_MIGRATION);
  });

  it('respektiert spätere Deaktivierung: Marker gesetzt → bleibt false', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(
      file([anon(false)], [ANFRAGE_ANON_AKTIV_MIGRATION, GA_BELEG_KONTRAKT_MIGRATION]),
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

describe('reconcile — Beleg-Kontrakt-Rollout A + B (Journey-Paket 4)', () => {
  const pristineA = skill(KURZFASSUNG_SKILL_ID, { promptTemplate: OLD_A, version: 1 });
  const pristineB = skill(AUSGANGSLAGE_SKILL_ID, { promptTemplate: OLD_B, version: 1 });

  it('pristine A + B (Alt-Template) → auf Neu-Template + version 2', () => {
    const { file: out, geaendert, angewandt } = reconcileEinmaligeAktivierungen(
      file([pristineA, pristineB], NUR_BELEG),
    );
    expect(geaendert).toBe(true);
    expect(angewandt).toContain(GA_BELEG_KONTRAKT_MIGRATION);
    const a = out.skills.find(s => s.id === KURZFASSUNG_SKILL_ID)!;
    const b = out.skills.find(s => s.id === AUSGANGSLAGE_SKILL_ID)!;
    expect(a.promptTemplate).toBe(NEW_A);
    expect(a.version).toBe(2);
    expect(b.promptTemplate).toBe(NEW_B);
    expect(b.version).toBe(2);
  });

  it('KURATIERT editiertes A wird NIEMALS überschrieben', () => {
    const editedA = skill(KURZFASSUNG_SKILL_ID, { promptTemplate: OLD_A + '\nKurator-Zusatz', version: 3 });
    const { file: out } = reconcileEinmaligeAktivierungen(file([editedA], NUR_BELEG));
    const a = out.skills.find(s => s.id === KURZFASSUNG_SKILL_ID)!;
    expect(a.promptTemplate).toBe(OLD_A + '\nKurator-Zusatz'); // unverändert
    expect(a.version).toBe(3);
  });

  it('bereits neuer Stand (frische Installation) bleibt unberührt', () => {
    const newA = skill(KURZFASSUNG_SKILL_ID, { promptTemplate: NEW_A, version: 2 });
    const { file: out } = reconcileEinmaligeAktivierungen(file([newA], NUR_BELEG));
    expect(out.skills[0]?.promptTemplate).toBe(NEW_A);
    expect(out.skills[0]?.version).toBe(2);
  });

  it('idempotent: zweiter Lauf ist No-op', () => {
    const erst = reconcileEinmaligeAktivierungen(file([pristineA], NUR_BELEG));
    const zweit = reconcileEinmaligeAktivierungen(erst.file);
    expect(zweit.geaendert).toBe(false);
    expect(zweit.file.skills[0]?.promptTemplate).toBe(NEW_A);
  });

  it('fremde Skills unangetastet; Marker einmalig gesetzt', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(file([skill('x', { promptTemplate: 'Y' })], NUR_BELEG));
    expect(out.skills.find(s => s.id === 'x')?.promptTemplate).toBe('Y');
    expect(out.angewandteMigrationen).toContain(GA_BELEG_KONTRAKT_MIGRATION);
  });
});

describe('reconcile — beide Migrationen zusammen', () => {
  it('frischer Share: beide Marker gesetzt, geaendert', () => {
    const { file: out, geaendert, angewandt } = reconcileEinmaligeAktivierungen(
      file([anon(false), skill(KURZFASSUNG_SKILL_ID, { promptTemplate: OLD_A })]),
    );
    expect(geaendert).toBe(true);
    expect(angewandt).toEqual([ANFRAGE_ANON_AKTIV_MIGRATION, GA_BELEG_KONTRAKT_MIGRATION]);
    expect(out.skills.find(s => s.id === ANFRAGE_ANONYMISIEREN_SKILL_ID)?.aktiv).toBe(true);
    expect(out.skills.find(s => s.id === KURZFASSUNG_SKILL_ID)?.promptTemplate).toBe(NEW_A);
  });

  it('beide Marker gesetzt → No-op', () => {
    const { geaendert } = reconcileEinmaligeAktivierungen(
      file([anon(false)], [ANFRAGE_ANON_AKTIV_MIGRATION, GA_BELEG_KONTRAKT_MIGRATION]),
    );
    expect(geaendert).toBe(false);
  });
});
