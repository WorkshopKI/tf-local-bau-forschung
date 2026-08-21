/**
 * Reine Bausteine der Prompt-Ansicht: Lauf-Eingabe, Block-Beschreibung, Maße und
 * die Abtrennung der Vorhabensbeschreibung.
 */
import { describe, it, expect } from 'vitest';
import { renderSkillPrompt, type SkillRecord, type SkillTweak } from '@/core/services/skills';
import { SEED_SKILL, SEED_REGELN } from '@/core/services/skills/registry/seed';
import { baueSkillEingabe, tweakWirktAuf, type SkillEingabeArgs } from '../laufEingabe';
import {
  beschreibeBloecke, beschrifteGesendet, promptMasse, trennePromptAmVb,
  type GesendeterPrompt,
} from '../promptAnsicht';
import type { KurzfassungContext } from '../../kurzfassung/types';

const ctx: KurzfassungContext = {
  key: 'ZEP-1',
  akronym: 'AKRO',
  titel: 'Titel',
  antragsteller: 'Firma',
  foerderkennzeichen: 'ZEP-1',
  knownIds: ['ZEP-1'],
  teilvorhaben: [],
};

function args(over: Partial<SkillEingabeArgs> = {}): SkillEingabeArgs {
  return {
    ctx,
    korpusMd: 'VB-VOLLTEXT',
    vbCharCap: 100_000,
    thinkingBudget: 'none',
    ziel: 'standard',
    vorherigeAbschnitte: 'Keine.',
    ...over,
  };
}

