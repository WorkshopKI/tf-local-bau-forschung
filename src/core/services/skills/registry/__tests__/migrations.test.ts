/**
 * Einmalige, marker-gesicherte Registry-Migrationen (`reconcileEinmaligeAktivierungen`).
 * Kern-Invariante: läuft GENAU EINMAL pro Share (Marker) und respektiert eine
 * spätere bewusste Deaktivierung.
 */
import { describe, expect, it } from 'vitest';
import {
  reconcileEinmaligeAktivierungen,
  ANFRAGE_ANON_AKTIV_MIGRATION,
} from '../migrations';
import { ANFRAGE_ANONYMISIEREN_SKILL_ID } from '../anfrage-anonymisieren.seed';
import type { SkillRecord, SkillRegistryFile } from '../types';

function skill(id: string, aktiv: boolean | undefined): SkillRecord {
  return {
    id, name: id, beschreibung: '', version: 1, promptTemplate: 'P',
    modifiers: { neu: '', kuerzer: '', laenger: '' }, regelIds: [], slots: [],
    geaendert_am: 't', ...(aktiv === undefined ? {} : { aktiv }),
  };
}

function file(skills: SkillRecord[], angewandteMigrationen?: string[]): SkillRegistryFile {
  return { version: 1, updated_at: 't', skills, regeln: [], ...(angewandteMigrationen ? { angewandteMigrationen } : {}) };
}

const anon = (aktiv: boolean | undefined): SkillRecord => skill(ANFRAGE_ANONYMISIEREN_SKILL_ID, aktiv);

describe('reconcileEinmaligeAktivierungen — Anonymisierer-Freischaltung', () => {
  it('Bestands-Share: aktiv:false → true, Marker gesetzt, geaendert', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(file([anon(false)]));
    expect(geaendert).toBe(true);
    expect(out.skills[0]?.aktiv).toBe(true);
    expect(out.angewandteMigrationen).toContain(ANFRAGE_ANON_AKTIV_MIGRATION);
  });

  it('respektiert spätere Deaktivierung: Marker gesetzt → NICHTS anfassen (bleibt false)', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(
      file([anon(false)], [ANFRAGE_ANON_AKTIV_MIGRATION]),
    );
    expect(geaendert).toBe(false);
    expect(out.skills[0]?.aktiv).toBe(false);
  });

  it('idempotent: zweiter Lauf ist ein No-op', () => {
    const erst = reconcileEinmaligeAktivierungen(file([anon(false)]));
    const zweit = reconcileEinmaligeAktivierungen(erst.file);
    expect(zweit.geaendert).toBe(false);
    expect(zweit.file.skills[0]?.aktiv).toBe(true);
  });

  it('bereits aktiv (frische Installation): nur Marker setzen, Skill bleibt true', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(file([anon(true)]));
    expect(geaendert).toBe(true); // Marker wird gesetzt → einmaliger Write
    expect(out.skills[0]?.aktiv).toBe(true);
    expect(out.angewandteMigrationen).toContain(ANFRAGE_ANON_AKTIV_MIGRATION);
  });

  it('Skill fehlt: kein Crash, nur Marker setzen', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(file([skill('anderer', true)]));
    expect(geaendert).toBe(true);
    expect(out.skills).toHaveLength(1);
    expect(out.angewandteMigrationen).toContain(ANFRAGE_ANON_AKTIV_MIGRATION);
  });

  it('lässt andere Skills und bestehende Marker unangetastet', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(
      file([anon(false), skill('x', false)], ['frueher-marker']),
    );
    expect(out.skills.find(s => s.id === 'x')?.aktiv).toBe(false);
    expect(out.angewandteMigrationen).toEqual(['frueher-marker', ANFRAGE_ANON_AKTIV_MIGRATION]);
  });
});
