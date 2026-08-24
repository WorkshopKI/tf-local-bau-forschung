import { describe, it, expect } from 'vitest';
import { GA_QS_REGELN, ABSCHNITTSZUORDNUNG } from '../ga-qs.seed';
import { ANKER_EP } from '@/core/services/gutachten-vorlagen';
import { qsRegelnFuerArtefakt, pruefartOf, getSkillById } from '../selectors';
import { runRegelChecks } from '../check-engine';
import { SEED_REGISTRY } from '../seed';

describe('GA-QS-Regelsatz (aus QS v2)', () => {
  it('wird für artefaktTyp ga gewählt und trägt alle drei Prüfarten', () => {
    const ga = qsRegelnFuerArtefakt(SEED_REGISTRY, 'ga');
    expect(ga.map(r => r.id).sort()).toEqual([...GA_QS_REGELN.map(r => r.id)].sort());
    expect(new Set(ga.map(r => pruefartOf(r)))).toEqual(new Set(['administrativ', 'fachlich', 'textlich']));
  });

  it('Formalia ist deterministisch (aktive Sprache), die fachlich/administrativ-Dimensionen sind LLM-QS (Engine übersprungen)', () => {
    const checks = runRegelChecks('Der Antragsteller plant ein neues Verfahren.', GA_QS_REGELN);
    expect(checks.some(c => c.regelId === 'ga-qs-formalia' && c.level === 'hinweis')).toBe(true);
    // Advisory ga_qs_*-Typen sind der Engine unbekannt → kein deterministisches Ergebnis.
    expect(checks.some(c => c.regelId === 'ga-qs-vollstaendigkeit')).toBe(false);
    expect(checks.some(c => c.regelId === 'ga-qs-quellenabgleich')).toBe(false);
  });
});

describe('Abschnittszuordnung A–G (QS v2)', () => {
  it('deckt alle internen Kennungen A–G mit nicht-leeren Überschriften ab', () => {
    expect(ABSCHNITTSZUORDNUNG.map(z => z.intern)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    for (const z of ABSCHNITTSZUORDNUNG) {
      expect(z.ueberschrift.trim().length).toBeGreaterThan(0);
      expect(z.inhalt.trim().length).toBeGreaterThan(0);
    }
  });

  it('übernimmt die tatsächlichen (abweichenden) Überschriften aus QS v2', () => {
    const byId = (id: string): string => ABSCHNITTSZUORDNUNG.find(z => z.intern === id)!.ueberschrift;
    // E/F/G tragen in QS v2 die 6.x-Überschriften — NICHT die internen Buchstaben.
    expect(byId('E')).toBe('6.1 Potentiale der Antragssteller');
    expect(byId('A')).toBe('Kurzfassung der Projektbeschreibung');
    // A–D stimmen mit den verifizierten EP-Ankern überein (kein Phantom-Lücken-Befund).
    expect(byId('A')).toBe(ANKER_EP.A);
    expect(byId('B')).toBe(ANKER_EP.B);
    expect(byId('C')).toBe(ANKER_EP.C);
  });
});

describe('GA-Skill-Abgleich (v20) — additive Stärken, GA-Verhalten unverändert', () => {
  it('B nennt die Wortzahl NICHT mehr fest im Prompt (single-source über die Regel)', () => {
    const b = getSkillById(SEED_REGISTRY, 'gutachten-ausgangslage')!;
    // Umfang single-source (2026-07): der Prompt-Text trägt keine feste Total-Zahl mehr —
    // die stand doppelt (Prosa + regel-abgeleiteter Block) und lief bei Regel-Edits auseinander.
    //
    // Geprüft wird seit 08/2026 die ABSICHT statt eines Stellvertreter-Wortes: KEINE
    // absolute Wortzahl irgendwo in der Prosa. „Gesamtumfang" als Wort taugte dafür nicht
    // mehr — die Teil-Richtwerte nennen ihren ANTEIL am Gesamtumfang („rund ein Fünftel"),
    // beziehen sich also bewusst darauf, ohne eine Zahl zu setzen (`applyBTeilAnteile`).
    expect(b.promptTemplate).not.toMatch(/\d+\s*Wörter/);
    expect(b.promptTemplate).not.toContain('mindestens vier Absätze');
    // Die 3-teilige Struktur (Hintergrund / Stand der Technik / Lösungsweg) bleibt.
    expect(b.promptTemplate).toContain('Lösungsweg');
    // Der Wert lebt jetzt allein in der Skill-Vorgabe (seit v2.296; davor die
    // Ein-Skill-Regel `seed-b-wortanzahl`).
    expect(b.vorgaben?.wortanzahl?.min).toBe(750);
    expect(SEED_REGISTRY.regeln.find(r => r.id === 'seed-b-wortanzahl')).toBeUndefined();
  });

  it('L=+50%-Modifier ist vorhanden (B–G)', () => {
    const c = getSkillById(SEED_REGISTRY, 'gutachten-risiken')!;
    expect(c.modifiers.laenger).toContain('50 %');
  });

  it('Stilbeispiele sind in A/C/G ergänzt (klar als Schreibstil markiert)', () => {
    for (const id of ['gutachten-kurzfassung', 'gutachten-risiken', 'gutachten-kompetenz']) {
      const skill = getSkillById(SEED_REGISTRY, id)!;
      expect(skill.promptTemplate).toContain('## Stilbeispiel');
      expect(skill.promptTemplate).toContain('NICHT übernehmen');
    }
  });
});