function tweak(over: Partial<SkillTweak> = {}): SkillTweak {
  return {
    skillId: SEED_SKILL.id,
    angelegtFuerSkillVersion: 1,
    aktiv: true,
    stilHinweise: 'Sachlich.',
    beispielFormulierungen: '',
    geaendert_am: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('baueSkillEingabe', () => {
  it('lässt nicht gesetzte Felder WEG statt sie auf undefined zu setzen', () => {
    const e = baueSkillEingabe(args());
    // `composeSkillPrompt` prüft auf Wahrheitswerte; ein explizites `undefined`
    // wäre zwar gleichwertig, aber die Objekt-Gleichheit in Tests/Diffs nicht.
    expect('modifier' in e).toBe(false);
    expect('anweisung' in e).toBe(false);
    expect('teilAufgabe' in e).toBe(false);
    expect('tweak' in e).toBe(false);
  });

  it('reicht Ziel, Cap und Vorabschnitte unverändert durch', () => {
    const e = baueSkillEingabe(args({ ziel: 'stark', vbCharCap: 4242, vorherigeAbschnitte: 'VOR' }));
    expect(e.ziel).toBe('stark');
    expect(e.vbCharCap).toBe(4242);
    expect(e.vorherigeAbschnitte).toBe('VOR');
    expect(e.vbMarkdown).toBe('VB-VOLLTEXT');
  });

  it('nimmt den Tweak nur auf, wenn er als wirksam gemeldet ist', () => {
    expect('tweak' in baueSkillEingabe(args({ tweak: tweak() }))).toBe(false);
    expect('tweak' in baueSkillEingabe(args({ tweak: tweak(), tweakWirksam: true }))).toBe(true);
  });
});

describe('tweakWirktAuf', () => {
  it('verlangt aktiv, passende skillId und mindestens ein gefülltes Feld', () => {
    expect(tweakWirktAuf(SEED_SKILL.id, null)).toBe(false);
    expect(tweakWirktAuf(SEED_SKILL.id, tweak({ aktiv: false }))).toBe(false);
    expect(tweakWirktAuf('anderer', tweak())).toBe(false);
    expect(tweakWirktAuf(SEED_SKILL.id, tweak({ stilHinweise: '  ', beispielFormulierungen: '' }))).toBe(false);
    expect(tweakWirktAuf(SEED_SKILL.id, tweak())).toBe(true);
  });
});

describe('beschreibeBloecke', () => {
  it('markiert die Vorlage immer und die Anweisungs-Blöcke nur bei Wert', () => {
    const ohne = beschreibeBloecke(SEED_SKILL, SEED_REGELN, baueSkillEingabe(args()));
    expect(ohne.find(b => b.key === 'template')?.vorhanden).toBe(true);
    expect(ohne.find(b => b.key === 'anweisung')?.vorhanden).toBe(false);
    expect(ohne.find(b => b.key === 'modifier')?.vorhanden).toBe(false);

    const mit = beschreibeBloecke(
      SEED_SKILL, SEED_REGELN,
      baueSkillEingabe(args({ anweisung: 'kürzer bitte', modifier: 'kuerzer' })),
    );
    expect(mit.find(b => b.key === 'anweisung')?.vorhanden).toBe(true);
    expect(mit.find(b => b.key === 'modifier')?.vorhanden).toBe(true);
  });

  it('meldet den Formale-Vorgaben-Block nur, wenn Regeln etwas beisteuern', () => {
    const eingabe = baueSkillEingabe(args());
    expect(beschreibeBloecke(SEED_SKILL, [], eingabe).find(b => b.key === 'vorgaben')?.vorhanden).toBe(false);
    expect(beschreibeBloecke(SEED_SKILL, SEED_REGELN, eingabe).find(b => b.key === 'vorgaben')?.vorhanden).toBe(true);
  });
});

describe('promptMasse', () => {
  it('trennt VB-Anteil und Anweisungs-Anteil', () => {
    const gerendert = renderSkillPrompt(SEED_SKILL, SEED_REGELN, baueSkillEingabe(args()));
    const m = promptMasse(gerendert, 100_000);
    expect(m.vbZeichen).toBe('VB-VOLLTEXT'.length);
    expect(m.anweisungsZeichen).toBe(m.zeichen - m.vbZeichen);
    expect(m.anweisungsZeichen).toBeGreaterThan(0);
    expect(m.tokenSchaetzung).toBeGreaterThan(0);
    expect(m.vbGekuerzt).toBe(false);
  });

  it('zählt die VB NICHT mit, wenn das Template ihren Slot nicht (mehr) führt', () => {
    // Die Werkstatt rechnet die Maße live gegen den bearbeiteten Entwurf. Löscht
    // jemand `{{vbMarkdown}}` heraus, liefert `renderSkillPrompt` die VB weiterhin
    // als Feld mit — sie steht dann aber in keinem Prompt. Vorher meldete die
    // Anzeige einen VB-Anteil GRÖSSER als den ganzen Prompt und „Anweisungen 0".
    const ohneSlot: SkillRecord = { ...SEED_SKILL, promptTemplate: SEED_SKILL.promptTemplate.replace('{{vbMarkdown}}', '') };
    const gerendert = renderSkillPrompt(ohneSlot, SEED_REGELN, baueSkillEingabe(args()));
    const m = promptMasse(gerendert, 100_000);

    expect(gerendert.vb).toBe('VB-VOLLTEXT');       // mitgeliefert …
    expect(gerendert.user).not.toContain('VB-VOLLTEXT'); // … aber nicht eingesetzt
    expect(m.vbZeichen).toBe(0);
    expect(m.anweisungsZeichen).toBe(m.zeichen);
    expect(m.vbZeichen).toBeLessThanOrEqual(m.zeichen);
  });

  it('meldet die Kürzung durch bis zur Anzeige', () => {
    const skill: SkillRecord = { ...SEED_SKILL };
    const gerendert = renderSkillPrompt(
      skill, SEED_REGELN,
      baueSkillEingabe(args({ korpusMd: 'X'.repeat(5000), vbCharCap: 500 })),
    );
    expect(promptMasse(gerendert, 500).vbGekuerzt).toBe(true);
  });
});

describe('trennePromptAmVb', () => {
  it('zerlegt den Prompt an der eingesetzten VB', () => {
    expect(trennePromptAmVb('vor[VB]nach', '[VB]')).toEqual({ vor: 'vor', vb: '[VB]', nach: 'nach' });
  });

  it('lässt alles im vor-Teil, wenn die VB leer ist oder nicht vorkommt', () => {
    expect(trennePromptAmVb('nur text', '')).toEqual({ vor: 'nur text', vb: '', nach: '' });
    expect(trennePromptAmVb('nur text', 'fehlt')).toEqual({ vor: 'nur text', vb: '', nach: '' });
  });
});

describe('beschrifteGesendet', () => {
  const p = (bein?: 'generierung' | 'feinschliff'): GesendeterPrompt => ({
    system: 's', user: 'u', vb: '', vbGekuerzt: false, ...(bein ? { bein } : {}),
  });

  it('ein einzelner Prompt bleibt unbeschriftet', () => {
    expect(beschrifteGesendet([p('generierung')])).toEqual(['']);
    expect(beschrifteGesendet([])).toEqual([]);
  });

  it('mehrere Generierungs-Prompts sind eine Teil-Generierung', () => {
    expect(beschrifteGesendet([p('generierung'), p('generierung')]))
      .toEqual(['Teil-Lauf 1 von 2', 'Teil-Lauf 2 von 2']);
  });

  it('Generierung + Feinschliff nennt beide Beine beim Namen', () => {
    expect(beschrifteGesendet([p('generierung'), p('feinschliff')]))
      .toEqual(['Generierung', 'Sprachlicher Feinschliff']);
  });

  it('die Teil-Nummerierung zählt den Feinschliff NICHT mit', () => {
    // Sonst hieße es „Teil-Lauf 1 von 3", obwohl der Abschnitt in zwei Teilen entstand.
    expect(beschrifteGesendet([p('generierung'), p('generierung'), p('feinschliff')]))
      .toEqual(['Teil-Lauf 1 von 2', 'Teil-Lauf 2 von 2', 'Sprachlicher Feinschliff']);
  });

  it('ein Alt-Eintrag ohne `bein` gilt als Generierung', () => {
    expect(beschrifteGesendet([p(), p('feinschliff')]))
      .toEqual(['Generierung', 'Sprachlicher Feinschliff']);
  });
});
