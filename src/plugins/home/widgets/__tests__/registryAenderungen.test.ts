/**
 * Tests für den Registry-Änderungen-Selektor (Phase 4 v1.1): Änderungsart-
 * Ableitung (alle vier Fälle — neu/aktiviert/deaktiviert/geändert via
 * diffSkillVersions), Regel-Reduktion, Sortierung + Kappung, Katalog-
 * Verankerung (Nur-Kurator).
 */
import { describe, expect, it } from 'vitest';
import type {
  QualitaetsRegel,
  SkillRecord,
  SkillVersionSnapshot,
} from '@/core/services/skills/registry/types';
import {
  baueRegistryAenderungen,
  regelAenderungsArt,
  skillAenderungsArt,
} from '../registryAenderungen';
import { WIDGET_KATALOG } from '../widgetCatalog';

const MODS = { neu: '', kuerzer: '', laenger: '' };

function snap(over: Partial<SkillVersionSnapshot> = {}): SkillVersionSnapshot {
  return { version: 1, promptTemplate: 'T', regelIds: [], modifiers: { ...MODS }, geaendert_am: '2026-01-01', ...over };
}

function skill(over: Partial<SkillRecord>): SkillRecord {
  return {
    id: 's', name: 'S', beschreibung: '', version: 1, promptTemplate: 'T',
    modifiers: { ...MODS }, regelIds: [], slots: [], geaendert_am: '2026-01-01', ...over,
  } as SkillRecord;
}

function regel(over: Partial<QualitaetsRegel>): QualitaetsRegel {
  return {
    id: 'r', name: 'R', typ: 'x', params: {}, schweregrad: 'hinweis', aktiv: true,
    erstellt_am: '2026-01-01', geaendert_am: '2026-01-01', ...over,
  } as QualitaetsRegel;
}

describe('skillAenderungsArt — alle vier Fälle', () => {
  it('neu: version 1 oder keine Vorgänger-Historie', () => {
    expect(skillAenderungsArt(skill({ version: 1 }))).toBe('neu');
    expect(skillAenderungsArt(skill({ version: 3, historie: [snap({ version: 3 })] }))).toBe('neu');
  });

  it('aktiviert: leerer Diff (Zustandswechsel) + aktiv', () => {
    const s = skill({
      version: 2, aktiv: true,
      historie: [snap({ version: 2 }), snap({ version: 1 })], // identischer Inhalt → unveraendert
    });
    expect(skillAenderungsArt(s)).toBe('aktiviert');
  });

  it('deaktiviert: leerer Diff + aktiv === false', () => {
    const s = skill({
      version: 2, aktiv: false,
      historie: [snap({ version: 2 }), snap({ version: 1 })],
    });
    expect(skillAenderungsArt(s)).toBe('deaktiviert');
  });

  it('geändert: nicht-leerer Diff (Template unterscheidet sich)', () => {
    const s = skill({
      version: 2, aktiv: true,
      historie: [snap({ version: 2, promptTemplate: 'NEU' }), snap({ version: 1, promptTemplate: 'ALT' })],
    });
    expect(skillAenderungsArt(s)).toBe('geaendert');
  });
});

describe('regelAenderungsArt — reduziert (keine Historie)', () => {
  it('neu: erstellt === geaendert', () => {
    expect(regelAenderungsArt(regel({ erstellt_am: '2026-01-01', geaendert_am: '2026-01-01' }))).toBe('neu');
  });
  it('deaktiviert: aktiv false', () => {
    expect(regelAenderungsArt(regel({ erstellt_am: '2026-01-01', geaendert_am: '2026-02-01', aktiv: false }))).toBe('deaktiviert');
  });
  it('geändert: aktiv, erstellt !== geaendert', () => {
    expect(regelAenderungsArt(regel({ erstellt_am: '2026-01-01', geaendert_am: '2026-02-01', aktiv: true }))).toBe('geaendert');
  });
});

describe('baueRegistryAenderungen — Sortierung + Kappung', () => {
  it('sortiert geaendert_am absteigend, kappt', () => {
    const skills = [
      skill({ id: 'alt', geaendert_am: '2026-01-01T00:00:00.000Z' }),
      skill({ id: 'neu', geaendert_am: '2026-06-01T00:00:00.000Z' }),
    ];
    const regeln = [regel({ id: 'mitte', geaendert_am: '2026-03-01T00:00:00.000Z' })];
    const zeilen = baueRegistryAenderungen(skills, regeln, 2);
    expect(zeilen.map(z => z.id)).toEqual(['neu', 'mitte']); // desc, gekappt auf 2
    expect(zeilen[0]!.objektArt).toBe('skill');
    expect(zeilen[1]!.objektArt).toBe('regel');
  });

  it('trägt aktiv-Zustand + Begründung aus historie[0]', () => {
    const zeilen = baueRegistryAenderungen(
      [skill({ id: 's', aktiv: false, version: 2, historie: [snap({ version: 2, begruendung: 'weil' }), snap({ version: 1 })] })],
      [], 5,
    );
    expect(zeilen[0]!.aktiv).toBe(false);
    expect(zeilen[0]!.begruendung).toBe('weil');
  });
});

describe('Katalog-Verankerung (Nur Kurator)', () => {
  it('registry-aenderungen ist ein Seiten-Widget mit Nur-Kurator-Badge', () => {
    const e = WIDGET_KATALOG['registry-aenderungen'];
    expect(e.bereich).toBe('seite');
    expect(e.verfuegbar).toBe(true);
    expect(e.hinweisBadge).toBe('Nur Kurator');
    expect(e.defaultConfig()).toEqual({ art: 'registry-aenderungen', maxEintraege: 3 });
  });
});
