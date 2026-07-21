/**
 * DSGVO-Guard der Korpus-Umstellung (Pitfall #30 / #35).
 *
 * Die Umstellung füllt den BESTEHENDEN `{{vbMarkdown}}`-Slot mit einem anderen String
 * (VB + aufgenommene Zusatzdokumente) — sie fasst weder das Template noch die
 * Slot-Liste an. Genau deshalb bleibt die Transport-Klassifizierung unverändert
 * „dokument-tragend → nur intern".
 *
 * Der Guard fixiert das gegen eine naheliegende künftige Änderung: wer den Korpus in
 * einen NEUEN Slot (`{{korpus}}`) auslagert, muss ihn zwingend in `INHALTS_SLOTS`
 * nachtragen — bis dahin liefe der Skill als „inhaltsfrei" durch und dürfte extern
 * ausgeführt werden. Schlägt dieser Test an, ist das kein Formalismus, sondern ein
 * potenzielles Datenleck.
 */
import { describe, it, expect } from 'vitest';
import { ZIM_EP_DEF, SEED_SKILL, SEED_SKILLS_BG } from '@/core/services/skills';
import { skillEnthaeltDokumentInhalte, templateReferenziertInhaltsSlot } from '@/core/services/ai/transport-policy';

/** Die A–G-Abschnitts-Skills des ZIM-EP-Gutachtens (A = SEED_SKILL, B–G = SEED_SKILLS_BG). */
const alleSeeds = [SEED_SKILL, ...SEED_SKILLS_BG];
const abschnittsSkills = ZIM_EP_DEF.steps
  .map(s => alleSeeds.find(k => k.id === s.skillId))
  .filter((s): s is NonNullable<typeof s> => s != null);

describe('Gutachten-Korpus bleibt intern-pflichtig', () => {
  it('jeder A–G-Skill wurde gefunden (sonst prüft der Guard nichts)', () => {
    expect(abschnittsSkills.length).toBe(ZIM_EP_DEF.steps.length);
    expect(abschnittsSkills.length).toBeGreaterThan(0);
  });

  it('jeder A–G-Skill führt weiterhin {{vbMarkdown}} im Template', () => {
    for (const skill of abschnittsSkills) {
      expect(skill.promptTemplate, `Skill ${skill.id} hat den Slot verloren`)
        .toContain('{{vbMarkdown}}');
    }
  });

  it('jeder A–G-Skill gilt als dokument-tragend ⇒ Transport bleibt intern', () => {
    for (const skill of abschnittsSkills) {
      expect(skillEnthaeltDokumentInhalte(skill), `Skill ${skill.id} wäre extern erlaubt`).toBe(true);
    }
  });

  it('ein hypothetischer {{korpus}}-Slot wäre NICHT als Inhalts-Slot erkannt', () => {
    // Dokumentiert, warum die Umstellung den bestehenden Slot wiederverwendet.
    expect(templateReferenziertInhaltsSlot('Analysiere {{korpus}}.')).toBe(false);
    expect(templateReferenziertInhaltsSlot('Analysiere {{vbMarkdown}}.')).toBe(true);
  });
});
