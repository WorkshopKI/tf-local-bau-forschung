/**
 * Der Modell-Katalog und die Auflösung Rolle → Modell.
 *
 * Der Schwerpunkt liegt bewusst auf den Fällen, für die dieser Umbau gemacht
 * wurde: die interne KI tauscht ihre Modelle nach ihrem eigenen Fahrplan, und die
 * App darf daran weder scheitern noch still das falsche Fenster annehmen.
 */
import { describe, it, expect } from 'vitest';
import {
  ordneZu,
  loeseRolleAuf,
  unbekannteModelle,
  rueckfallFenster,
  MODELL_KATALOG,
  type AngebotenesModell,
} from '../modell-katalog';

/** Die Liste, wie sie die interne KI im August 2026 anbietet (Reihenfolge echt). */
const HEUTE: AngebotenesModell[] = [
  { text: 'gpt-oss-120b', value: 'gpt-oss-120b-F16.gguf', aktiv: true },
  { text: 'Qwen3.6-35B', value: 'Qwen3.6-35B-A3B-UD-Q4_K_M.gguf' },
  { text: 'Qwen3-VL-30B (multimodal)', value: 'Qwen3-VL-30B-Instruct-UD-Q4_K_XL.gguf' },
];

describe('ordneZu — Modellnamen der Seite auf den Katalog abbilden', () => {
  it('erkennt die drei heute angebotenen Modelle', () => {
    expect(ordneZu('gpt-oss-120b')?.schluessel).toBe('gpt-oss-120b');
    expect(ordneZu('Qwen3.6-35B')?.schluessel).toBe('qwen3.6-35b');
    expect(ordneZu('Qwen3-VL-30B (multimodal)')?.schluessel).toBe('multimodal');
  });

  it('greift auch über die value, wenn der Text nichts hergibt', () => {
    expect(ordneZu('', 'Qwen3.6-35B-A3B-UD-Q4_K_M.gguf')?.schluessel).toBe('qwen3.6-35b');
  });

  it('toleriert Schreibvarianten des Namens', () => {
    for (const s of ['GPT OSS 120B', 'gpt_oss', 'GPT-OSS-120b']) {
      expect(ordneZu(s)?.schluessel).toBe('gpt-oss-120b');
    }
  });

  it('meldet Unbekanntes als unbekannt, statt zu raten', () => {
    expect(ordneZu('Llama-4-Scout-17B')).toBeNull();
    expect(ordneZu('')).toBeNull();
  });

  it('das multimodale Modell gewinnt vor jedem anderen Muster', () => {
    // Der Grund für die Reihenfolge im Katalog: ein künftiges „Qwen3.6-VL" träfe
    // sonst die starke Rolle — und liefe mit seinen 62k genau in das Fenster,
    // dem die Eskalation entkommen will.
    expect(ordneZu('Qwen3.6-VL-40B (multimodal)')?.schluessel).toBe('multimodal');
  });
});

describe('loeseRolleAuf — heute', () => {
  it('standard trifft gpt-oss, stark trifft Qwen3.6', () => {
    expect(loeseRolleAuf('standard', HEUTE).text).toBe('gpt-oss-120b');
    expect(loeseRolleAuf('stark', HEUTE).text).toBe('Qwen3.6-35B');
  });

  it('nennt beide als Katalogtreffer', () => {
    expect(loeseRolleAuf('standard', HEUTE).art).toBe('katalog');
    expect(loeseRolleAuf('stark', HEUTE).art).toBe('katalog');
  });

  it('wählt das multimodale Modell für KEINE Rolle', () => {
    for (const r of ['standard', 'stark'] as const) {
      expect(loeseRolleAuf(r, HEUTE).text).not.toContain('VL');
    }
  });

  it('gelesene Fenster schlagen den Katalog', () => {
    const gelernt = (t: string): number | null => (t === 'Qwen3.6-35B' ? 259_000 : null);
    expect(loeseRolleAuf('stark', HEUTE, gelernt).fensterTokens).toBe(259_000);
    // ohne Messung: der Katalogwert
    expect(loeseRolleAuf('stark', HEUTE).fensterTokens)
      .toBe(MODELL_KATALOG.find(e => e.schluessel === 'qwen3.6-35b')?.fensterTokens);
  });
});

