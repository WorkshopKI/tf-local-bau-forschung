import { describe, it, expect } from 'vitest';
import { SEED_NF_SKILL, NF_DEF, NF_SKILL_ID } from '../nf-skill.seed';
import { SEED_SKILL } from '../seed';
import { composeSkillPrompt, type SkillRunInput } from '../../run/run-skill';
import { skillEnthaeltDokumentInhalte } from '@/core/services/ai/transport-policy';

describe('NF-Skill — Auswahl/Füllung', () => {
  it('referenziert den Baustein-Katalog + NF-Kontext-Slots und deklariert sie', () => {
    expect(SEED_NF_SKILL.id).toBe(NF_SKILL_ID);
    for (const slot of ['{{nfBausteine}}', '{{tvKontext}}', '{{verbundKontext}}', '{{stammdaten}}']) {
      expect(SEED_NF_SKILL.promptTemplate).toContain(slot);
    }
    expect(SEED_NF_SKILL.slots).toEqual(
      expect.arrayContaining(['stammdaten', 'verbundKontext', 'tvKontext', 'nfBausteine']),
    );
  });

  it('verlangt Wortgetreuheit + erklärt alle vier Platzhalter-Typen', () => {
    const t = SEED_NF_SKILL.promptTemplate;
    expect(t).toContain('Wortgetreu');
    expect(t).toContain('NIEMALS um'); // Rechtstext nie umformulieren
    expect(t).toContain('{a / b / c}'); // choose
    expect(t).toContain('{…}'); // optional
    expect(t).toContain('x €'); // wert
    expect(t).toContain('[Im Antrag nicht genannt]'); // quellenbasiert
  });

  it('trägt KEINE Konversations-/Befehls-/Freigabe-Schicht (liefert der Runner)', () => {
    const t = SEED_NF_SKILL.promptTemplate;
    expect(t).not.toContain('W=Weiter');
    expect(t).not.toContain('Freigabe abwarten');
    expect(t).not.toContain('DOKUMENTENERKENNUNG');
  });

  it('ist dokument-tragend → intern-pflichtig (Ableitung über Inhalts-Slots)', () => {
    expect(skillEnthaeltDokumentInhalte(SEED_NF_SKILL)).toBe(true);
  });
});

describe('NF-WorkflowDef — Draft auf TV-Ebene', () => {
  it('trägt artefaktTyp nf, ebene tv und ist als Draft (aktiv:false) geseedet', () => {
    expect(NF_DEF.id).toBe('zim-nf');
    expect(NF_DEF.artefaktTyp).toBe('nf');
    expect(NF_DEF.ebene).toBe('tv');
    expect(NF_DEF.aktiv).toBe(false);
    expect(NF_DEF.steps.map(s => s.skillId)).toContain(NF_SKILL_ID);
  });
});

describe('NF-Slots — No-op für Bestands-Skills (GA byte-identisch)', () => {
  it('die neuen Slots ändern die Komposition eines A–G-Skills nicht', () => {
    const base: SkillRunInput = { stammdaten: 'SD', vbMarkdown: 'VB-TEXT' };
    const ohne = composeSkillPrompt(SEED_SKILL, [], base, 'VB-TEXT');
    const mit = composeSkillPrompt(
      SEED_SKILL, [],
      { ...base, nfBausteine: 'KATALOG', tvKontext: 'TV', verbundKontext: 'VB-KONTEXT' },
      'VB-TEXT',
    );
    expect(mit).toBe(ohne); // Template ohne NF-Platzhalter → keine Wirkung
  });
});
