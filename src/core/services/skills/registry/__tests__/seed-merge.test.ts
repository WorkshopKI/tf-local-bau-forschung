import { describe, it, expect } from 'vitest';
import { mergeMissingSeeds } from '../storage';
import { SEED_REGISTRY, SEED_SKILL, SEED_REGELN, SEED_SKILLS_BG, SEED_REGELN_BG, QS_BASIS_SKILL_ID, RELEVANZ_MAP_SKILL_ID, AUSGANGSLAGE_SKILL_ID, INTERPUNKTION_REGEL_ID, UEBERSCHRIFTEN_REGEL_ID } from '../seed';
import { GA_LEKTOR_SKILL_ID } from '../ga-lektor.seed';
import { NF_SKILL_ID, SEED_NF_REGELN } from '../nf-skill.seed';
import { RNE_SKILL_ID, ABL_SKILL_ID } from '../bescheid-skill.seed';
import { ANFRAGE_ANONYMISIEREN_SKILL_ID } from '../anfrage-anonymisieren.seed';
import { ANFRAGE_METADATEN_SKILL_ID } from '../anfrage-metadaten.seed';
import { AUFBEREITUNG_ASPEKTE_SKILL_ID } from '../aufbereitung-aspekte.seed';
import { AUFBEREITUNG_STECKBRIEF_SKILL_ID } from '../aufbereitung-steckbrief.seed';
import { AUFBEREITUNG_ZAHLEN_SKILL_ID } from '../aufbereitung-zahlen.seed';
import { AUFBEREITUNG_GLOSSAR_SKILL_ID } from '../aufbereitung-glossar.seed';
import { AUFBEREITUNG_VERWERTUNG_SKILL_ID } from '../aufbereitung-verwertung.seed';
import { AUFBEREITUNG_RECHERCHE_PROMPT_SKILL_ID } from '../aufbereitung-recherche-prompt.seed';
import { AUFBEREITUNG_RECHERCHE_IMPORT_SKILL_ID } from '../aufbereitung-recherche-import.seed';
import { GA_QS_REGELN } from '../ga-qs.seed';
import { getSkillById, resolveRegeln } from '../selectors';
import type { SkillRegistryFile } from '../types';

/** Bestands-Registry, die nur den kuratierten Abschnitt A kennt (Pre-B–G). */
function curatedNurA(): SkillRegistryFile {
  return {
    version: 1,
    updated_at: 't',
    skills: [{ ...SEED_SKILL, promptTemplate: 'KURATIERT', version: 7 }],
    regeln: [...SEED_REGELN],
  };
}

describe('mergeMissingSeeds — additiv, nie überschreibend', () => {
  it('ergänzt fehlende B–G-Skills + -Regeln, lässt kuratiertes A unangetastet', () => {
    const merged = mergeMissingSeeds(curatedNurA());

    // A bleibt kuratiert (NICHT vom Seed überschrieben):
    const a = getSkillById(merged.file, 'gutachten-kurzfassung')!;
    expect(a.promptTemplate).toBe('KURATIERT');
    expect(a.version).toBe(7);

    // B–G + qs-basis + relevanz-map + nf-skill ergänzt:
    for (const s of SEED_SKILLS_BG) expect(getSkillById(merged.file, s.id)).toBeDefined();
    expect(getSkillById(merged.file, QS_BASIS_SKILL_ID)).toBeDefined();
    expect(getSkillById(merged.file, RELEVANZ_MAP_SKILL_ID)).toBeDefined();
    expect(merged.ergaenzteSkills).toEqual([...SEED_SKILLS_BG.map(s => s.id), QS_BASIS_SKILL_ID, RELEVANZ_MAP_SKILL_ID, GA_LEKTOR_SKILL_ID, NF_SKILL_ID, RNE_SKILL_ID, ABL_SKILL_ID, ANFRAGE_ANONYMISIEREN_SKILL_ID, ANFRAGE_METADATEN_SKILL_ID, AUFBEREITUNG_ASPEKTE_SKILL_ID, AUFBEREITUNG_STECKBRIEF_SKILL_ID, AUFBEREITUNG_ZAHLEN_SKILL_ID, AUFBEREITUNG_GLOSSAR_SKILL_ID, AUFBEREITUNG_VERWERTUNG_SKILL_ID, AUFBEREITUNG_RECHERCHE_PROMPT_SKILL_ID, AUFBEREITUNG_RECHERCHE_IMPORT_SKILL_ID]);
    // B–G bringen seit v2.296 KEINE eigenen Regel-Records mehr mit (ihre Umfangs-
    // Vorgaben stecken im Skill); ergänzt werden nur NF- + GA-QS-Regeln.
    expect(getSkillById(merged.file, AUSGANGSLAGE_SKILL_ID)!.vorgaben?.absatzMin).toMatchObject({ min: 4 });
    expect(merged.ergaenzteRegeln).toEqual([
      ...SEED_REGELN_BG.map(r => r.id), ...SEED_NF_REGELN.map(r => r.id), ...GA_QS_REGELN.map(r => r.id),
    ]);
  });

  it('ist idempotent (zweiter Lauf ergänzt nichts, gibt Identität zurück)', () => {
    const once = mergeMissingSeeds(curatedNurA());
    const twice = mergeMissingSeeds(once.file);
    expect(twice.ergaenzteSkills).toHaveLength(0);
    expect(twice.ergaenzteRegeln).toHaveLength(0);
    expect(twice.file).toBe(once.file);
  });

  it('ist No-op auf der vollständigen Seed-Registry (source: seed)', () => {
    const full = mergeMissingSeeds(SEED_REGISTRY);
    expect(full.ergaenzteSkills).toHaveLength(0);
    expect(full.ergaenzteRegeln).toHaveLength(0);
    expect(full.file).toBe(SEED_REGISTRY);
  });
});