describe('loeseRolleAuf — wenn die interne KI ihre Modelle tauscht', () => {
  it('ein unbekanntes grosses Modell übernimmt die starke Rolle, sobald sein Fenster gemessen ist', () => {
    // Der eigentliche Zweck des Umbaus. Qwen3.6 ist weg, an seiner Stelle steht
    // etwas, das dieser Build nie gesehen hat.
    const morgen: AngebotenesModell[] = [
      { text: 'gpt-oss-120b', aktiv: true },
      { text: 'Llama-5-Titan-70B' },
    ];
    const gelernt = (t: string): number | null => (t === 'Llama-5-Titan-70B' ? 400_000 : null);
    const w = loeseRolleAuf('stark', morgen, gelernt);
    expect(w.text).toBe('Llama-5-Titan-70B');
    expect(w.art).toBe('weitestesFenster');
    expect(w.fensterTokens).toBe(400_000);
  });

  it('ohne gemessenes Fenster wird das Unbekannte NICHT zur starken Rolle erhoben', () => {
    // Es könnte 8k haben. Ein Lauf, der auf 250k zugeschnitten ist, liefe dann
    // still über — deshalb lieber bei der Voreinstellung bleiben.
    const morgen: AngebotenesModell[] = [
      { text: 'gpt-oss-120b', aktiv: true },
      { text: 'Llama-5-Titan-70B' },
    ];
    const w = loeseRolleAuf('stark', morgen);
    expect(w.text).toBe('gpt-oss-120b');
    expect(w.art).toBe('weitestesFenster');
  });

  it('kennt der Katalog gar nichts mehr, gilt die Voreinstellung der Seite', () => {
    const fremd: AngebotenesModell[] = [
      { text: 'Modell A' },
      { text: 'Modell B', aktiv: true },
    ];
    const w = loeseRolleAuf('standard', fremd);
    expect(w.text).toBe('Modell B');       // das ausgewählte, nicht das erste
    expect(w.art).toBe('voreinstellung');
    expect(w.fensterTokens).toBeNull();     // und wir behaupten kein Fenster
  });

  it('ohne Auswahl-Markierung das erste der Liste', () => {
    const fremd: AngebotenesModell[] = [{ text: 'Modell A' }, { text: 'Modell B' }];
    expect(loeseRolleAuf('standard', fremd).text).toBe('Modell A');
  });

  it('sind NUR multimodale Modelle im Angebot, wird nichts gewählt', () => {
    const nurBild: AngebotenesModell[] = [{ text: 'Qwen3-VL-30B (multimodal)', aktiv: true }];
    expect(loeseRolleAuf('standard', nurBild).text).toBe('');
  });

  it('ohne Liste bleibt der Katalog die Auskunft — aber ohne Auswahl', () => {
    const w = loeseRolleAuf('stark', []);
    expect(w.art).toBe('unbekannt');
    expect(w.text).toBe('');                       // nichts anfassen
    expect(w.label).toBe('Qwen3.6-35B');           // aber benennbar
    expect(w.fensterTokens).toBe(rueckfallFenster('stark'));
  });
});

describe('unbekannteModelle — die Drift sichtbar machen', () => {
  it('nennt genau das, was der Katalog nicht einordnen kann', () => {
    expect(unbekannteModelle(HEUTE)).toEqual([]);
    expect(unbekannteModelle([...HEUTE, { text: 'Llama-5-Titan-70B' }]))
      .toEqual(['Llama-5-Titan-70B']);
  });
});

describe('Katalog-Invarianten', () => {
  it('nicht wählbare Einträge stehen VOR den wählbaren', () => {
    // Sonst fischte ein tolerantes Muster ein multimodales Modell in eine Rolle.
    const ersterWaehlbar = MODELL_KATALOG.findIndex(e => !e.nichtWaehlbar);
    const letzterGesperrt = MODELL_KATALOG.map(e => !!e.nichtWaehlbar).lastIndexOf(true);
    expect(letzterGesperrt).toBeLessThan(ersterWaehlbar);
  });

  it('jede Rolle hat mindestens ein Modell als Rückfall', () => {
    for (const r of ['standard', 'stark'] as const) {
      expect(MODELL_KATALOG.some(e => e.rolle === r && !e.nichtWaehlbar)).toBe(true);
    }
  });

  it('gesperrte Einträge tragen einen Grund, der angezeigt werden kann', () => {
    for (const e of MODELL_KATALOG.filter(x => x.rolle === null)) {
      expect(e.nichtWaehlbar && e.nichtWaehlbar.length > 10).toBe(true);
    }
  });
});
