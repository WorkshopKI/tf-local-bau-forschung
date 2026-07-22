/**
 * Generelle Interpunktions-Vorgabe für KI-Fließtexte (v2.297): weder Semikolon noch
 * Gedankenstrich im Satz.
 *
 * Zwei Dinge werden hier festgeschrieben:
 *  1. **Die Muster sind eng gefasst.** Der teure Fehler wäre ein nacktes `-` oder
 *     `[–—]`: das träfe jede deutsche Wortverbindung („KI-gestützt") und jeden
 *     Zahlenbereich („2024–2026"), also praktisch jeden Gutachtensatz. Die
 *     Gegenproben unten sind daher genauso wichtig wie die Treffer.
 *  2. **Die Regel hängt an JEDEM generativen Gutachten-Schritt.** Sie ist als
 *     generelle Vorgabe gedacht, nicht als Eigenschaft einzelner Abschnitte — der
 *     Guard über `ZIM_EP_DEF` lässt einen künftigen Abschnitt H auffallen, der sie
 *     vergisst.
 */
import { describe, it, expect } from 'vitest';
import { SEED_REGISTRY, INTERPUNKTION_REGEL_ID, ZIM_EP_DEF } from '../seed';
import { getSkillById, resolveRegeln } from '../selectors';
import { runRegelChecks, buildPromptHinweis } from '../check-engine';
import type { QualitaetsRegel } from '../types';

const REGEL: QualitaetsRegel = SEED_REGISTRY.regeln.find(r => r.id === INTERPUNKTION_REGEL_ID)!;

/** Prüft einen Text gegen NUR diese Regel. */
function befund(text: string): { verstoss: boolean; stellen: number } {
  const check = runRegelChecks(text, [REGEL])[0]!;
  return { verstoss: check.level !== 'ok', stellen: check.fundstellen?.length ?? 0 };
}

describe('Interpunktions-Regel — Treffer', () => {
  it('meldet ein Semikolon', () => {
    expect(befund('Das Vorhaben entwickelt ein Verfahren; es wird erprobt.').verstoss).toBe(true);
  });

  it('meldet einen Gedankenstrich (Halbgeviert)', () => {
    expect(befund('Der Ansatz – ein Verbundprojekt – zielt auf Serienreife.').verstoss).toBe(true);
  });

  it('meldet einen Gedankenstrich (Geviert)', () => {
    expect(befund('Das Ziel ist klar — die Umsetzung ist offen.').verstoss).toBe(true);
  });

  it('meldet den Bindestrich zwischen Leerzeichen', () => {
    expect(befund('Das Ziel - kurz gesagt - ist die Serienreife.').verstoss).toBe(true);
  });

  it('meldet den doppelten Bindestrich', () => {
    expect(befund('Das Ziel--die Serienreife--bleibt.').verstoss).toBe(true);
  });

  it('lokalisiert jede betroffene Stelle (Sprung „Anzeigen")', () => {
    const text = 'Ein sauberer Satz. Hier steht etwas; und noch etwas. Auch hier – ein Einschub – steht etwas.';
    expect(befund(text).stellen).toBe(2);
  });

  it('ist ein Fehler, kein Hinweis', () => {
    const check = runRegelChecks('Ein Satz; noch einer.', [REGEL])[0]!;
    expect(check.level).toBe('fehler');
  });
});

describe('Interpunktions-Regel — Gegenproben (dürfen NICHT anschlagen)', () => {
  const unauffaellig = [
    'Das Vorhaben entwickelt KI-gestützte Verfahren zur Prozessüberwachung.',
    'Das Know-how der Partner ergänzt sich.',
    'Die Laufzeit beträgt 2024–2026.',
    'Die Erkennungsrate liegt zwischen 8–12 Prozent.',
    'Der Aufbau erfolgt in-situ am Referenzsystem.',
    'Das Vorhaben adressiert die Fertigung. Es reduziert Ausschuss.',
  ];
  for (const text of unauffaellig) {
    it(`bleibt still bei: ${text}`, () => {
      expect(befund(text).verstoss).toBe(false);
    });
  }
});

describe('Interpunktions-Regel — Prompt-Hinweis', () => {
  const hinweis = buildPromptHinweis(REGEL)!;

  it('nennt beide Zeichen und eine Alternative', () => {
    expect(hinweis).toContain('Semikolons und Gedankenstriche');
    expect(hinweis).toContain('Formuliere stattdessen');
  });

  it('trägt KEINEN rohen Regex in den Prompt', () => {
    // Regex-Modus ⇒ der Hinweis kommt allein aus `hinweisVermeiden`/`hinweisStattdessen`.
    for (const m of REGEL.params.muster as string[]) {
      if (m === ';') continue; // das Zeichen selbst darf im Fließtext des Hinweises stehen
      expect(hinweis).not.toContain(m);
    }
  });
});

describe('Interpunktions-Regel — gilt generell, nicht je Abschnitt', () => {
  it('hängt an JEDEM generativen Schritt des ZIM-EP-Workflows', () => {
    for (const step of ZIM_EP_DEF.steps) {
      const skill = getSkillById(SEED_REGISTRY, step.skillId)!;
      expect(skill, `Skill ${step.skillId} (Schritt ${step.nr}) fehlt im Seed`).toBeDefined();
      expect(
        skill.regelIds,
        `Schritt ${step.nr} (${skill.name}) führt die Interpunktions-Regel nicht`,
      ).toContain(INTERPUNKTION_REGEL_ID);
    }
  });

  it('landet über resolveRegeln im Regelsatz jedes Abschnitts', () => {
    for (const step of ZIM_EP_DEF.steps) {
      const skill = getSkillById(SEED_REGISTRY, step.skillId)!;
      const regeln = resolveRegeln(SEED_REGISTRY, skill);
      expect(regeln.map(r => r.id)).toContain(INTERPUNKTION_REGEL_ID);
    }
  });
});