describe('B–G-Seeds — Kohärenz', () => {
  it('jede Skill-regelId löst sich in der Seed-Registry auf', () => {
    for (const skill of SEED_SKILLS_BG) {
      const regeln = resolveRegeln(SEED_REGISTRY, skill);
      // Aufgelöst = materialisierte Skill-Vorgaben + Bibliotheks-Regeln.
      const vorgabenAnzahl = Object.keys(skill.vorgaben ?? {}).length;
      expect(regeln.length).toBe(vorgabenAnzahl + skill.regelIds.length);
      for (const id of skill.regelIds) {
        expect(regeln.find(r => r.id === id)).toBeDefined();
      }
    }
  });

  it('alle B–G-Skills deklarieren den {{vorherigeAbschnitte}}-Slot + nicht-leere Modifier', () => {
    for (const skill of SEED_SKILLS_BG) {
      expect(skill.slots).toContain('vorherigeAbschnitte');
      expect(skill.promptTemplate).toContain('{{vorherigeAbschnitte}}');
      expect(skill.modifiers.neu).not.toBe('');
      expect(skill.modifiers.kuerzer).not.toBe('');
      expect(skill.modifiers.laenger).not.toBe('');
    }
  });

  it('B nutzt absatz_min(4) + die Wortanzahl-Spanne, G hat den Pflicht-Anfang', () => {
    const b = resolveRegeln(SEED_REGISTRY, getSkillById(SEED_REGISTRY, 'gutachten-ausgangslage')!);
    expect(b.find(r => r.typ === 'absatz_min')?.params.min).toBe(4);
    expect(b.find(r => r.typ === 'wortanzahl')?.params.min).toBe(400);

    const g = resolveRegeln(SEED_REGISTRY, getSkillById(SEED_REGISTRY, 'gutachten-kompetenz')!);
    const pflicht = g.find(r => r.typ === 'pflicht_anfang');
    expect(String(pflicht?.params.text)).toContain('Technologiekompetenz im Bereich');
  });

  it('E + F tragen nur die generellen Fließtext-Vorgaben, keine Abschnitts-Regeln', () => {
    // E + F sind reine Prompt-Abschnitte (keine Umfangs-Vorgaben, keine Passiv-Regel).
    // Interpunktion (seit v2.297) und „keine Überschriften" (seit v6.34) gelten für JEDEN
    // generierten Fließtext und sind damit auch hier gesetzt.
    const generell = [INTERPUNKTION_REGEL_ID, UEBERSCHRIFTEN_REGEL_ID];
    expect(getSkillById(SEED_REGISTRY, 'gutachten-unternehmen')!.regelIds).toEqual(generell);
    expect(getSkillById(SEED_REGISTRY, 'gutachten-verwertung')!.regelIds).toEqual(generell);
  });
});
