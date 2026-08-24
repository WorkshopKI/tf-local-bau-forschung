import { describe, it, expect } from 'vitest';
import {
  SEED_SKILL,
  SEED_SKILLS_BG,
  AUSGANGSLAGE_SKILL_ID,
  KURZFASSUNG_SKILL_ID,
  RISIKEN_SKILL_ID,
  KOMPETENZ_SKILL_ID,
  UNTERNEHMEN_SKILL_ID,
  VERWERTUNG_SKILL_ID,
  buildKurzfassungPrompt,
  mitVeroeffentlichungsKontrakt,
} from '../seed';

const MARKE = '→ stützt Satz';
/**
 * Lose Form derselben Marke — sie fängt auch eine umformulierte Instruktion.
 *
 * Bewusst `stützt Satz` statt nur `stützt`: Letzteres traf auch das Wort „IoT-gestützt"
 * in der Beispiel-Liste verbotener Schmuckwörter und meldete damit einen
 * Beleg-Kontrakt, wo keiner ist (2026-08).
 */
const MARKE_LOSE = 'stützt Satz';

// Rückbau (2026-07): der Beleg→Satz-Marker-Kontrakt (Journey-Paket 4) ist aus den live
// A/B-Skills entfernt — das interne Modell lief damit in einen Reasoning-Loop. Der
// Quellenbezug wird jetzt rein deterministisch abgeleitet (belegAbleitung.ts). Der
// `buildKurzfassungPrompt(true)`-Zweig bleibt NUR für die Rückbau-Migrations-Erkennung.
describe('Beleg-Kontrakt in Seed A + B — zurückgebaut', () => {
  it('A (Kurzfassung) trägt die Satz-Referenz-Instruktion NICHT mehr; = Alt-Template', () => {
    expect(SEED_SKILL.id).toBe(KURZFASSUNG_SKILL_ID);
    expect(SEED_SKILL.promptTemplate).not.toContain(MARKE_LOSE);
    expect(SEED_SKILL.promptTemplate).toBe(mitVeroeffentlichungsKontrakt(buildKurzfassungPrompt(false)));
    // v3: Satzzahl einheitlich 9–11 (Vorgabe + Modifier), Prosa ohne Zahl.
    // v4: Zeichenlimit 1.100 mit Herkunft am Wert.
    // v5: Veröffentlichungs-Kontrakt (Zweck, Weglass-Liste, Länge als Schreib-Anweisung).
    expect(SEED_SKILL.version).toBe(5);
  });

  it('B (Ausgangslage) trägt die Instruktion NICHT mehr', () => {
    const b = SEED_SKILLS_BG.find(s => s.id === AUSGANGSLAGE_SKILL_ID);
    expect(b).toBeDefined();
    expect(b!.promptTemplate).not.toContain(MARKE_LOSE);
    expect(b!.version).toBe(2);
  });

  it('C–G tragen die Beleg→Satz-Instruktion NICHT; nur D blieb bei version 1', () => {
    const uebrige = SEED_SKILLS_BG.filter(s => s.id !== AUSGANGSLAGE_SKILL_ID);
    expect(uebrige.length).toBeGreaterThan(0);
    for (const s of uebrige) {
      expect(s.promptTemplate, s.id).not.toContain(MARKE_LOSE);
    }
    // Jede Version hier stammt aus einem EIGENEN Umbau, nie aus dem Beleg-Kontrakt:
    // C v3 (Entwurf → gefilterter Fließtext, dann Risiko-Deckel 3 → 5), G v2
    // (Pflicht-Anfang in den eigenen Block), E + F v2 (erstmals eigene Vorgaben).
    // D ist der einzige Abschnitt, den seit dem Seed nichts angefasst hat.
    const eigenerUmbau = new Set<string>([
      RISIKEN_SKILL_ID, KOMPETENZ_SKILL_ID, UNTERNEHMEN_SKILL_ID, VERWERTUNG_SKILL_ID,
    ]);
    for (const s of uebrige.filter(s => !eigenerUmbau.has(s.id))) {
      expect(s.version, s.id).toBe(1);
    }
    const v = (id: string): number | undefined => SEED_SKILLS_BG.find(s => s.id === id)?.version;
    expect(v(RISIKEN_SKILL_ID)).toBe(3);
    expect(v(KOMPETENZ_SKILL_ID)).toBe(2);
    expect(v(UNTERNEHMEN_SKILL_ID)).toBe(2);
    expect(v(VERWERTUNG_SKILL_ID)).toBe(2);
  });

  it('buildKurzfassungPrompt: false ohne, true mit Instruktion (nur noch Migrations-Erkennung)', () => {
    const alt = buildKurzfassungPrompt(false);
    const neu = buildKurzfassungPrompt(true);
    expect(alt).not.toContain(MARKE_LOSE);
    expect(neu).toContain(MARKE);
    // Der Kontrakt-Stand ist der Alt-Stand PLUS Zusatz (kein anderer Umbau).
    expect(neu.length).toBeGreaterThan(alt.length);
    // Live-Skill nutzt den Alt-Stand (Rückbau), NICHT den Kontrakt-Stand — seit v5 mit
    // dem additiven Veröffentlichungs-Kontrakt darüber (`buildKurzfassungPrompt` selbst
    // bleibt byte-identisch, damit die beiden älteren Migrationen weiter greifen).
    expect(SEED_SKILL.promptTemplate).toBe(mitVeroeffentlichungsKontrakt(alt));
    expect(SEED_SKILL.promptTemplate).not.toContain(MARKE_LOSE);
  });
});
